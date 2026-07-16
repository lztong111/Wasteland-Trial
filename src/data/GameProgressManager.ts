import { gameConfig } from '../config/gameConfig';
import { isTrialUpgradeId, type TrialUpgradeId } from './TrialUpgrades';

export type GamePhase = 'guardians' | 'chest' | 'reinforcements' | 'shrine' | 'victory';

export interface GameProgressState {
    phase: GamePhase;
    trialNumber: number;
    defeatedGuardians: number;
    chestOpened: boolean;
    shrineActivated: boolean;
    shrineReadyAt: number;
    victoryAcknowledged: boolean;
    upgradeSelected: boolean;
    selectedUpgradeId: TrialUpgradeId | null;
}

export interface ObjectiveView {
    phase: GamePhase;
    title: string;
    description: string;
    current?: number;
    target?: number;
    completed: boolean;
}

type Unsubscribe = () => void;

const createInitialState = (trialNumber = 1): GameProgressState => ({
    phase: 'guardians',
    trialNumber,
    defeatedGuardians: 0,
    chestOpened: false,
    shrineActivated: false,
    shrineReadyAt: 0,
    victoryAcknowledged: false,
    upgradeSelected: false,
    selectedUpgradeId: null
});

export class GameProgressManager {
    private state: GameProgressState = createInitialState();
    private snapshot: Readonly<GameProgressState> = Object.freeze({ ...this.state });
    private readonly listeners = new Set<() => void>();

    public constructor(private readonly now: () => number = () => Date.now()) {}

    public get progress(): Readonly<GameProgressState> {
        return this.snapshot;
    }

    public get objective(): ObjectiveView {
        const waveTarget = gameConfig.objective.guardianTarget;
        switch (this.state.phase) {
            case 'guardians':
                return {
                    phase: 'guardians',
                    title: '清除遗迹守卫',
                    description: '击败盘踞在古道上的怪物',
                    current: this.state.defeatedGuardians,
                    target: waveTarget,
                    completed: false
                };
            case 'chest':
                return {
                    phase: 'chest',
                    title: '搜索补给箱',
                    description: '沿古道寻找并开启补给箱',
                    completed: false
                };
            case 'reinforcements':
                return {
                    phase: 'reinforcements',
                    title: '击退遗迹增援',
                    description: '补给箱的机关惊动了第二波守卫',
                    current: this.state.defeatedGuardians - waveTarget,
                    target: waveTarget,
                    completed: false
                };
            case 'shrine':
                return {
                    phase: 'shrine',
                    title: '激活治愈神龛',
                    description: '在神龛前按 E 完成试炼',
                    completed: false
                };
            case 'victory':
                return {
                    phase: 'victory',
                    title: '遗迹试炼完成',
                    description: '守卫已经肃清，古道恢复平静',
                    completed: true
                };
        }
    }

    public get shouldSpawnGuardians(): boolean {
        return this.state.phase === 'guardians' || this.state.phase === 'reinforcements';
    }

    public get guardiansRemainingInCurrentWave(): number {
        if (this.state.phase === 'guardians') {
            return Math.max(0, gameConfig.objective.guardianTarget - this.state.defeatedGuardians);
        }
        if (this.state.phase === 'reinforcements') {
            return Math.max(0, this.totalGuardianTarget - this.state.defeatedGuardians);
        }
        return 0;
    }

    public get canOpenChest(): boolean {
        return this.state.phase === 'chest';
    }

    public get canActivateShrine(): boolean {
        return this.state.phase === 'shrine' || this.state.phase === 'victory';
    }

    public get shrineCooldownRemainingSeconds(): number {
        return Math.max(0, (this.state.shrineReadyAt - this.now()) / 1000);
    }

    public recordGuardianDefeated(): void {
        if (!this.shouldSpawnGuardians) return;
        this.state.defeatedGuardians = Math.min(
            this.totalGuardianTarget,
            this.state.defeatedGuardians + 1
        );
        this.recalculatePhase();
        this.commit();
    }

    public recordChestOpened(): void {
        if (!this.canOpenChest) throw new Error('守卫尚未清除，补给箱仍被封印。');
        this.state.chestOpened = true;
        this.recalculatePhase();
        this.commit();
    }

    public recordShrineActivated(cooldownSeconds: number): void {
        if (!this.canActivateShrine) {
            throw new Error(this.state.chestOpened ? '必须先清除第二波守卫。' : '必须先开启补给箱。');
        }
        if (!Number.isFinite(cooldownSeconds) || cooldownSeconds < 0) {
            throw new RangeError('神龛冷却时间无效。');
        }
        this.state.shrineActivated = true;
        this.state.shrineReadyAt = this.now() + cooldownSeconds * 1000;
        this.recalculatePhase();
        this.commit();
    }

    public startNextTrial(): void {
        if (this.state.phase !== 'victory') return;
        if (!this.state.upgradeSelected) throw new Error('必须先选择一项试炼升级。');
        this.state = createInitialState(this.state.trialNumber + 1);
        this.commit();
    }

    public selectUpgrade(upgradeId: TrialUpgradeId): void {
        if (this.state.phase !== 'victory') throw new Error('只有完成试炼后才能选择升级。');
        if (this.state.upgradeSelected) throw new Error('本轮试炼升级已经选择。');
        if (!isTrialUpgradeId(upgradeId)) throw new TypeError('试炼升级选项无效。');
        this.state.upgradeSelected = true;
        this.state.selectedUpgradeId = upgradeId;
        this.commit();
    }

    public subscribe(callback: () => void): Unsubscribe {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    public createSaveState(): GameProgressState {
        return { ...this.state };
    }

    public restoreSaveState(value: unknown): void {
        if (!value || typeof value !== 'object') throw new TypeError('关卡存档必须是对象。');
        const candidate = value as Partial<GameProgressState>;
        const trialNumber = candidate.trialNumber ?? 1;
        if (!Number.isInteger(trialNumber) || trialNumber < 1) {
            throw new RangeError('试炼轮次无效。');
        }
        if (!Number.isInteger(candidate.defeatedGuardians)
            || candidate.defeatedGuardians! < 0
            || candidate.defeatedGuardians! > this.totalGuardianTarget) {
            throw new RangeError('击败守卫数量无效。');
        }
        if (typeof candidate.chestOpened !== 'boolean'
            || typeof candidate.shrineActivated !== 'boolean'
            || typeof candidate.victoryAcknowledged !== 'boolean') {
            throw new TypeError('关卡标记无效。');
        }
        if (!Number.isFinite(candidate.shrineReadyAt) || candidate.shrineReadyAt! < 0) {
            throw new RangeError('神龛冷却时间无效。');
        }
        if (candidate.chestOpened
            && candidate.defeatedGuardians! < gameConfig.objective.guardianTarget) {
            throw new Error('关卡存档中补给箱开启顺序无效。');
        }
        if (candidate.shrineActivated
            && (!candidate.chestOpened || candidate.defeatedGuardians! < this.totalGuardianTarget)) {
            throw new Error('关卡存档中神龛激活顺序无效。');
        }
        if (candidate.victoryAcknowledged && !candidate.shrineActivated) {
            throw new Error('关卡存档中胜利确认顺序无效。');
        }
        const upgradeSelected = candidate.upgradeSelected ?? false;
        const selectedUpgradeId = candidate.selectedUpgradeId ?? null;
        if (typeof upgradeSelected !== 'boolean'
            || (upgradeSelected && !isTrialUpgradeId(selectedUpgradeId))
            || (!upgradeSelected && selectedUpgradeId !== null)) {
            throw new Error('关卡存档中试炼升级状态无效。');
        }

        this.state = {
            phase: 'guardians',
            trialNumber,
            defeatedGuardians: candidate.defeatedGuardians!,
            chestOpened: candidate.chestOpened,
            shrineActivated: candidate.shrineActivated,
            shrineReadyAt: candidate.shrineReadyAt!,
            victoryAcknowledged: candidate.victoryAcknowledged,
            upgradeSelected,
            selectedUpgradeId
        };
        this.recalculatePhase();
        if (this.state.phase === 'victory' && this.state.victoryAcknowledged) {
            // 兼容旧版“继续探索”只关闭弹窗的存档，直接推进到下一轮。
            this.state = createInitialState(this.state.trialNumber + 1);
        }
        this.commit();
    }

    private recalculatePhase(): void {
        if (this.state.defeatedGuardians < gameConfig.objective.guardianTarget) {
            this.state.phase = 'guardians';
        } else if (!this.state.chestOpened) {
            this.state.phase = 'chest';
        } else if (this.state.defeatedGuardians < this.totalGuardianTarget) {
            this.state.phase = 'reinforcements';
        } else if (!this.state.shrineActivated) {
            this.state.phase = 'shrine';
        } else {
            this.state.phase = 'victory';
        }
    }

    private get totalGuardianTarget(): number {
        return gameConfig.objective.guardianTarget * gameConfig.objective.guardianWaveCount;
    }

    private commit(): void {
        this.snapshot = Object.freeze({ ...this.state });
        this.listeners.forEach(callback => callback());
    }
}
