import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import '@babylonjs/core/Culling/ray';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder.pure';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { PhysicsMotionType, PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { Scene } from '@babylonjs/core/scene';
import { InputManager, Action } from '../systems/InputManager';
import { gameConfig } from '../config/gameConfig';
import { PlayerModel } from '../models/PlayerModel';
import type { GltfAssetSource, GltfLoadProgress } from '../models/GltfModelLoader';

export class Player {
    public mesh!: Mesh;
    public facingRoot!: TransformNode;
    private model!: PlayerModel;
    private scene: Scene;
    private inputManager: InputManager;
    private aggregate: PhysicsAggregate | null = null;

    // 移动数值统一来自配置，实体只负责执行角色运动。
    private readonly speed = gameConfig.player.speed;
    private readonly jumpForce = gameConfig.player.jumpForce;
    private isGrounded = false;
    private knockbackVelocity = Vector3.Zero();
    private dodgeDirection = Vector3.Zero();
    private dodgeRemainingSeconds = 0;

    constructor(scene: Scene, inputManager: InputManager) {
        this.scene = scene;
        this.inputManager = inputManager;

        this.createPlaceholderMesh();
        this.setupPhysics();

    }

    private createPlaceholderMesh() {
        // 胶囊只承担物理碰撞，精细视觉模型独立挂载，避免动画影响刚体。
        this.mesh = CreateCapsule('player', { radius: 0.5, height: 2 }, this.scene);
        this.mesh.position.y = 1;
        this.mesh.visibility = 0;
        this.mesh.isPickable = false;
        this.facingRoot = new TransformNode('playerFacingRoot', this.scene);
        this.facingRoot.parent = this.mesh;
        this.model = new PlayerModel(this.scene, this.facingRoot);
    }

    private setupPhysics() {
        // 视觉胶囊和物理胶囊尺寸一致，减少命中表现与碰撞结果的偏差。
        this.aggregate = new PhysicsAggregate(
            this.mesh,
            PhysicsShapeType.CAPSULE,
            { mass: 1, restitution: 0, friction: 0.5 },
            this.scene
        );

        // 动态刚体由 Havok 回写位置，禁止每帧把视觉变换作为传送指令写回物理世界。
        this.aggregate.body.disablePreStep = true;
        this.aggregate.body.setAngularVelocity(Vector3.Zero());
        // 使用枚举避免 Babylon.js 运动类型数值变化或注释与实现不一致。
        this.aggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
        // 零惯性在 Havok 中表示无限转动惯量，从物理层阻止胶囊被碰撞推倒。
        this.aggregate.body.setMassProperties({
            ...this.aggregate.body.getMassProperties(),
            inertia: Vector3.Zero()
        });
        this.aggregate.body.setAngularDamping(1);
    }

    public applyKnockback(fromDirection: Vector3): void {
        const horizontal = new Vector3(fromDirection.x, 0, fromDirection.z);
        if (horizontal.lengthSquared() < 0.0001) return;
        horizontal.normalize();
        this.knockbackVelocity = horizontal.scale(gameConfig.player.hitKnockback);
    }

    public async loadVisualAsset(
        source: GltfAssetSource,
        onProgress?: (progress: GltfLoadProgress) => void
    ): Promise<boolean> {
        return this.model.loadExternalModel(source, onProgress);
    }

    public get canStartDodge(): boolean {
        return this.isGrounded && this.dodgeRemainingSeconds <= 0;
    }

    public get isDodging(): boolean {
        return this.dodgeRemainingSeconds > 0;
    }

    public startDodge(camera: ArcRotateCamera): boolean {
        if (!this.canStartDodge) return false;

        this.dodgeDirection = this.getInputDirection(camera);
        if (this.dodgeDirection.lengthSquared() < 0.0001) {
            this.dodgeDirection = this.getForwardDirection();
        }
        this.dodgeDirection.normalize();
        this.facingRoot.rotation.y = Math.atan2(this.dodgeDirection.x, this.dodgeDirection.z);
        this.dodgeRemainingSeconds = gameConfig.player.dodgeDurationSeconds;
        return true;
    }

    public update(camera: ArcRotateCamera, deltaSeconds: number, canControl = true) {
        if (!this.aggregate) return;

        // 受击击退衰减。
        this.knockbackVelocity.scaleInPlace(Math.max(0, 1 - deltaSeconds * 6));
        if (this.knockbackVelocity.lengthSquared() < 0.01) {
            this.knockbackVelocity.set(0, 0, 0);
        }

        const inputDirection = canControl ? this.getInputDirection(camera) : Vector3.Zero();
        let moveVector = inputDirection.scale(this.speed);
        if (this.isDodging) {
            this.dodgeRemainingSeconds = Math.max(0, this.dodgeRemainingSeconds - deltaSeconds);
            moveVector = this.dodgeDirection.scale(gameConfig.player.dodgeSpeed);
        } else if (inputDirection.lengthSquared() > 0) {
            // 只旋转视觉节点，避免直接修改动态刚体的旋转四元数。
            const targetRotation = Math.atan2(moveVector.x, moveVector.z);
            this.facingRoot.rotation.y = targetRotation;
        }
        const dodgeProgress = this.isDodging
            ? 1 - this.dodgeRemainingSeconds / gameConfig.player.dodgeDurationSeconds
            : null;
        this.model.update(deltaSeconds, inputDirection.lengthSquared() > 0, dodgeProgress);

        // 跳跃只响应按下瞬间，避免长按造成连续冲量。
        this.checkGrounded();

        if (canControl
            && !this.isDodging
            && this.inputManager.consumePress(Action.JUMP)
            && this.isGrounded) {
            this.aggregate.body.applyImpulse(new Vector3(0, this.jumpForce, 0), this.mesh.getAbsolutePosition());
        }

        const currentVelocity = this.aggregate.body.getLinearVelocity();

        // 清除碰撞产生的旋转速度，防止胶囊倾倒。
        this.aggregate.body.setAngularVelocity(Vector3.Zero());

        // 保留垂直速度，让 Havok 继续处理重力、起跳和下落；叠加热击退。
        this.aggregate.body.setLinearVelocity(new Vector3(
            moveVector.x + this.knockbackVelocity.x,
            currentVelocity.y,
            moveVector.z + this.knockbackVelocity.z
        ));
    }

    private checkGrounded() {
        if (!this.scene.getPhysicsEngine()) return;

        // 从角色中心向脚底投射短射线判断接地。
        const start = this.mesh.getAbsolutePosition().clone();
        const end = start.clone();
        end.y -= 1.1; // 胶囊半高为 1，额外留出 0.1 的接地容差。

        const hit = this.scene.getPhysicsEngine()?.raycast(start, end, {
            // 射线从角色内部发出，必须排除自身刚体，否则会一直误判为接地。
            ignoreBody: this.aggregate?.body
        });
        this.isGrounded = Boolean(
            hit?.hasHit && hit.hitNormalWorld.y > gameConfig.player.maxGroundSlopeNormalY
        );
    }

    public getForwardDirection(): Vector3 {
        const yaw = this.facingRoot.rotation.y;
        return new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    }

    private getInputDirection(camera: ArcRotateCamera): Vector3 {
        const forward = this.inputManager.isActive(Action.FORWARD)
            ? 1
            : (this.inputManager.isActive(Action.BACKWARD) ? -1 : 0);
        const right = this.inputManager.isActive(Action.RIGHT)
            ? 1
            : (this.inputManager.isActive(Action.LEFT) ? -1 : 0);
        if (forward === 0 && right === 0) return Vector3.Zero();

        // 垂直镜头角度不应影响地面移动方向。
        const cameraForward = camera.getForwardRay().direction;
        cameraForward.y = 0;
        cameraForward.normalize();
        const cameraRight = Vector3.Cross(Vector3.Up(), cameraForward).normalize();
        return cameraForward.scale(forward).add(cameraRight.scale(right)).normalize();
    }

    public get weaponAnchor(): TransformNode {
        return this.model.weaponAnchor;
    }

    public get physicsBody() {
        return this.aggregate?.body ?? null;
    }

    public get renderableMeshes(): readonly Mesh[] {
        return this.model.meshes;
    }

    public dispose(): void {
        this.aggregate?.dispose();
        this.aggregate = null;
        this.model.dispose();
        this.mesh.dispose(false, true);
    }
}
