import { describe, expect, it, vi } from 'vitest';
import { gameConfig } from '../config/gameConfig';
import { RPGManager } from './RPGManager';
import { SaveManager } from './SaveManager';

class MemoryStorage {
    private readonly data = new Map<string, string>();

    public getItem(key: string): string | null {
        return this.data.get(key) ?? null;
    }

    public setItem(key: string, value: string): void {
        this.data.set(key, value);
    }

    public removeItem(key: string): void {
        this.data.delete(key);
    }
}

class FailingStorage {
    public getItem(): string | null {
        throw new Error('禁止读取');
    }

    public setItem(): void {
        throw new Error('禁止写入');
    }

    public removeItem(): void {
        throw new Error('禁止删除');
    }
}

describe('SaveManager', () => {
    it('保存并恢复完整 RPG 状态', () => {
        const storage = new MemoryStorage();
        const source = new RPGManager();
        source.addXP(45);
        source.consumeStamina(25);
        new SaveManager(source, storage).flush();

        const target = new RPGManager();
        const result = new SaveManager(target, storage).load();

        expect(result).toBe('loaded');
        expect(target.stats).toEqual(source.stats);
        expect(target.inventory).toEqual(source.inventory);
        expect(target.equippedWeapon?.id).toBe(source.equippedWeapon?.id);
    });

    it('通过防抖计划保存最新状态', () => {
        vi.useFakeTimers();
        const storage = new MemoryStorage();
        const manager = new RPGManager();
        const saves = new SaveManager(manager, storage);

        manager.addXP(10);
        saves.scheduleSave();
        manager.addXP(5);
        saves.scheduleSave();
        vi.advanceTimersByTime(gameConfig.save.debounceMilliseconds);

        const rawSave = storage.getItem(gameConfig.save.storageKey);
        expect(rawSave).toContain('"currentXP":15');
        vi.useRealTimers();
    });

    it('删除无效存档并返回 invalid', () => {
        const storage = new MemoryStorage();
        storage.setItem(gameConfig.save.storageKey, JSON.stringify({
            version: gameConfig.save.version,
            savedAt: new Date().toISOString(),
            rpg: { stats: {} }
        }));

        const result = new SaveManager(new RPGManager(), storage).load();

        expect(result).toBe('invalid');
        expect(storage.getItem(gameConfig.save.storageKey)).toBeNull();
    });

    it('没有存档时返回 empty', () => {
        expect(new SaveManager(new RPGManager(), new MemoryStorage()).load()).toBe('empty');
    });

    it('没有可用存储时不抛出异常', () => {
        const manager = new SaveManager(new RPGManager(), null);

        expect(manager.load()).toBe('unavailable');
        expect(() => manager.scheduleSave()).not.toThrow();
        expect(() => manager.dispose()).not.toThrow();
    });

    it('存储实现抛出异常时仍保持游戏可用', () => {
        const saves = new SaveManager(new RPGManager(), new FailingStorage());

        expect(saves.load()).toBe('invalid');
        expect(() => saves.flush()).not.toThrow();
    });
});
