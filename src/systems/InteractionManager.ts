import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.pure';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.pure';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Scene } from '@babylonjs/core/scene';
import { gameConfig } from '../config/gameConfig';
import type { Consumable } from '../data/RPGTypes';
import { ItemType } from '../data/RPGTypes';
import type { RPGManager } from '../data/RPGManager';
import type { Player } from '../entities/Player';
import type { CombatFeedbackHandler } from '../ui/feedback';
import type { AudioManager } from './AudioManager';
import type { GameProgressManager } from '../data/GameProgressManager';

type InteractableKind = 'shrine' | 'chest';

interface Interactable {
    id: string;
    kind: InteractableKind;
    mesh: Mesh;
    material: StandardMaterial;
    position: Vector3;
    radius: number;
    label: string;
    cooldownSeconds: number;
    consumed: boolean;
}

export interface InteractPrompt {
    label: string;
    id: string;
}

export class InteractionManager {
    private readonly interactables: Interactable[] = [];
    private readonly materials: StandardMaterial[] = [];
    private nearest: Interactable | null = null;
    private syncedTrialNumber = 1;

    public constructor(
        private readonly scene: Scene,
        private readonly rpgManager: RPGManager,
        private readonly player: Player,
        private readonly onFeedback: CombatFeedbackHandler,
        private readonly audio: AudioManager,
        private readonly progressManager: GameProgressManager | null = null
    ) {
        this.createShrine(new Vector3(-2.5, 0, 3.5));
        this.createChest(new Vector3(3.2, 0, -2.8));
        this.syncedTrialNumber = this.progressManager?.progress.trialNumber ?? 1;
    }

    public update(_deltaSeconds: number): void {
        this.syncTrialState();
        for (const item of this.interactables) {
            if (!this.progressManager) {
                item.cooldownSeconds = Math.max(0, item.cooldownSeconds - _deltaSeconds);
            }
            if (item.kind === 'shrine') {
                const ready = this.getCooldownSeconds(item) === 0;
                item.material.emissiveColor = ready
                    ? new Color3(0.15, 0.75, 0.55)
                    : new Color3(0.05, 0.2, 0.18);
            }
        }

        const playerPos = this.player.mesh.getAbsolutePosition();
        let best: Interactable | null = null;
        let bestDist: number = gameConfig.world.interactRange;
        for (const item of this.interactables) {
            if (item.consumed) continue;
            const dx = item.position.x - playerPos.x;
            const dz = item.position.z - playerPos.z;
            const dist = Math.hypot(dx, dz);
            if (dist <= bestDist) {
                bestDist = dist;
                best = item;
            }
        }
        this.nearest = best;
    }

    public getPrompt(): InteractPrompt | null {
        if (!this.nearest || this.nearest.consumed) return null;
        if (this.nearest.kind === 'chest' && this.progressManager && !this.progressManager.canOpenChest) {
            return { id: this.nearest.id, label: '补给箱被封印 · 先清除守卫' };
        }
        if (this.nearest.kind === 'shrine'
            && this.progressManager
            && !this.progressManager.canActivateShrine) {
            return {
                id: this.nearest.id,
                label: this.progressManager.progress.chestOpened
                    ? '神龛沉寂 · 先清除增援'
                    : '神龛沉寂 · 先开启补给箱'
            };
        }
        const cooldownSeconds = this.getCooldownSeconds(this.nearest);
        if (cooldownSeconds > 0) {
            return {
                id: this.nearest.id,
                label: `${this.nearest.label}（冷却 ${Math.ceil(cooldownSeconds)}s）`
            };
        }
        return { id: this.nearest.id, label: `按 E ${this.nearest.label}` };
    }

    public tryInteract(): boolean {
        const target = this.nearest;
        if (!target || target.consumed || this.getCooldownSeconds(target) > 0) return false;

        if (target.kind === 'chest' && this.progressManager && !this.progressManager.canOpenChest) {
            this.onFeedback({ type: 'toast', text: '补给箱仍被守卫封印', kind: 'warning' });
            return true;
        }
        if (target.kind === 'shrine'
            && this.progressManager
            && !this.progressManager.canActivateShrine) {
            this.onFeedback({
                type: 'toast',
                text: this.progressManager.progress.chestOpened
                    ? '必须先清除第二波守卫'
                    : '神龛尚未回应',
                kind: 'warning'
            });
            return true;
        }

        if (target.kind === 'shrine') {
            const before = this.rpgManager.stats.hp;
            this.rpgManager.heal(gameConfig.world.shrineHealAmount);
            const healed = this.rpgManager.stats.hp - before;
            if (this.progressManager) {
                this.progressManager.recordShrineActivated(gameConfig.world.shrineCooldownSeconds);
            } else {
                target.cooldownSeconds = gameConfig.world.shrineCooldownSeconds;
            }
            this.audio.play(healed > 0 ? 'heal' : 'ui');
            this.onFeedback({
                type: 'toast',
                text: healed > 0 ? `神龛恢复 ${healed} 生命` : '生命已满',
                kind: healed > 0 ? 'system' : 'warning'
            });
            return true;
        }

        if (target.kind === 'chest') {
            const potion: Consumable = {
                id: gameConfig.world.chestPotionId,
                name: '宝箱生命药水',
                type: ItemType.CONSUMABLE,
                icon: '🧪',
                description: '从宝箱中获得的浓缩药剂，恢复大量生命。',
                healAmount: 50
            };
            let rewardAdded = false;
            try {
                this.rpgManager.addItem(potion);
                rewardAdded = true;
            } catch {
                // 宝箱仍要推进关卡，但不能在奖励未加入背包时误报“获得药水”。
            }
            target.consumed = true;
            target.mesh.setEnabled(false);
            this.progressManager?.recordChestOpened();
            this.audio.play('pickup');
            this.onFeedback({
                type: 'toast',
                text: rewardAdded ? '获得宝箱生命药水' : '补给箱已开启，背包中已有同类药水',
                kind: rewardAdded ? 'system' : 'warning'
            });
            if (rewardAdded) {
                this.onFeedback({ type: 'float', text: '+药水', kind: 'xp' });
            }
            return true;
        }

        return false;
    }

    public dispose(): void {
        for (const item of this.interactables.splice(0)) {
            item.mesh.dispose();
        }
        for (const material of this.materials.splice(0)) {
            material.dispose();
        }
        this.nearest = null;
    }

    private createShrine(position: Vector3): void {
        const material = new StandardMaterial('shrineMaterial', this.scene);
        material.diffuseColor = new Color3(0.2, 0.45, 0.4);
        material.emissiveColor = new Color3(0.15, 0.75, 0.55);
        material.specularColor = Color3.Black();
        this.materials.push(material);

        const base = CreateCylinder('healShrine', { height: 0.35, diameter: 1.4, tessellation: 10 }, this.scene);
        base.position = position.add(new Vector3(0, 0.18, 0));
        base.material = material;
        base.isPickable = false;

        const pillar = CreateCylinder('healShrinePillar', { height: 1.2, diameter: 0.35, tessellation: 8 }, this.scene);
        pillar.position = position.add(new Vector3(0, 0.95, 0));
        pillar.material = material;
        pillar.isPickable = false;
        pillar.parent = base;

        this.interactables.push({
            id: 'shrine_heal',
            kind: 'shrine',
            mesh: base,
            material,
            position: position.clone(),
            radius: gameConfig.world.interactRange,
            label: '祈祷恢复',
            cooldownSeconds: 0,
            consumed: false
        });
    }

    private createChest(position: Vector3): void {
        const material = new StandardMaterial('chestMaterial', this.scene);
        material.diffuseColor = new Color3(0.45, 0.28, 0.12);
        material.emissiveColor = new Color3(0.12, 0.08, 0.02);
        material.specularColor = new Color3(0.1, 0.08, 0.04);
        this.materials.push(material);

        const body = CreateBox('lootChest', { width: 1.1, height: 0.7, depth: 0.75 }, this.scene);
        body.position = position.add(new Vector3(0, 0.35, 0));
        body.material = material;
        body.isPickable = false;

        const lid = CreateBox('lootChestLid', { width: 1.15, height: 0.18, depth: 0.8 }, this.scene);
        lid.position = new Vector3(0, 0.4, 0);
        lid.material = material;
        lid.parent = body;
        lid.isPickable = false;

        this.interactables.push({
            id: 'chest_starter',
            kind: 'chest',
            mesh: body,
            material,
            position: position.clone(),
            radius: gameConfig.world.interactRange,
            label: '开启宝箱',
            cooldownSeconds: 0,
            consumed: this.progressManager?.progress.chestOpened ?? false
        });
        if (this.progressManager?.progress.chestOpened) body.setEnabled(false);
    }

    private getCooldownSeconds(item: Interactable): number {
        if (item.kind === 'shrine' && this.progressManager) {
            return this.progressManager.shrineCooldownRemainingSeconds;
        }
        return item.cooldownSeconds;
    }

    private syncTrialState(): void {
        if (!this.progressManager) return;
        const trialNumber = this.progressManager.progress.trialNumber;
        if (trialNumber === this.syncedTrialNumber) return;

        this.syncedTrialNumber = trialNumber;
        for (const item of this.interactables) {
            if (item.kind !== 'chest') continue;
            item.consumed = this.progressManager.progress.chestOpened;
            item.mesh.setEnabled(!item.consumed);
        }
        this.nearest = null;
    }
}
