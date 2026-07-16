import type { TrialUpgradeChoice, TrialUpgradeId } from '../../data/TrialUpgrades';

interface VictoryOverlayProps {
    level: number;
    trialNumber: number;
    defeatedGuardians: number;
    upgrades: readonly TrialUpgradeChoice[];
    selectedUpgradeId: TrialUpgradeId | null;
    onSelectUpgrade: (upgradeId: TrialUpgradeId) => void;
    onContinue: () => void;
}

export function VictoryOverlay({
    level,
    trialNumber,
    defeatedGuardians,
    upgrades,
    selectedUpgradeId,
    onSelectUpgrade,
    onContinue
}: VictoryOverlayProps) {
    return (
        <div className="victory-overlay" role="dialog" aria-modal="true" aria-label="试炼完成">
            <div className="victory-card">
                <div className="victory-card__sigil" aria-hidden="true">✦</div>
                <p className="victory-card__eyebrow">第 {trialNumber} 轮 · 遗迹重归寂静</p>
                <h2>试炼完成</h2>
                <p>你已清除守卫、取得补给并激活古老神龛。</p>
                <div className="victory-card__stats">
                    <span>等级 <strong>{level}</strong></span>
                    <span>击败守卫 <strong>{defeatedGuardians}</strong></span>
                </div>
                <div className="victory-upgrades" aria-label="试炼升级选择">
                    {upgrades.map(upgrade => (
                        <button
                            type="button"
                            key={upgrade.id}
                            className={selectedUpgradeId === upgrade.id ? 'is-selected' : ''}
                            disabled={selectedUpgradeId !== null}
                            onClick={() => onSelectUpgrade(upgrade.id)}
                            aria-label={`选择${upgrade.title}`}
                        >
                            <span aria-hidden="true">{upgrade.icon}</span>
                            <strong>{upgrade.title}</strong>
                            <small>{upgrade.summary}</small>
                        </button>
                    ))}
                </div>
                <button type="button" disabled={selectedUpgradeId === null} onClick={onContinue}>
                    {selectedUpgradeId === null ? '选择升级后继续' : '进入下一轮'}
                </button>
            </div>
        </div>
    );
}
