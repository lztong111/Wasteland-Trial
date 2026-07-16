interface VictoryOverlayProps {
    level: number;
    trialNumber: number;
    defeatedGuardians: number;
    onContinue: () => void;
}

export function VictoryOverlay({ level, trialNumber, defeatedGuardians, onContinue }: VictoryOverlayProps) {
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
                <button type="button" onClick={onContinue}>进入下一轮</button>
            </div>
        </div>
    );
}
