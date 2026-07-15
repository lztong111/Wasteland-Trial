import { useEffect, useRef } from 'react';

interface DeathOverlayProps {
    level: number;
    onRevive: () => void;
}

export function DeathOverlay({ level, onRevive }: DeathOverlayProps) {
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        buttonRef.current?.focus();
    }, []);

    return (
        <div
            className="death-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="玩家已阵亡"
        >
            <div className="death-card">
                <h2>你已阵亡</h2>
                <p>等级 {level} · 站起来继续试炼</p>
                <button ref={buttonRef} type="button" onClick={onRevive}>
                    重新站起来
                </button>
            </div>
        </div>
    );
}
