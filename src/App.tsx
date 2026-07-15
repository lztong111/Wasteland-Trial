import { useEffect, useRef, useState } from 'react';
import type { GameManager } from './core/Game';
import { GameUI } from './ui/GameUI';
import { RPGManager } from './data/RPGManager';
import { SaveManager } from './data/SaveManager';
import { SettingsManager } from './data/SettingsManager';
import type { CombatCooldownState, UiFeedback } from './ui/feedback';
import type { InteractPrompt } from './systems/InteractionManager';
import './App.css';

type GameStatus = 'loading' | 'ready' | 'error';

const EMPTY_COOLDOWNS: CombatCooldownState = { melee: 0, ranged: 0 };

function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<GameManager | null>(null);
    const feedbackSeqRef = useRef(0);
    const [rpgManager] = useState(() => new RPGManager());
    const [saveManager] = useState(() => new SaveManager(rpgManager));
    const [settingsManager] = useState(() => new SettingsManager());
    const [gameStatus, setGameStatus] = useState<GameStatus>('loading');
    const [errorMessage, setErrorMessage] = useState('');
    const [feedbackEvents, setFeedbackEvents] = useState<Array<{ id: number; feedback: UiFeedback }>>([]);
    const [cooldowns, setCooldowns] = useState<CombatCooldownState>(EMPTY_COOLDOWNS);
    const [interactPrompt, setInteractPrompt] = useState<InteractPrompt | null>(null);
    const [paused, setPaused] = useState(false);
    const [settings, setSettings] = useState(() => settingsManager.settings);

    useEffect(() => {
        return settingsManager.subscribe(() => setSettings(settingsManager.settings));
    }, [settingsManager]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        let active = true;
        let game: GameManager | null = null;
        saveManager.load();
        const unsubscribeStats = rpgManager.subscribeStats(() => saveManager.scheduleSave());
        const unsubscribeInventory = rpgManager.subscribeInventory(() => saveManager.scheduleSave());
        const handleBeforeUnload = () => saveManager.flush();
        window.addEventListener('beforeunload', handleBeforeUnload);
        setGameStatus('loading');

        void import('./core/Game')
            .then(async ({ GameManager: LoadedGameManager }) => {
                if (!active) return;
                const showCombatFeedback = (next: UiFeedback) => {
                    if (!active) return;
                    feedbackSeqRef.current += 1;
                    const id = feedbackSeqRef.current;
                    setFeedbackEvents(prev => [...prev.slice(-12), { id, feedback: next }]);
                };
                const handleCooldownChange = (state: CombatCooldownState) => {
                    if (!active) return;
                    setCooldowns(prev => {
                        if (
                            Math.abs(prev.melee - state.melee) < 0.01
                            && Math.abs(prev.ranged - state.ranged) < 0.01
                        ) {
                            return prev;
                        }
                        return state;
                    });
                };
                game = new LoadedGameManager(
                    canvas,
                    rpgManager,
                    settingsManager,
                    showCombatFeedback,
                    handleCooldownChange,
                    prompt => {
                        if (active) setInteractPrompt(prompt);
                    },
                    nextPaused => {
                        if (active) setPaused(nextPaused);
                    }
                );
                gameRef.current = game;
                await game.start();
                if (active) setGameStatus('ready');
            })
            .catch((error: unknown) => {
                if (!active) return;
                setErrorMessage(error instanceof Error ? error.message : '游戏初始化失败。');
                setGameStatus('error');
            });

        return () => {
            active = false;
            unsubscribeStats();
            unsubscribeInventory();
            window.removeEventListener('beforeunload', handleBeforeUnload);
            game?.dispose();
            gameRef.current = null;
            saveManager.dispose();
        };
    }, [rpgManager, saveManager, settingsManager]);

    const copyError = async () => {
        try {
            await navigator.clipboard.writeText(errorMessage);
        } catch {
            // 剪贴板不可用时忽略。
        }
    };

    return (
        <main className="game-container">
            <canvas ref={canvasRef} id="renderCanvas" aria-label="三维游戏画面" />
            {gameStatus === 'ready' && (
                <GameUI
                    rpgManager={rpgManager}
                    feedbackEvents={feedbackEvents}
                    cooldowns={cooldowns}
                    interactPrompt={interactPrompt}
                    paused={paused}
                    settings={settings}
                    onPauseChange={next => gameRef.current?.setPaused(next)}
                    onSettingsChange={partial => settingsManager.update(partial)}
                    onPlayHealSound={() => gameRef.current?.playHealSound()}
                    onPlayLevelUpSound={() => gameRef.current?.playLevelUpSound()}
                    onPlayUiSound={() => gameRef.current?.playUiSound()}
                />
            )}
            {gameStatus === 'loading' && (
                <div className="status-panel" role="status" aria-live="polite">
                    <div className="status-panel__card">
                        <div className="status-spinner" aria-hidden="true" />
                        <strong>正在加载物理引擎</strong>
                        <span className="status-panel__hint">Havok · Babylon.js</span>
                    </div>
                </div>
            )}
            {gameStatus === 'error' && (
                <div className="status-panel status-panel--error" role="alert">
                    <div className="status-panel__card status-panel__card--error">
                        <strong>游戏启动失败</strong>
                        <span className="status-panel__message">{errorMessage}</span>
                        <div className="status-panel__actions">
                            <button type="button" onClick={() => window.location.reload()}>
                                重新加载
                            </button>
                            <button type="button" className="button-secondary" onClick={() => void copyError()}>
                                复制错误信息
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

export default App;
