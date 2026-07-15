import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Engine } from '@babylonjs/core/Engines/engine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Observer } from '@babylonjs/core/Misc/observable';
import { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Physics/physicsEngineComponent';
import { Action, InputManager } from '../systems/InputManager';
import { Player } from '../entities/Player';
import { RPGManager } from '../data/RPGManager';
import type { SettingsManager } from '../data/SettingsManager';
import { CombatManager } from '../systems/CombatManager';
import { EnemyManager } from '../systems/EnemyManager';
import { InteractionManager } from '../systems/InteractionManager';
import { AudioManager } from '../systems/AudioManager';
import { gameConfig } from '../config/gameConfig';
import { EnvironmentModel } from '../world/EnvironmentModel';
import type { CombatCooldownState, CombatFeedbackHandler } from '../ui/feedback';
import type { InteractPrompt } from '../systems/InteractionManager';

export class GameManager {
    private readonly engine: Engine;
    private readonly scene: Scene;
    private inputManager: InputManager | null = null;
    private player: Player | null = null;
    private camera: ArcRotateCamera | null = null;
    private combatManager: CombatManager | null = null;
    private enemyManager: EnemyManager | null = null;
    private interactionManager: InteractionManager | null = null;
    private environment: EnvironmentModel | null = null;
    private audio: AudioManager | null = null;
    private frameObserver: Observer<Scene> | null = null;
    private started = false;
    private disposed = false;
    private paused = false;
    private desiredCameraRadius: number = gameConfig.camera.defaultRadius;

    public constructor(
        private readonly canvas: HTMLCanvasElement,
        private readonly rpgManager: RPGManager,
        private readonly settingsManager: SettingsManager,
        private readonly onCombatFeedback: CombatFeedbackHandler = () => undefined,
        private readonly onCooldownChange: (state: CombatCooldownState) => void = () => undefined,
        private readonly onPromptChange: (prompt: InteractPrompt | null) => void = () => undefined,
        private readonly onPauseChange: (paused: boolean) => void = () => undefined
    ) {
        this.engine = new Engine(this.canvas, true, {
            preserveDrawingBuffer: false,
            stencil: false
        });
        this.engine.setHardwareScalingLevel(gameConfig.render.hardwareScalingLevel);
        this.scene = new Scene(this.engine);
    }

    public async start(): Promise<void> {
        if (this.started) return;
        if (this.disposed) throw new Error('游戏实例已经释放，无法再次启动。');
        this.started = true;

        await this.initPhysics();
        if (this.disposed) return;

        this.audio = new AudioManager(this.settingsManager.settings);
        this.settingsManager.subscribe(() => {
            this.audio?.setSettings(this.settingsManager.settings);
        });

        this.inputManager = new InputManager(this.canvas);
        this.environment = new EnvironmentModel(this.scene);
        this.player = new Player(this.scene, this.inputManager);
        this.enemyManager = new EnemyManager(
            this.scene,
            this.rpgManager,
            this.player,
            this.onCombatFeedback,
            this.audio
        );
        this.combatManager = new CombatManager(
            this.scene,
            this.rpgManager,
            this.player,
            this.enemyManager,
            this.onCombatFeedback,
            this.audio
        );
        this.interactionManager = new InteractionManager(
            this.scene,
            this.rpgManager,
            this.player,
            this.onCombatFeedback,
            this.audio
        );
        this.setupThirdPersonCamera();
        this.frameObserver = this.scene.onBeforeRenderObservable.add(this.handleBeforeRender);

        window.addEventListener('resize', this.handleResize);
        this.engine.runRenderLoop(this.renderFrame);
        this.canvas.focus();
    }

    public setPaused(paused: boolean): void {
        if (this.paused === paused) return;
        this.paused = paused;
        if (paused) {
            // 保留 InputManager 实例（Player 持有同一引用），仅清空按键状态。
            this.inputManager?.clear();
            if (document.pointerLockElement === this.canvas) document.exitPointerLock();
            this.audio?.play('pause');
        } else if (!this.disposed) {
            this.canvas.focus();
            this.audio?.play('ui');
        }
        this.onPauseChange(this.paused);
    }

    public isPaused(): boolean {
        return this.paused;
    }

    public playUiSound(): void {
        this.audio?.play('ui');
    }

    public playLevelUpSound(): void {
        this.audio?.play('levelup');
    }

    public playHealSound(): void {
        this.audio?.play('heal');
    }

    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;

        window.removeEventListener('resize', this.handleResize);
        this.engine.stopRenderLoop(this.renderFrame);
        if (this.frameObserver) this.scene.onBeforeRenderObservable.remove(this.frameObserver);
        this.frameObserver = null;
        this.camera?.detachControl();
        this.detachCameraInput();
        this.combatManager?.dispose();
        this.enemyManager?.dispose();
        this.interactionManager?.dispose();
        this.player?.dispose();
        this.environment?.dispose();
        this.inputManager?.dispose();
        this.audio?.dispose();
        this.scene.dispose();
        this.engine.dispose();
    }

    private async initPhysics(): Promise<void> {
        const [{ default: HavokPhysics }, { HavokPlugin }] = await Promise.all([
            import('@babylonjs/havok'),
            import('@babylonjs/core/Physics/v2/Plugins/havokPlugin')
        ]);
        const havokInstance = await HavokPhysics();
        if (this.disposed) return;
        const havokPlugin = new HavokPlugin(true, havokInstance);
        this.scene.enablePhysics(new Vector3(0, gameConfig.physics.gravity, 0), havokPlugin);
    }

    private setupThirdPersonCamera(): void {
        if (!this.player) throw new Error('创建相机前必须先创建玩家。');

        this.camera = new ArcRotateCamera(
            'thirdPersonCamera',
            Math.PI / 2,
            Math.PI / 4,
            gameConfig.camera.defaultRadius,
            Vector3.Zero(),
            this.scene
        );
        this.desiredCameraRadius = gameConfig.camera.defaultRadius;
        this.camera.lowerRadiusLimit = gameConfig.camera.minCollisionRadius;
        this.camera.upperRadiusLimit = gameConfig.camera.upperRadiusLimit;
        this.camera.lowerBetaLimit = gameConfig.camera.lowerBetaLimit;
        this.camera.upperBetaLimit = Math.PI / 2 - 0.1;
        this.attachCameraInput();
    }

    private attachCameraInput(): void {
        if (import.meta.env.DEV && this.camera) {
            this.canvas.dataset.cameraAlpha = this.camera.alpha.toFixed(4);
        }
        this.canvas.addEventListener('pointermove', this.handleCameraPointerMove);
        this.canvas.addEventListener('pointerdown', this.handleCameraPointerDown);
        this.canvas.addEventListener('wheel', this.handleCameraWheel, { passive: false });
    }

    private detachCameraInput(): void {
        this.canvas.removeEventListener('pointermove', this.handleCameraPointerMove);
        this.canvas.removeEventListener('pointerdown', this.handleCameraPointerDown);
        this.canvas.removeEventListener('wheel', this.handleCameraWheel);
        delete this.canvas.dataset.cameraAlpha;
        if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    }

    private readonly handleCameraPointerMove = (event: PointerEvent): void => {
        if (!this.camera || this.paused || event.pointerType !== 'mouse') return;
        const settings = this.settingsManager.settings;
        this.camera.alpha -= event.movementX * settings.mouseSensitivity;
        const vertical = settings.invertY ? 1 : -1;
        this.camera.beta = Math.max(
            this.camera.lowerBetaLimit ?? gameConfig.camera.lowerBetaLimit,
            Math.min(
                this.camera.upperBetaLimit ?? Math.PI / 2 - 0.1,
                this.camera.beta + vertical * event.movementY * settings.mouseSensitivity
            )
        );
        if (import.meta.env.DEV) {
            this.canvas.dataset.cameraAlpha = this.camera.alpha.toFixed(4);
        }
    };

    private readonly handleCameraPointerDown = (): void => {
        if (this.paused) return;
        if (document.pointerLockElement === this.canvas) return;
        try {
            const lockRequest = this.canvas.requestPointerLock();
            void lockRequest?.catch(() => undefined);
        } catch {
            // 浏览器拒绝指针锁定时，未锁定状态下的自由视角仍可使用。
        }
    };

    private readonly handleCameraWheel = (event: WheelEvent): void => {
        if (!this.camera || this.paused) return;
        event.preventDefault();
        this.desiredCameraRadius = Math.max(
            gameConfig.camera.lowerRadiusLimit,
            Math.min(
                gameConfig.camera.upperRadiusLimit,
                this.desiredCameraRadius + event.deltaY * gameConfig.camera.wheelSensitivity
            )
        );
    };

    private applyCameraCollision(): void {
        if (!this.camera || !this.player) return;

        const target = this.player.mesh.position.add(new Vector3(0, 1, 0));
        this.camera.setTarget(target);
        // 先放到期望距离，再沿目标→镜头射线检测遮挡并回缩。
        this.camera.radius = this.desiredCameraRadius;

        const engine = this.scene.getPhysicsEngine();
        if (!engine) return;

        const farPoint = this.camera.globalPosition.clone();
        const hit = engine.raycast(target, farPoint, {
            ignoreBody: this.player.physicsBody ?? undefined
        });
        if (!hit?.hasHit) return;

        const hitDistance = Vector3.Distance(target, hit.hitPointWorld)
            - gameConfig.camera.collisionMargin;
        this.camera.radius = Math.max(
            gameConfig.camera.minCollisionRadius,
            Math.min(this.desiredCameraRadius, hitDistance)
        );
    }

    private readonly handleBeforeRender = (): void => {
        if (
            !this.player
            || !this.camera
            || !this.combatManager
            || !this.enemyManager
            || !this.interactionManager
        ) return;

        if (this.paused) {
            this.applyCameraCollision();
            return;
        }

        const deltaSeconds = Math.min(
            this.engine.getDeltaTime() / 1000,
            gameConfig.physics.maxDeltaSeconds
        );

        this.rpgManager.update(deltaSeconds);
        const canControl = !this.rpgManager.isDead && this.inputManager !== null;
        this.player.update(this.camera, deltaSeconds, canControl);
        this.applyCameraCollision();

        if (canControl && this.inputManager) {
            if (this.inputManager.consumePress(Action.ATTACK_MELEE)) {
                this.combatManager.triggerMeleeAttack();
            }
            if (this.inputManager.consumePress(Action.ATTACK_RANGED)) {
                this.combatManager.triggerRangedAttack(this.camera);
            }
            if (this.inputManager.consumePress(Action.INTERACT)) {
                const interacted = this.interactionManager.tryInteract();
                if (!interacted && import.meta.env.DEV) {
                    // 开发模式：附近无可交互物时仍可用 E 加测试经验。
                    this.rpgManager.addXP(10);
                    this.onCombatFeedback({ type: 'toast', text: '测试经验 +10', kind: 'system' });
                }
            }
        }

        this.combatManager.update(deltaSeconds);
        this.enemyManager.update(deltaSeconds);
        this.interactionManager.update(deltaSeconds);
        this.onPromptChange(this.interactionManager.getPrompt());
        this.onCooldownChange(this.combatManager.getCooldownState());
    };

    private readonly renderFrame = (): void => {
        if (!this.disposed) this.scene.render();
    };

    private readonly handleResize = (): void => this.engine.resize();
}
