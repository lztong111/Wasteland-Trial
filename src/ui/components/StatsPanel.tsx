import type { Stats, Weapon } from '../../data/RPGTypes';
import { StatBar } from './StatBar';

interface StatsPanelProps {
    stats: Readonly<Stats>;
    equippedWeapon: Readonly<Weapon> | null;
    totalDamage: number;
    invulnerable?: boolean;
}

export function StatsPanel({
    stats,
    equippedWeapon,
    totalDamage,
    invulnerable = false
}: StatsPanelProps) {
    return (
        <section className="ui-panel stats-panel" aria-label="角色状态">
            <div className="stats-panel__header">
                <div className="stats-panel__level">
                    等级 {stats.level}
                    {invulnerable && <span className="stats-panel__iframe"> 无敌</span>}
                </div>
                <div className="stats-panel__weapon">
                    {equippedWeapon ? (
                        <>
                            {equippedWeapon.icon} {equippedWeapon.name}
                            <span className="stats-panel__damage"> · 伤害 {totalDamage}</span>
                        </>
                    ) : (
                        <span>未装备武器 · 伤害 {totalDamage}</span>
                    )}
                </div>
            </div>
            <StatBar label="生命" current={stats.hp} max={stats.maxHp} kind="hp" />
            <StatBar
                label="体力"
                current={stats.stamina}
                max={stats.maxStamina}
                kind="stamina"
                displayCurrent={Math.ceil(stats.stamina)}
                compact
            />
            <StatBar
                label="经验"
                current={stats.currentXP}
                max={stats.maxXP}
                kind="xp"
                compact
            />
        </section>
    );
}
