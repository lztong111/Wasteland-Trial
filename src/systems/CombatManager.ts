import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.pure';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.pure';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { Scene } from '@babylonjs/core/scene';
import { RPGManager } from '../data/RPGManager';
import { Player } from '../entities/Player';
import { EnemyManager } from './EnemyManager';
import { gameConfig } from '../config/gameConfig';
import { SwordModel } from '../models/SwordModel';
import {
    type CombatCooldownState,
    type CombatFeedbackHandler,
    toast
} from '../ui/feedback';
import type { AudioManager } from './AudioManager';

interface Projectile {
    mesh: Mesh;
    material: StandardMaterial;
    light: PointLight;
    aggregate: PhysicsAggregate;
    remainingSeconds: number;
}

interface MeleeEffect {
    mesh: Mesh;
    material: StandardMaterial;
    remainingSeconds: number;
}

export type { CombatFeedbackHandler };

const combatConfig = gameConfig.combat;

export class CombatManager {
    private readonly weaponModel: SwordModel;
    private readonly projectiles: Projectile[] = [];
    private readonly meleeEffects: MeleeEffect[] = [];
    private isAttacking = false;
    private meleeCooldownSeconds = 0;
    private rangedCooldownSeconds = 0;
    private swingElapsedSeconds = 0;
    private hitChecked = false;
    private swingStartRotation = Vector3.Zero();

    public constructor(
        private readonly scene: Scene,
        private readonly rpgManager: RPGManager,
        private readonly player: Player,
        private readonly enemyManager: EnemyManager,
        private readonly onFeedback: CombatFeedbackHandler,
        private readonly audio: AudioManager | null = null
    ) {
        this.weaponModel = new SwordModel(this.scene, this.player.weaponAnchor);
    }

    public get renderableMeshes(): readonly Mesh[] {
        return this.weaponModel.meshes;
    }

    public getCooldownState(): CombatCooldownState {
        return {
            melee: combatConfig.meleeCooldownSeconds <= 0
                ? 0
                : this.meleeCooldownSeconds / combatConfig.meleeCooldownSeconds,
            ranged: combatConfig.rangedCooldownSeconds <= 0
                ? 0
                : this.rangedCooldownSeconds / combatConfig.rangedCooldownSeconds
        };
    }

    public triggerMeleeAttack(): void {
        if (this.isAttacking || this.meleeCooldownSeconds > 0) return;
        if (!this.rpgManager.consumeStamina(combatConfig.meleeStaminaCost)) {
            this.onFeedback(toast('体力不足', 'warning'));
            return;
        }

        this.isAttacking = true;
        this.meleeCooldownSeconds = combatConfig.meleeCooldownSeconds;
        this.swingElapsedSeconds = 0;
        this.hitChecked = false;
        this.swingStartRotation = this.weaponModel.root.rotation.clone();
        this.weaponModel.setAttackGlow(1);
        this.spawnMeleeEffect();
        this.audio?.play('melee');
        this.onFeedback(toast('近战攻击', 'combat'));
    }

    public triggerRangedAttack(camera: ArcRotateCamera): void {
        if (this.rangedCooldownSeconds > 0) return;
        this.rangedCooldownSeconds = combatConfig.rangedCooldownSeconds;
        this.audio?.play('ranged');

        const aimDirection = camera.getForwardRay().direction.normalize();
        const mesh = CreateSphere(
            'projectile',
            { diameter: combatConfig.projectileDiameter },
            this.scene
        );
        // 从碰撞体前方生成，防止弹丸出生后立即撞上玩家自身。
        mesh.position = this.player.mesh.getAbsolutePosition()
            .add(new Vector3(0, 0.65, 0))
            .add(aimDirection.scale(combatConfig.projectileSpawnDistance));
        mesh.isPickable = false;
        const material = new StandardMaterial('projectileMaterial', this.scene);
        material.diffuseColor = new Color3(1, 0.18, 0.02);
        material.emissiveColor = new Color3(1, 0.45, 0.05);
        material.disableLighting = true;
        mesh.material = material;
        const light = new PointLight('projectileLight', Vector3.Zero(), this.scene);
        light.diffuse = new Color3(1, 0.35, 0.05);
        light.intensity = 1.4;
        light.range = 5;
        light.parent = mesh;
        const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.SPHERE, { mass: 0.1 }, this.scene);
        aggregate.body.setGravityFactor(0);
        aggregate.body.applyImpulse(
            aimDirection.scale(combatConfig.projectileSpeed),
            mesh.position
        );
        this.projectiles.push({
            mesh,
            material,
            light,
            aggregate,
            remainingSeconds: combatConfig.projectileLifetimeSeconds
        });
        this.onFeedback(toast('远程射击', 'combat'));
    }

    public update(deltaSeconds: number): void {
        this.meleeCooldownSeconds = Math.max(0, this.meleeCooldownSeconds - deltaSeconds);
        this.rangedCooldownSeconds = Math.max(0, this.rangedCooldownSeconds - deltaSeconds);
        this.updateMeleeSwing(deltaSeconds);
        this.updateProjectiles(deltaSeconds);
        this.updateMeleeEffects(deltaSeconds);

        if (!this.isAttacking) {
            this.rpgManager.restoreStamina(combatConfig.staminaRegenPerSecond * deltaSeconds);
        }
    }

    public dispose(): void {
        for (const projectile of this.projectiles.splice(0)) this.disposeProjectile(projectile);
        for (const effect of this.meleeEffects.splice(0)) this.disposeMeleeEffect(effect);
        this.weaponModel.dispose();
    }

    private updateMeleeSwing(deltaSeconds: number): void {
        if (!this.isAttacking) return;

        this.swingElapsedSeconds += deltaSeconds;
        const progress = Math.min(this.swingElapsedSeconds / combatConfig.meleeSwingSeconds, 1);
        const swingProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
        this.weaponModel.root.rotation.z = this.swingStartRotation.z - Math.PI * 1.18 * swingProgress;
        this.weaponModel.root.rotation.x = this.swingStartRotation.x + 0.38 * swingProgress;
        const scale = 1 + Math.sin(progress * Math.PI) * 0.3;
        this.weaponModel.setScale(scale);

        if (!this.hitChecked && progress >= 0.5) {
            this.hitChecked = true;
            this.checkMeleeHit();
        }

        if (progress >= 1) {
            this.weaponModel.root.rotation.copyFrom(this.swingStartRotation);
            this.weaponModel.setScale(1);
            this.weaponModel.setAttackGlow(0);
            this.isAttacking = false;
        }
    }

    private updateProjectiles(deltaSeconds: number): void {
        for (let index = this.projectiles.length - 1; index >= 0; index -= 1) {
            const projectile = this.projectiles[index];
            projectile.remainingSeconds -= deltaSeconds;
            const hitEnemy = this.enemyManager.damageClosestEnemy(
                projectile.mesh.getAbsolutePosition(),
                combatConfig.projectileHitRadius,
                this.rpgManager.getTotalDamage()
            );
            if (hitEnemy || projectile.remainingSeconds <= 0) {
                if (hitEnemy) {
                    this.audio?.play('hit');
                    this.onFeedback(toast('远程命中', 'hit'));
                    this.onFeedback({ type: 'float', text: `-${this.rpgManager.getTotalDamage()}`, kind: 'damage' });
                }
                this.disposeProjectile(projectile);
                this.projectiles.splice(index, 1);
            }
        }
    }

    private checkMeleeHit(): void {
        const playerPosition = this.player.mesh.getAbsolutePosition();
        const forward = this.player.getForwardDirection();
        const hitCenter = playerPosition.add(forward.scale(1.4));
        const damage = this.rpgManager.getTotalDamage();
        const hitCount = this.enemyManager.damageEnemiesInRadius(
            hitCenter,
            combatConfig.meleeRange,
            damage
        );
        if (hitCount > 0) {
            this.audio?.play('hit');
            this.onFeedback(toast(`近战命中 ×${hitCount}`, 'hit'));
            this.onFeedback({ type: 'float', text: `-${damage * hitCount}`, kind: 'damage' });
        }
    }

    private spawnMeleeEffect(): void {
        const forward = this.player.getForwardDirection();
        const mesh = CreateTorus(
            'meleeEffect',
            { diameter: 2.4, thickness: 0.09, tessellation: 40 },
            this.scene
        );
        mesh.position = this.player.mesh.getAbsolutePosition()
            .add(new Vector3(0, 0.7, 0))
            .add(forward.scale(1.1));
        mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
        mesh.isPickable = false;
        const material = new StandardMaterial('meleeEffectMaterial', this.scene);
        material.emissiveColor = new Color3(0.2, 0.8, 1);
        material.diffuseColor = Color3.Black();
        material.disableLighting = true;
        material.alpha = 0.9;
        mesh.material = material;
        this.meleeEffects.push({
            mesh,
            material,
            remainingSeconds: combatConfig.meleeEffectSeconds
        });
    }

    private updateMeleeEffects(deltaSeconds: number): void {
        for (let index = this.meleeEffects.length - 1; index >= 0; index -= 1) {
            const effect = this.meleeEffects[index];
            effect.remainingSeconds -= deltaSeconds;
            const progress = 1 - Math.max(0, effect.remainingSeconds) / combatConfig.meleeEffectSeconds;
            effect.mesh.scaling.setAll(0.75 + progress * 0.65);
            effect.material.alpha = Math.max(0, 0.9 * (1 - progress));
            if (effect.remainingSeconds <= 0) {
                this.disposeMeleeEffect(effect);
                this.meleeEffects.splice(index, 1);
            }
        }
    }

    private disposeProjectile(projectile: Projectile): void {
        projectile.aggregate.dispose();
        projectile.light.dispose();
        projectile.mesh.dispose();
        projectile.material.dispose();
    }

    private disposeMeleeEffect(effect: MeleeEffect): void {
        effect.mesh.dispose();
        effect.material.dispose();
    }
}
