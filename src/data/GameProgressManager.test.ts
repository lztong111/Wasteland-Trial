import { describe, expect, it, vi } from 'vitest';
import { GameProgressManager } from './GameProgressManager';

describe('GameProgressManager', () => {
    it('按第一波、宝箱、第二波、神龛顺序推进到胜利', () => {
        const manager = new GameProgressManager(() => 1_000);
        expect(manager.objective.phase).toBe('guardians');

        manager.recordGuardianDefeated();
        manager.recordGuardianDefeated();
        manager.recordGuardianDefeated();
        expect(manager.objective.phase).toBe('chest');

        manager.recordChestOpened();
        expect(manager.objective.phase).toBe('reinforcements');
        expect(manager.objective.current).toBe(0);

        manager.recordGuardianDefeated();
        manager.recordGuardianDefeated();
        manager.recordGuardianDefeated();
        expect(manager.objective.phase).toBe('shrine');

        manager.recordShrineActivated(12);
        expect(manager.objective.phase).toBe('victory');
        expect(manager.shrineCooldownRemainingSeconds).toBe(12);

        expect(() => manager.startNextTrial()).toThrow(/升级/);
        manager.selectUpgrade('vitality');
        manager.startNextTrial();
        expect(manager.progress.trialNumber).toBe(2);
        expect(manager.objective.phase).toBe('guardians');
        expect(manager.progress.defeatedGuardians).toBe(0);
        expect(manager.progress.chestOpened).toBe(false);
    });

    it('每轮只能选择一次合法升级', () => {
        const manager = new GameProgressManager();
        for (let index = 0; index < 3; index += 1) manager.recordGuardianDefeated();
        manager.recordChestOpened();
        for (let index = 0; index < 3; index += 1) manager.recordGuardianDefeated();
        manager.recordShrineActivated(0);

        manager.selectUpgrade('power');
        expect(manager.progress.selectedUpgradeId).toBe('power');
        expect(() => manager.selectUpgrade('endurance')).toThrow(/已经选择/);
    });

    it('拒绝越过关卡顺序', () => {
        const manager = new GameProgressManager();
        expect(() => manager.recordChestOpened()).toThrow(/守卫/);
        expect(() => manager.recordShrineActivated(12)).toThrow(/补给箱/);

        manager.recordGuardianDefeated();
        manager.recordGuardianDefeated();
        manager.recordGuardianDefeated();
        manager.recordChestOpened();
        expect(() => manager.recordShrineActivated(12)).toThrow(/第二波/);
    });

    it('可保存恢复关卡状态并通知订阅者', () => {
        const source = new GameProgressManager();
        const listener = vi.fn();
        source.subscribe(listener);
        source.recordGuardianDefeated();

        const target = new GameProgressManager();
        target.restoreSaveState(source.createSaveState());

        expect(target.progress.defeatedGuardians).toBe(1);
        expect(target.objective.current).toBe(1);
        expect(listener).toHaveBeenCalledOnce();
    });

    it('拒绝损坏的关卡存档', () => {
        expect(() => new GameProgressManager().restoreSaveState({
            defeatedGuardians: 99,
            chestOpened: false,
            shrineActivated: false,
            shrineReadyAt: 0,
            victoryAcknowledged: false
        })).toThrow(RangeError);
    });

    it('拒绝旧版单波胜利状态冒充新版完成状态', () => {
        const manager = new GameProgressManager();
        expect(() => manager.restoreSaveState({
            defeatedGuardians: 3,
            chestOpened: true,
            shrineActivated: true,
            shrineReadyAt: 0,
            victoryAcknowledged: true
        })).toThrow(/神龛/);
        expect(manager.objective.phase).toBe('guardians');
    });

    it('读取旧的胜利确认状态时自动进入下一轮', () => {
        const manager = new GameProgressManager();
        manager.restoreSaveState({
            trialNumber: 3,
            defeatedGuardians: 6,
            chestOpened: true,
            shrineActivated: true,
            shrineReadyAt: 0,
            victoryAcknowledged: true
        });

        expect(manager.progress.trialNumber).toBe(4);
        expect(manager.objective.phase).toBe('guardians');
        expect(manager.progress.defeatedGuardians).toBe(0);
    });
});
