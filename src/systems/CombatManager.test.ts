import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig';
import { RPGManager } from '../data/RPGManager';
import type { Player } from '../entities/Player';
import type { CombatFeedbackHandler } from '../ui/feedback';
import type { AudioManager } from './AudioManager';
import { CombatManager } from './CombatManager';
import type { EnemyManager } from './EnemyManager';

function createCombatScenario() {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const weaponAnchor = new TransformNode('testWeaponAnchor', scene);
    const damageEnemiesInCone = vi.fn((
        _position: Vector3,
        _forward: Vector3,
        _range: number,
        _halfAngle: number,
        _damage: number
    ) => 1);
    const player = {
        weaponAnchor,
        mesh: { getAbsolutePosition: () => Vector3.Zero() },
        getForwardDirection: () => new Vector3(0, 0, 1),
        isDodging: false
    } as unknown as Player;
    const enemyManager = { damageEnemiesInCone } as unknown as EnemyManager;
    const rpgManager = new RPGManager();
    const feedback = vi.fn<CombatFeedbackHandler>();
    const audio = { play: vi.fn() } as unknown as AudioManager;
    const manager = new CombatManager(
        scene,
        rpgManager,
        player,
        enemyManager,
        feedback,
        audio
    );
    return {
        engine,
        scene,
        rpgManager,
        feedback,
        damageEnemiesInCone,
        manager
    };
}

describe('CombatManager', () => {
    it('快速输入三次轻击时依次结算三段倍率和体力', () => {
        const scenario = createCombatScenario();
        try {
            scenario.manager.triggerMeleeAttack();
            scenario.manager.triggerMeleeAttack();
            scenario.manager.triggerMeleeAttack();

            scenario.manager.update(gameConfig.combat.meleeComboSwingSeconds[0]);
            scenario.manager.update(gameConfig.combat.meleeComboSwingSeconds[1]);
            scenario.manager.update(gameConfig.combat.meleeComboSwingSeconds[2] / 2);

            const baseDamage = scenario.rpgManager.getTotalDamage();
            expect(scenario.damageEnemiesInCone.mock.calls.map(call => call[4])).toEqual(
                gameConfig.combat.meleeComboDamageMultipliers.map(
                    multiplier => baseDamage * multiplier
                )
            );
            expect(scenario.rpgManager.stats.stamina).toBe(
                100 - gameConfig.combat.meleeComboStaminaCosts.reduce((sum, cost) => sum + cost, 0)
            );
        } finally {
            scenario.manager.dispose();
            scenario.scene.dispose();
            scenario.engine.dispose();
        }
    });

    it('重击使用更大范围和双倍伤害', () => {
        const scenario = createCombatScenario();
        try {
            scenario.manager.triggerHeavyAttack();
            scenario.manager.update(gameConfig.combat.heavySwingSeconds / 2);

            const call = scenario.damageEnemiesInCone.mock.calls[0];
            expect(call[2]).toBe(gameConfig.combat.heavyRange);
            expect(call[4]).toBe(
                scenario.rpgManager.getTotalDamage() * gameConfig.combat.heavyDamageMultiplier
            );
            expect(scenario.rpgManager.stats.stamina)
                .toBe(100 - gameConfig.combat.heavyStaminaCost);
            expect(scenario.feedback).toHaveBeenCalledWith({
                type: 'toast',
                text: '蓄力重击',
                kind: 'combat'
            });
        } finally {
            scenario.manager.dispose();
            scenario.scene.dispose();
            scenario.engine.dispose();
        }
    });
});
