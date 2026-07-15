interface LevelUpBannerProps {
    level: number;
}

export function LevelUpBanner({ level }: LevelUpBannerProps) {
    return (
        <div className="levelup-banner" role="status" aria-live="polite">
            <div className="levelup-banner__title">等级提升</div>
            <div className="levelup-banner__level">达到 {level} 级</div>
        </div>
    );
}
