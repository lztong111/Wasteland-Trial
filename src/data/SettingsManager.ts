import { gameConfig } from '../config/gameConfig';

export interface GameSettings {
    mouseSensitivity: number;
    invertY: boolean;
    masterVolume: number;
    muted: boolean;
}

interface StorageAdapter {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

type Unsubscribe = () => void;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function createDefaultSettings(): GameSettings {
    return {
        mouseSensitivity: gameConfig.settings.defaultMouseSensitivity,
        invertY: false,
        masterVolume: gameConfig.settings.defaultMasterVolume,
        muted: !gameConfig.audio.enabledByDefault
    };
}

export class SettingsManager {
    private settingsState: GameSettings = createDefaultSettings();
    private snapshot: Readonly<GameSettings> = Object.freeze({ ...this.settingsState });
    private readonly listeners = new Set<() => void>();

    public constructor(
        private readonly storage: StorageAdapter | null = SettingsManager.resolveStorage()
    ) {
        this.load();
    }

    public get settings(): Readonly<GameSettings> {
        return this.snapshot;
    }

    public load(): void {
        if (!this.storage) return;
        try {
            const raw = this.storage.getItem(gameConfig.settings.storageKey);
            if (!raw) return;
            const parsed = JSON.parse(raw) as Partial<GameSettings>;
            this.apply({
                mouseSensitivity: typeof parsed.mouseSensitivity === 'number'
                    ? parsed.mouseSensitivity
                    : this.settingsState.mouseSensitivity,
                invertY: typeof parsed.invertY === 'boolean'
                    ? parsed.invertY
                    : this.settingsState.invertY,
                masterVolume: typeof parsed.masterVolume === 'number'
                    ? parsed.masterVolume
                    : this.settingsState.masterVolume,
                muted: typeof parsed.muted === 'boolean'
                    ? parsed.muted
                    : this.settingsState.muted
            }, false);
        } catch {
            // 坏设置文件忽略，回退默认。
        }
    }

    public update(partial: Partial<GameSettings>): void {
        this.apply({
            mouseSensitivity: partial.mouseSensitivity ?? this.settingsState.mouseSensitivity,
            invertY: partial.invertY ?? this.settingsState.invertY,
            masterVolume: partial.masterVolume ?? this.settingsState.masterVolume,
            muted: partial.muted ?? this.settingsState.muted
        }, true);
    }

    public subscribe(callback: () => void): Unsubscribe {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    private apply(next: GameSettings, persist: boolean): void {
        this.settingsState = {
            mouseSensitivity: clamp(
                next.mouseSensitivity,
                gameConfig.settings.minMouseSensitivity,
                gameConfig.settings.maxMouseSensitivity
            ),
            invertY: Boolean(next.invertY),
            masterVolume: clamp(next.masterVolume, 0, 1),
            muted: Boolean(next.muted)
        };
        this.snapshot = Object.freeze({ ...this.settingsState });
        this.listeners.forEach(listener => listener());
        if (persist) this.persist();
    }

    private persist(): void {
        if (!this.storage) return;
        try {
            this.storage.setItem(gameConfig.settings.storageKey, JSON.stringify(this.settingsState));
        } catch {
            // 隐私模式等场景下忽略。
        }
    }

    private static resolveStorage(): StorageAdapter | null {
        try {
            return globalThis.localStorage ?? null;
        } catch {
            return null;
        }
    }
}
