import type { CombatCooldownState } from '../feedback';

interface CooldownHudProps {
    cooldowns: CombatCooldownState;
}

function Ring({
    label,
    ratio,
    icon
}: {
    label: string;
    ratio: number;
    icon: string;
}) {
    const clamped = Math.max(0, Math.min(1, ratio));
    const ready = clamped <= 0.001;
    const radius = 16;
    const circumference = 2 * Math.PI * radius;
    // ratio=1 时满冷却（进度环空），ratio=0 时就绪（环满）
    const offset = circumference * clamped;

    return (
        <div
            className={`cooldown-ring${ready ? ' is-ready' : ''}`}
            role="meter"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((1 - clamped) * 100)}
            title={label}
        >
            <svg className="cooldown-ring__svg" viewBox="0 0 40 40" aria-hidden="true">
                <circle className="cooldown-ring__track" cx="20" cy="20" r={radius} />
                <circle
                    className="cooldown-ring__progress"
                    cx="20"
                    cy="20"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <span className="cooldown-ring__icon">{icon}</span>
        </div>
    );
}

export function CooldownHud({ cooldowns }: CooldownHudProps) {
    return (
        <div className="cooldown-hud" aria-label="技能冷却">
            <Ring label="近战冷却" ratio={cooldowns.melee} icon="⚔" />
            <Ring label="远程冷却" ratio={cooldowns.ranged} icon="◎" />
        </div>
    );
}
