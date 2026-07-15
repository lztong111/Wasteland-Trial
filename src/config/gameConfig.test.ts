import { describe, expect, it } from 'vitest';
import { gameConfig } from './gameConfig';

describe('游戏规则配置', () => {
    it('使用缩短后的跳跃冲量', () => {
        expect(gameConfig.player.jumpForce).toBe(5);
    });

    it('近战范围是原始范围的两倍', () => {
        expect(gameConfig.combat.meleeRange).toBe(4);
    });
});
