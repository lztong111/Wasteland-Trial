import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { RPGManager } from '../data/RPGManager';
import { Player } from '../entities/Player';
import { gameConfig } from '../config/gameConfig';
import { EnemyModel } from '../models/EnemyModel';
import type { CombatFeedbackHandler } from '../ui/feedback';
import type { AudioManager } from './AudioManager';
import type { GamePhase, GameProgressManager } from '../data/GameProgressManager';

interface SpawnSlot {
    index: number;
    position: Vector3;
}

interface Enemy {
    id: string;
    slotIndex: number;
    model: EnemyModel;
    hp: number;
    maxHp: number;
    attackDamage: number;
    xpReward: number;
    attackCooldownSeconds: number;
    hitFlashSeconds: number;
    windupSeconds: number;
}

interface PendingRespawn {
    slot: SpawnSlot;
    remainingSeconds: number;
}

const enemyConfig = gameConfig.enemy;
const worldConfig = gameConfig.world;

const SKIN_COLORS = [
    new Color3(0.56, 0.1, 0.08),
    new Color3(0.42, 0.12, 0.32),
    new Color3(0.5, 0.2, 0.06)
];

export class EnemyManager {
    private readonly enemies: Enemy[] = [];
    private readonly pendingRespawns: PendingRespawn[] = [];
    private readonly slots: SpawnSlot[];
    private spawnSerial = 0;
    private spawnedWavePhase: GamePhase | null = null;

    public constructor(
        private readonly scene: Scene,
        private readonly rpgManager: RPGManager,
        private readonly player: Player,
        private readonly onFeedback: CombatFeedbackHandler = () => undefined,
        private readonly audio: AudioManager | null = null,
        private readonly progressManager: GameProgressManager | null = null
    ) {
        this.slots = worldConfig.enemySpawnPoints.map((position, index) => ({
            index,
            position: new Vector3(...position)
        }));
        if (this.progressManager) this.syncProgressWave();
        else this.slots.forEach(slot => this.spawnEnemy(slot));
    }

    public get renderableMeshes(): readonly Mesh[] {
        return this.enemies.flatMap(enemy => enemy.model.meshes);
    }

    public update(deltaSeconds: number): void {
        this.syncProgressWave();
        this.updateRespawns(deltaSeconds);

        for (const enemy of this.enemies) {
            enemy.hitFlashSeconds = Math.max(0, enemy.hitFlashSeconds - deltaSeconds);
            enemy.model.setHitFlash(enemy.hitFlashSeconds > 0);
        }
        if (this.rpgManager.isDead) return;

        const playerPosition = this.player.mesh.getAbsolutePosition();
        for (const enemy of this.enemies) {
            enemy.attackCooldownSeconds = Math.max(0, enemy.attackCooldownSeconds - deltaSeconds);
            const toPlayer = playerPosition.subtract(enemy.model.root.position);
            toPlayer.y = 0;
            const distance = toPlayer.length();

            if (enemy.windupSeconds > 0) {
                enemy.windupSeconds = Math.max(0, enemy.windupSeconds - deltaSeconds);
                const progress = 1 - enemy.windupSeconds / enemyConfig.attackWindupSeconds;
                enemy.model.setAttackTelegraph(progress);
                if (distance > enemyConfig.attackRange + enemyConfig.attackCancelMargin) {
                    enemy.windupSeconds = 0;
                    enemy.model.setAttackTelegraph(0);
                    enemy.attackCooldownSeconds = enemyConfig.attackCooldownSeconds * 0.5;
                } else if (enemy.windupSeconds === 0) {
                    enemy.model.setAttackTelegraph(0);
                    const applied = this.rpgManager.takeDamage(enemy.attackDamage);
                    enemy.attackCooldownSeconds = enemyConfig.attackCooldownSeconds;
                    if (applied) {
                        this.player.applyKnockback(toPlayer.normalize());
                        this.audio?.play('hurt');
                        this.onFeedback({ type: 'toast', text: '受到攻击', kind: 'warning' });
                    }
                }
            } else if (distance > enemyConfig.attackRange) {
                const moveDir = this.computeAvoidanceDirection(enemy, toPlayer, distance);
                enemy.model.root.position.addInPlace(
                    moveDir.scale(enemyConfig.speed * deltaSeconds)
                );
                enemy.model.root.rotation.y = Math.atan2(moveDir.x, moveDir.z);
            } else if (enemy.attackCooldownSeconds === 0) {
                enemy.windupSeconds = enemyConfig.attackWindupSeconds;
                enemy.model.setAttackTelegraph(0.01);
            }
            enemy.model.update(deltaSeconds, distance > enemyConfig.attackRange);
        }
    }

    public damageEnemiesInRadius(center: Vector3, radius: number, damage: number): number {
        let hitCount = 0;
        for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
            const enemy = this.enemies[index];
            if (Vector3.DistanceSquared(center, enemy.model.root.position) <= radius * radius) {
                this.damageEnemy(index, damage);
                hitCount += 1;
            }
        }
        return hitCount;
    }

    public damageEnemiesInCone(
        origin: Vector3,
        forward: Vector3,
        range: number,
        halfAngleRadians: number,
        damage: number
    ): number {
        const horizontalForward = new Vector3(forward.x, 0, forward.z).normalize();
        const minimumDot = Math.cos(halfAngleRadians);
        let hitCount = 0;
        for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
            const enemy = this.enemies[index];
            const offset = enemy.model.root.position.subtract(origin);
            offset.y = 0;
            const distance = offset.length();
            if (distance <= 0.001 || distance > range) continue;
            if (Vector3.Dot(horizontalForward, offset.scale(1 / distance)) < minimumDot) continue;
            if (this.isLineOfSightBlocked(origin, enemy.model.root.position, distance)) continue;
            this.damageEnemy(index, damage);
            hitCount += 1;
        }
        return hitCount;
    }

    public damageClosestEnemy(center: Vector3, radius: number, damage: number): boolean {
        let closestIndex = -1;
        let closestDistanceSquared = radius * radius;

        this.enemies.forEach((enemy, index) => {
            const distanceSquared = Vector3.DistanceSquared(center, enemy.model.root.position);
            if (distanceSquared <= closestDistanceSquared) {
                closestDistanceSquared = distanceSquared;
                closestIndex = index;
            }
        });

        if (closestIndex < 0) return false;
        this.damageEnemy(closestIndex, damage);
        return true;
    }

    public dispose(): void {
        for (const enemy of this.enemies.splice(0)) enemy.model.dispose();
        this.pendingRespawns.length = 0;
    }

    private updateRespawns(deltaSeconds: number): void {
        if (this.progressManager && !this.progressManager.shouldSpawnGuardians) {
            this.pendingRespawns.length = 0;
            return;
        }
        for (let index = this.pendingRespawns.length - 1; index >= 0; index -= 1) {
            const pending = this.pendingRespawns[index];
            pending.remainingSeconds -= deltaSeconds;
            if (pending.remainingSeconds > 0) continue;
            this.pendingRespawns.splice(index, 1);
            this.spawnEnemy(pending.slot);
            this.onFeedback({ type: 'toast', text: '敌人再次出现', kind: 'system' });
        }
    }

    private syncProgressWave(): void {
        if (!this.progressManager || !this.progressManager.shouldSpawnGuardians) return;
        const phase = this.progressManager.progress.phase;
        if (this.spawnedWavePhase === phase) return;

        // 波次由关卡阶段驱动，保证开箱后和读档进入第二波时都会补齐应有敌人。
        this.spawnedWavePhase = phase;
        const remaining = this.progressManager.guardiansRemainingInCurrentWave;
        this.slots.slice(0, remaining).forEach(slot => this.spawnEnemy(slot));
        if (phase === 'reinforcements') {
            this.audio?.play('ranged');
            this.onFeedback({ type: 'toast', text: '第二波守卫来袭', kind: 'warning' });
        }
    }

    private spawnEnemy(slot: SpawnSlot): void {
        this.spawnSerial += 1;
        const id = `enemy_${slot.index + 1}_${this.spawnSerial}`;
        const completedTrials = Math.max(
            0,
            (this.progressManager?.progress.trialNumber ?? 1) - 1
        );
        const maxHp = Math.round(
            enemyConfig.maxHp * (1 + completedTrials * enemyConfig.trialHealthGrowthPerRound)
        );
        const attackDamage = Math.round(
            enemyConfig.attackDamage
                * (1 + completedTrials * enemyConfig.trialDamageGrowthPerRound)
        );
        const xpReward = Math.round(
            enemyConfig.xpReward * (1 + completedTrials * enemyConfig.trialXpGrowthPerRound)
        );
        const model = new EnemyModel(
            id,
            slot.position.clone(),
            SKIN_COLORS[slot.index % SKIN_COLORS.length],
            this.scene,
            slot.index * 0.83
        );
        this.enemies.push({
            id,
            slotIndex: slot.index,
            model,
            hp: maxHp,
            maxHp,
            attackDamage,
            xpReward,
            attackCooldownSeconds: 0,
            hitFlashSeconds: 0,
            windupSeconds: 0
        });
    }

    private damageEnemy(index: number, damage: number): void {
        const enemy = this.enemies[index];
        if (!enemy) return;
        enemy.hp = Math.max(0, enemy.hp - damage);
        enemy.hitFlashSeconds = 0.14;
        enemy.model.setHitFlash(true);
        enemy.model.setHealthRatio(enemy.hp / enemy.maxHp);
        if (enemy.hp > 0) return;

        const slot = this.slots.find(candidate => candidate.index === enemy.slotIndex);
        enemy.model.dispose();
        this.enemies.splice(index, 1);
        this.rpgManager.addXP(enemy.xpReward);
        this.progressManager?.recordGuardianDefeated();
        this.audio?.play('hit');
        this.onFeedback({ type: 'float', text: `+${enemy.xpReward} XP`, kind: 'xp' });
        this.onFeedback({ type: 'toast', text: '击败敌人', kind: 'system' });

        if (slot && !this.progressManager) {
            this.pendingRespawns.push({
                slot,
                remainingSeconds: worldConfig.enemyRespawnDelaySeconds
            });
        }
    }

    /**
     * 朝玩家移动时用前方探测 + 侧向滑行避开静态障碍，并用分离向量减少叠怪。
     */
    private computeAvoidanceDirection(
        enemy: Enemy,
        toPlayer: Vector3,
        distance: number
    ): Vector3 {
        const desired = distance > 0.0001
            ? toPlayer.scale(1 / distance)
            : new Vector3(0, 0, 1);

        let moveX = desired.x;
        let moveZ = desired.z;

        const origin = enemy.model.root.position.clone();
        origin.y = 0.9;
        const lookAhead = enemyConfig.avoidLookAhead;
        const forwardHit = this.raycastObstacle(
            origin,
            origin.add(new Vector3(desired.x * lookAhead, 0, desired.z * lookAhead))
        );

        if (forwardHit) {
            const right = new Vector3(desired.z, 0, -desired.x);
            const left = right.scale(-1);
            const rightTarget = origin.add(right.scale(lookAhead));
            const leftTarget = origin.add(left.scale(lookAhead));
            const rightBlocked = this.raycastObstacle(origin, rightTarget);
            const leftBlocked = this.raycastObstacle(origin, leftTarget);

            let steer = right;
            if (rightBlocked && !leftBlocked) steer = left;
            else if (!rightBlocked && leftBlocked) steer = right;
            else if (rightBlocked && leftBlocked) steer = desired.scale(-0.35);
            else {
                // 两侧都通时，选更开阔或随机一侧轻微绕行。
                steer = (enemy.slotIndex + this.spawnSerial) % 2 === 0 ? right : left;
            }

            moveX = desired.x + steer.x * enemyConfig.avoidSteerStrength;
            moveZ = desired.z + steer.z * enemyConfig.avoidSteerStrength;
        }

        // 敌人互相分离，减少重叠。
        for (const other of this.enemies) {
            if (other === enemy) continue;
            const offset = enemy.model.root.position.subtract(other.model.root.position);
            offset.y = 0;
            const sep = offset.length();
            if (sep > 0.001 && sep < enemyConfig.separationDistance) {
                const push = (enemyConfig.separationDistance - sep) / enemyConfig.separationDistance;
                moveX += (offset.x / sep) * push * 0.85;
                moveZ += (offset.z / sep) * push * 0.85;
            }
        }

        const length = Math.hypot(moveX, moveZ);
        if (length < 0.0001) return desired;
        return new Vector3(moveX / length, 0, moveZ / length);
    }

    private raycastObstacle(from: Vector3, to: Vector3): boolean {
        const engine = this.scene.getPhysicsEngine();
        if (!engine) return false;
        const hit = engine.raycast(from, to);
        return Boolean(hit?.hasHit);
    }

    private isLineOfSightBlocked(from: Vector3, to: Vector3, distance: number): boolean {
        const engine = this.scene.getPhysicsEngine();
        if (!engine) return false;
        const start = from.add(new Vector3(0, 0.8, 0));
        const end = to.add(new Vector3(0, 0.8, 0));
        const hit = engine.raycast(start, end, {
            ignoreBody: this.player.physicsBody ?? undefined
        });
        return Boolean(hit?.hasHit && hit.hitDistance < distance - 0.15);
    }
}
