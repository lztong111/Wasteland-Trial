interface WelcomeOverlayProps {
    onStart: () => void;
}

const mechanics = [
    {
        image: '/onboarding/combat.png',
        alt: '玩家在遗迹古道上面对守卫',
        title: '战斗与闪避',
        description: '左键打出三段轻击，Q 施放蓄力重击，右键远程射击，Shift 朝当前方向闪避并获得短暂无敌。'
    },
    {
        image: '/onboarding/trial-flow.png',
        alt: '遗迹试炼目标与古老神龛',
        title: '目标与波次',
        description: '清除第一波守卫后开启补给箱，箱子会召来第二波增援；清场后激活神龛并进入下一轮试炼。'
    },
    {
        image: '/onboarding/progression.png',
        alt: '遗迹试炼完成后的结算界面',
        title: '成长与轮次',
        description: '击杀敌人获得经验并升级。每进入新一轮，敌人的生命、伤害和经验奖励都会提高。'
    }
] as const;

export function WelcomeOverlay({ onStart }: WelcomeOverlayProps) {
    return (
        <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <div className="welcome-card">
                <div className="welcome-card__header">
                    <p className="welcome-card__eyebrow">荒原试炼 · 新手说明</p>
                    <h1 id="welcome-title">准备进入遗迹</h1>
                    <p>先了解战斗、波次和成长机制，再开始本轮试炼。</p>
                </div>
                <div className="welcome-mechanics">
                    {mechanics.map(mechanic => (
                        <article className="welcome-mechanic" key={mechanic.title}>
                            <img src={mechanic.image} alt={mechanic.alt} />
                            <div>
                                <h2>{mechanic.title}</h2>
                                <p>{mechanic.description}</p>
                            </div>
                        </article>
                    ))}
                </div>
                <div className="welcome-card__footer">
                    <span>游戏会自动保存轮次、经验、背包和装备。</span>
                    <button type="button" onClick={onStart}>开始试炼</button>
                </div>
            </div>
        </div>
    );
}
