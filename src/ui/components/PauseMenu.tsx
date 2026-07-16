import type { GameSettings } from '../../data/SettingsManager';
import { gameConfig } from '../../config/gameConfig';

interface PauseMenuProps {
    settings: Readonly<GameSettings>;
    onResume: () => void;
    onShowWelcome: () => void;
    onChange: (partial: Partial<GameSettings>) => void;
}

export function PauseMenu({ settings, onResume, onShowWelcome, onChange }: PauseMenuProps) {
    const sensitivityPercent = Math.round(
        ((settings.mouseSensitivity - gameConfig.settings.minMouseSensitivity)
            / (gameConfig.settings.maxMouseSensitivity - gameConfig.settings.minMouseSensitivity))
        * 100
    );

    return (
        <div className="pause-overlay" role="dialog" aria-modal="true" aria-label="暂停菜单">
            <div className="pause-card">
                <h2>游戏暂停</h2>
                <p className="pause-card__hint">按 Esc 继续</p>

                <label className="pause-field">
                    <span>鼠标灵敏度 · {sensitivityPercent}%</span>
                    <input
                        type="range"
                        min={gameConfig.settings.minMouseSensitivity}
                        max={gameConfig.settings.maxMouseSensitivity}
                        step={0.0001}
                        value={settings.mouseSensitivity}
                        onChange={event => onChange({
                            mouseSensitivity: Number(event.target.value)
                        })}
                    />
                </label>

                <label className="pause-field pause-field--row">
                    <span>反转视角上下</span>
                    <input
                        type="checkbox"
                        checked={settings.invertY}
                        onChange={event => onChange({ invertY: event.target.checked })}
                    />
                </label>

                <label className="pause-field">
                    <span>音量 · {Math.round(settings.masterVolume * 100)}%</span>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={settings.masterVolume}
                        disabled={settings.muted}
                        onChange={event => onChange({
                            masterVolume: Number(event.target.value)
                        })}
                    />
                </label>

                <label className="pause-field pause-field--row">
                    <span>静音</span>
                    <input
                        type="checkbox"
                        checked={settings.muted}
                        onChange={event => onChange({ muted: event.target.checked })}
                    />
                </label>

                <button type="button" className="pause-resume" onClick={onResume}>
                    继续游戏
                </button>
                <button type="button" className="button-secondary pause-help" onClick={onShowWelcome}>
                    重新查看玩法
                </button>
            </div>
        </div>
    );
}
