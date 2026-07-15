import { useEffect, useRef, useState } from 'react';

interface StatBarProps {
    label: string;
    current: number;
    max: number;
    kind: 'hp' | 'stamina' | 'xp';
    /** 显示用当前值（体力可用 ceil） */
    displayCurrent?: number;
    compact?: boolean;
}

export function StatBar({
    label,
    current,
    max,
    kind,
    displayCurrent,
    compact = false
}: StatBarProps) {
    const safeMax = max > 0 ? max : 1;
    const ratio = Math.max(0, Math.min(1, current / safeMax));
    const shown = displayCurrent ?? current;
    const previousRef = useRef(current);
    const [hitFlash, setHitFlash] = useState(false);
    const isCritical = kind === 'hp' && ratio > 0 && ratio <= 0.3;

    useEffect(() => {
        if (kind === 'hp' && current < previousRef.current) {
            setHitFlash(true);
            const timer = window.setTimeout(() => setHitFlash(false), 220);
            previousRef.current = current;
            return () => window.clearTimeout(timer);
        }
        previousRef.current = current;
        return undefined;
    }, [current, kind]);

    return (
        <div className={`stat-bar${hitFlash ? ' is-hit' : ''}`}>
            <div className="stat-bar__label">
                <span>{label}</span>
                <span>
                    {shown} / {max}
                </span>
            </div>
            <div
                className={`stat-bar__track${compact ? ' stat-bar__track--sm' : ''}`}
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={max}
                aria-valuenow={Math.round(current)}
            >
                <div
                    className={`stat-bar__fill stat-bar__fill--${kind}${isCritical ? ' is-critical' : ''}`}
                    style={{ ['--bar-ratio' as string]: String(ratio) }}
                />
            </div>
        </div>
    );
}
