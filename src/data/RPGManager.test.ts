import { describe, expect, it, vi } from 'vitest';
import { RPGManager } from './RPGManager';
import { ItemType, type Item, type Weapon } from './RPGTypes';

const ironSword: Weapon = {
    id: 'wpn_iron_sword_01',
    name: '铁剑',
    type: ItemType.WEAPON_MELEE,
    icon: '⚔️',
    description: '用于测试的铁剑。',
    damage: 12
};

describe('RPGManager', () => {
    it('支持一次获得大量经验时连续升级并保留正确余量', () => {
        const manager = new RPGManager();

        manager.addXP(250);

        expect(manager.stats).toMatchObject({
            level: 3,
            currentXP: 0,
            maxXP: 225,
            maxHp: 140,
            hp: 140,
            baseDamage: 14
        });
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('拒绝非法经验值 %s', (amount) => {
        const manager = new RPGManager();

        expect(() => manager.addXP(amount)).toThrow(RangeError);
    });

    it('伤害不会让生命值越界，并拒绝非法伤害', () => {
        const manager = new RPGManager();

        expect(manager.takeDamage(150)).toBe(true);
        expect(manager.stats.hp).toBe(0);
        expect(() => manager.takeDamage(-1)).toThrow(RangeError);
    });

    it('受击后进入无敌时间，期间不再扣血', () => {
        const manager = new RPGManager();

        expect(manager.takeDamage(20)).toBe(true);
        expect(manager.stats.hp).toBe(80);
        expect(manager.isInvulnerable).toBe(true);
        expect(manager.takeDamage(20)).toBe(false);
        expect(manager.stats.hp).toBe(80);

        manager.update(1);
        expect(manager.isInvulnerable).toBe(false);
        expect(manager.takeDamage(10)).toBe(true);
        expect(manager.stats.hp).toBe(70);
    });

    it('可以使用消耗品恢复生命并移除物品', () => {
        const manager = new RPGManager();
        manager.takeDamage(40);
        manager.update(1);

        const potion = manager.inventory.find(item => item.type === ItemType.CONSUMABLE);
        expect(potion).toBeDefined();
        const result = manager.useConsumable(potion!.id);

        expect(result.healed).toBe(35);
        expect(manager.stats.hp).toBe(95);
        expect(manager.inventory.some(item => item.id === potion!.id)).toBe(false);
    });

    it('死亡后可复活并恢复生命和体力', () => {
        const manager = new RPGManager();
        manager.consumeStamina(60);
        manager.takeDamage(100);

        expect(manager.isDead).toBe(true);
        manager.revive();

        expect(manager.isDead).toBe(false);
        expect(manager.stats.hp).toBe(manager.stats.maxHp);
        expect(manager.stats.stamina).toBe(manager.stats.maxStamina);
    });

    it('治疗不会超过生命上限，死亡状态下不能治疗', () => {
        const manager = new RPGManager();
        manager.takeDamage(20);
        manager.heal(100);
        expect(manager.stats.hp).toBe(manager.stats.maxHp);

        // 等无敌帧结束后再结算致命伤害。
        manager.update(1);
        manager.takeDamage(manager.stats.maxHp);
        manager.heal(10);
        expect(manager.stats.hp).toBe(0);
        expect(() => manager.heal(Number.NaN)).toThrow(RangeError);
    });

    it('通过领域方法消费和恢复体力，且不会超过上限', () => {
        const manager = new RPGManager();

        expect(manager.consumeStamina(30)).toBe(true);
        expect(manager.consumeStamina(80)).toBe(false);
        manager.restoreStamina(100);

        expect(manager.stats.stamina).toBe(manager.stats.maxStamina);
    });

    it('只暴露冻结快照，外部无法直接修改属性和背包', () => {
        const manager = new RPGManager();

        expect(Object.isFrozen(manager.stats)).toBe(true);
        expect(Object.isFrozen(manager.inventory)).toBe(true);
        expect(Object.isFrozen(manager.inventory[0])).toBe(true);
    });

    it('订阅函数返回取消订阅方法', () => {
        const manager = new RPGManager();
        const listener = vi.fn();
        const unsubscribe = manager.subscribeStats(listener);

        manager.addXP(10);
        unsubscribe();
        manager.addXP(10);

        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('只允许装备背包中的武器，并正确计算总伤害', () => {
        const manager = new RPGManager();

        expect(() => manager.equipWeapon(ironSword.id)).toThrow(Error);
        manager.addItem(ironSword);
        manager.equipWeapon(ironSword.id);

        expect(manager.getTotalDamage()).toBe(22);
    });

    it('拒绝重复、缺少编号或数值非法的物品', () => {
        const manager = new RPGManager();

        expect(() => manager.addItem(manager.inventory[0] as Item)).toThrow(/已存在/);
        expect(() => manager.addItem({ ...ironSword, id: '' })).toThrow(TypeError);
        const invalidWeapon: Weapon = { ...ironSword, id: 'bad_damage', damage: -1 };
        expect(() => manager.addItem(invalidWeapon)).toThrow(RangeError);
    });

    it('背包订阅可以取消，空体力操作保持边界', () => {
        const manager = new RPGManager();
        const listener = vi.fn();
        const unsubscribe = manager.subscribeInventory(listener);

        manager.addItem(ironSword);
        unsubscribe();
        expect(manager.consumeStamina(0)).toBe(true);
        manager.restoreStamina(0);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(manager.stats.stamina).toBe(manager.stats.maxStamina);
    });

    it('恢复存档前完整校验，非法存档不会污染当前状态', () => {
        const manager = new RPGManager();
        const original = manager.createSaveState();
        const invalid = {
            ...original,
            stats: { ...original.stats, hp: original.stats.maxHp + 1 }
        };

        expect(() => manager.restoreSaveState(invalid)).toThrow(RangeError);
        expect(manager.createSaveState()).toEqual(original);
    });

    it.each([
        null,
        {},
        { stats: { level: 0 }, inventory: [], equippedWeaponId: null }
    ])('拒绝结构无效的存档 %#', (invalid) => {
        expect(() => new RPGManager().restoreSaveState(invalid)).toThrow();
    });

    it('允许恢复没有装备的合法存档', () => {
        const manager = new RPGManager();
        const state = manager.createSaveState();
        state.equippedWeaponId = null;

        manager.restoreSaveState(state);

        expect(manager.equippedWeapon).toBeNull();
        expect(manager.getTotalDamage()).toBe(manager.stats.baseDamage);
    });
});
