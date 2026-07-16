import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig';
import { GameProgressManager } from '../data/GameProgressManager';
import { RPGManager } from '../data/RPGManager';
import { ItemType, type Consumable } from '../data/RPGTypes';
import type { Player } from '../entities/Player';
import type { CombatFeedbackHandler } from '../ui/feedback';
import type { AudioManager } from './AudioManager';
import { InteractionManager } from './InteractionManager';

function createChestScenario(withDuplicateReward: boolean) {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const rpgManager = new RPGManager();
    const progressManager = new GameProgressManager();
    for (let index = 0; index < gameConfig.objective.guardianTarget; index += 1) {
        progressManager.recordGuardianDefeated();
    }

    if (withDuplicateReward) {
        const duplicatePotion: Consumable = {
            id: gameConfig.world.chestPotionId,
            name: '已有药水',
            type: ItemType.CONSUMABLE,
            icon: '🧪',
            description: '用于验证重复奖励。',
            healAmount: 10
        };
        rpgManager.addItem(duplicatePotion);
    }

    const feedback = vi.fn<CombatFeedbackHandler>();
    const player = {
        mesh: {
            getAbsolutePosition: () => new Vector3(3.2, 0, -2.8)
        }
    } as unknown as Player;
    const audio = { play: vi.fn() } as unknown as AudioManager;
    const manager = new InteractionManager(
        scene,
        rpgManager,
        player,
        feedback,
        audio,
        progressManager
    );
    manager.update(0);

    return { engine, scene, rpgManager, progressManager, feedback, manager };
}

describe('InteractionManager', () => {
    it('开启补给箱后加入药水并推进任务', () => {
        const scenario = createChestScenario(false);
        try {
            expect(scenario.manager.tryInteract()).toBe(true);
            expect(scenario.rpgManager.inventory.some(
                item => item.id === gameConfig.world.chestPotionId
            )).toBe(true);
            expect(scenario.progressManager.objective.phase).toBe('reinforcements');
            expect(scenario.feedback).toHaveBeenCalledWith({
                type: 'toast',
                text: '获得宝箱生命药水',
                kind: 'system'
            });
            expect(scenario.feedback).toHaveBeenCalledWith({
                type: 'float',
                text: '+药水',
                kind: 'xp'
            });

            for (let index = 0; index < gameConfig.objective.guardianTarget; index += 1) {
                scenario.progressManager.recordGuardianDefeated();
            }
            scenario.progressManager.recordShrineActivated(0);
            scenario.progressManager.selectUpgrade('power');
            scenario.progressManager.startNextTrial();
            scenario.manager.update(0);
            expect(scenario.manager.getPrompt()?.label).toContain('补给箱被封印');
        } finally {
            scenario.manager.dispose();
            scenario.scene.dispose();
            scenario.engine.dispose();
        }
    });

    it('已有同编号药水时给出准确反馈且不伪造奖励浮字', () => {
        const scenario = createChestScenario(true);
        try {
            expect(scenario.manager.tryInteract()).toBe(true);
            expect(scenario.progressManager.objective.phase).toBe('reinforcements');
            expect(scenario.feedback).toHaveBeenCalledWith({
                type: 'toast',
                text: '补给箱已开启，背包中已有同类药水',
                kind: 'warning'
            });
            expect(scenario.feedback).not.toHaveBeenCalledWith(
                expect.objectContaining({ type: 'float' })
            );
        } finally {
            scenario.manager.dispose();
            scenario.scene.dispose();
            scenario.engine.dispose();
        }
    });
});
