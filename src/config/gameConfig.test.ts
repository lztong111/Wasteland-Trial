import { describe, expect, it } from 'vitest';
import { gameConfig } from './gameConfig';

describe('游戏规则配置', () => {
    it('使用缩短后的跳跃冲量', () => {
        expect(gameConfig.player.jumpForce).toBe(5);
    });

    it('近战范围与视觉挥砍保持一致', () => {
        expect(gameConfig.combat.meleeRange).toBeGreaterThanOrEqual(1.5);
        expect(gameConfig.combat.meleeRange).toBeLessThanOrEqual(2.5);
    });

    it('闪避无敌时间不会超过动作持续时间', () => {
        expect(gameConfig.player.dodgeDurationSeconds).toBeGreaterThan(0);
        expect(gameConfig.player.dodgeInvulnerabilitySeconds).toBeGreaterThan(0);
        expect(gameConfig.player.dodgeInvulnerabilitySeconds)
            .toBeLessThanOrEqual(gameConfig.player.dodgeDurationSeconds);
        expect(gameConfig.player.dodgeStaminaCost).toBeGreaterThan(0);
    });

    it('三段连击配置的体力、伤害和时长数量一致', () => {
        expect(gameConfig.combat.meleeComboStaminaCosts).toHaveLength(3);
        expect(gameConfig.combat.meleeComboDamageMultipliers).toHaveLength(3);
        expect(gameConfig.combat.meleeComboSwingSeconds).toHaveLength(3);
        expect(gameConfig.combat.meleeComboDamageMultipliers[2])
            .toBeGreaterThan(gameConfig.combat.meleeComboDamageMultipliers[0]);
        expect(gameConfig.combat.heavyDamageMultiplier)
            .toBeGreaterThan(gameConfig.combat.meleeComboDamageMultipliers[2]);
    });

    it('遗迹试炼包含两波等量守卫', () => {
        expect(gameConfig.objective.guardianTarget).toBe(3);
        expect(gameConfig.objective.guardianWaveCount).toBe(2);
    });

    it('后续轮次的敌人数值成长均为正数', () => {
        expect(gameConfig.enemy.trialHealthGrowthPerRound).toBeGreaterThan(0);
        expect(gameConfig.enemy.trialDamageGrowthPerRound).toBeGreaterThan(0);
        expect(gameConfig.enemy.trialXpGrowthPerRound).toBeGreaterThan(0);
    });

    it('第一阶段敌人生命值为原值的四分之三提高后数值', () => {
        expect(gameConfig.enemy.maxHp).toBe(40);
        expect(gameConfig.enemy.maxHp / (4 / 3)).toBe(30);
    });
});
