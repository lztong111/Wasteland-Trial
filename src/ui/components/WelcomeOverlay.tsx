import { gameConfig } from '../../config/gameConfig';
import { trialUpgradeChoices } from '../../data/TrialUpgrades';

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
        description: '清除第一波守卫后开启补给箱，箱子会召来重装增援和一名小首领；清场后激活神龛并进入下一轮试炼。'
    },
    {
        image: '/onboarding/progression.png',
        alt: '遗迹试炼完成后的结算界面',
        title: '成长与轮次',
        description: '击杀敌人获得经验和随机掉落。每进入新一轮，敌人的生命、伤害和经验奖励都会提高。'
    }
] as const;

const controls = [
    ['W / A / S / D', '相机相对移动'],
    ['空格', '跳跃，需站在地面'],
    ['左键', '三段轻击，消耗 10 / 10 / 15 体力'],
    ['Q', `蓄力重击，消耗 ${gameConfig.combat.heavyStaminaCost} 体力，伤害约为普通攻击 ${gameConfig.combat.heavyDamageMultiplier} 倍`],
    ['右键', '远程射击，弹道会飞向准星命中点'],
    ['Shift', `方向闪避，消耗 ${gameConfig.player.dodgeStaminaCost} 体力并获得 ${gameConfig.player.dodgeInvulnerabilitySeconds} 秒无敌`],
    ['E', '交互、开启宝箱和激活神龛'],
    ['I / Tab', '打开或关闭背包'],
    ['H', '展开或收起操作说明'],
    ['Esc', '暂停游戏或释放鼠标锁定']
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
                <section className="welcome-details" aria-label="详细玩法规则">
                    <div className="welcome-detail-block">
                        <h2>完整操作表</h2>
                        <dl>
                            {controls.map(([key, description]) => (
                                <div key={key}>
                                    <dt><kbd>{key}</kbd></dt>
                                    <dd>{description}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <div className="welcome-detail-block">
                        <h2>战斗判定</h2>
                        <ul>
                            <li>轻击第三段伤害最高，但连击需要在前一段结束前继续输入。</li>
                            <li>近战只命中角色前方扇形范围，墙体会阻挡攻击和射线。</li>
                            <li>敌人攻击会先出现前摇；离开范围可以取消本次攻击。</li>
                            <li>体力会在攻击和闪避结束后自动恢复，体力不足时动作不会启动。</li>
                            <li>敌人生命条只显示当前存活目标，击杀后获得经验。</li>
                        </ul>
                    </div>
                    <div className="welcome-detail-block">
                        <h2>敌人与掉落</h2>
                        <ul>
                            <li>普通守卫：生命和移动速度均衡，第一波全部由普通守卫组成。</li>
                            <li>重装守卫：生命更高、移动更慢，第二波前两名增援有概率掉落守卫裂刃。</li>
                            <li>小首领：第二波最后出现，生命和伤害最高，必定掉落遗迹重刃。</li>
                            <li>武器掉落会直接进入背包；背包容量不足时会提示未能拾取。</li>
                        </ul>
                    </div>
                    <div className="welcome-detail-block">
                        <h2>试炼流程</h2>
                        <ol>
                            <li>第一波：击败 {gameConfig.objective.guardianTarget} 名守卫。</li>
                            <li>补给箱：靠近箱子按 E，获得生命药水。</li>
                            <li>第二波：开箱后出现 {gameConfig.objective.guardianTarget} 名增援。</li>
                            <li>神龛：清场后靠近神龛按 E，恢复生命并完成本轮。</li>
                            <li>结算：三选一升级后才能进入下一轮。</li>
                        </ol>
                    </div>
                    <div className="welcome-detail-block">
                        <h2>成长与存档</h2>
                        <ul>
                            <li>升级会恢复生命，并提高生命上限和基础伤害。</li>
                            <li>当前可选升级：{trialUpgradeChoices.map(choice => choice.title).join('、')}。</li>
                            <li>第一轮敌人基础生命为 {gameConfig.enemy.maxHp}，后续轮次按配置继续成长。</li>
                            <li>经验、等级、装备、背包、轮次和任务进度会自动保存到浏览器。</li>
                            <li>刷新页面会重新显示本说明，但不会清除存档。</li>
                        </ul>
                    </div>
                </section>
                <p className="welcome-tip"><strong>实战提示：</strong>先用远程攻击拉开距离，再用闪避穿过攻击前摇；开启宝箱前先确认体力和生命状态。</p>
                <div className="welcome-card__footer">
                    <span>游戏会自动保存轮次、经验、背包和装备。</span>
                    <button type="button" onClick={onStart}>开始试炼</button>
                </div>
            </div>
        </div>
    );
}
