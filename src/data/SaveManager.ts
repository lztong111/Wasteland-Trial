import { gameConfig } from '../config/gameConfig';
import { RPGManager } from './RPGManager';

interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

interface GameSaveEnvelope {
    version: number;
    savedAt: string;
    rpg: unknown;
}

export type LoadResult = 'loaded' | 'empty' | 'invalid' | 'unavailable';

export class SaveManager {
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    public constructor(
        private readonly rpgManager: RPGManager,
        private readonly storage: StorageAdapter | null = SaveManager.resolveStorage()
    ) {}

    public load(): LoadResult {
        if (!this.storage) return 'unavailable';
        try {
            const rawSave = this.storage.getItem(gameConfig.save.storageKey);
            if (rawSave === null) return 'empty';
            const parsed = JSON.parse(rawSave) as Partial<GameSaveEnvelope>;
            if (parsed.version !== gameConfig.save.version || !parsed.savedAt || !('rpg' in parsed)) {
                throw new Error('存档版本或结构无效。');
            }
            this.rpgManager.restoreSaveState(parsed.rpg);
            return 'loaded';
        } catch {
            // 坏存档立即隔离，避免每次启动都重复失败。
            try {
                this.storage.removeItem(gameConfig.save.storageKey);
            } catch {
                // 存储实现可能在读取后被浏览器策略禁用，此时无需阻断游戏。
            }
            return 'invalid';
        }
    }

    public scheduleSave(): void {
        if (!this.storage) return;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.flush(), gameConfig.save.debounceMilliseconds);
    }

    public flush(): void {
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = null;
        if (!this.storage) return;

        const envelope: GameSaveEnvelope = {
            version: gameConfig.save.version,
            savedAt: new Date().toISOString(),
            rpg: this.rpgManager.createSaveState()
        };
        try {
            this.storage.setItem(gameConfig.save.storageKey, JSON.stringify(envelope));
        } catch {
            // 存储空间不足或隐私模式禁用存储时，游戏仍应继续运行。
        }
    }

    public dispose(): void {
        this.flush();
    }

    private static resolveStorage(): StorageAdapter | null {
        try {
            return globalThis.localStorage ?? null;
        } catch {
            return null;
        }
    }
}
