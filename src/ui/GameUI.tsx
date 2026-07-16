import { useCallback, useEffect, useRef, useState, type FC } from 'react';
import { RPGManager } from '../data/RPGManager';
import { type Item, type Stats, type Weapon } from '../data/RPGTypes';
import type { GameSettings } from '../data/SettingsManager';
import type { InteractPrompt } from '../systems/InteractionManager';
import type { CombatCooldownState, FeedbackKind, UiFeedback } from './feedback';
import { CombatToast } from './components/CombatToast';
import { ControlsHint } from './components/ControlsHint';
import { CooldownHud } from './components/CooldownHud';
import { DeathOverlay } from './components/DeathOverlay';
import { FloatTexts, type FloatTextItem } from './components/FloatTexts';
import { InteractPromptBanner } from './components/InteractPrompt';
import { InventoryPanel } from './components/InventoryPanel';
import { LevelUpBanner } from './components/LevelUpBanner';
import { PauseMenu } from './components/PauseMenu';
import { StatsPanel } from './components/StatsPanel';
import { ObjectiveTracker } from './components/ObjectiveTracker';
import { VictoryOverlay } from './components/VictoryOverlay';
import { WelcomeOverlay } from './components/WelcomeOverlay';
import { MobileControls } from './components/MobileControls';
import type { Action } from '../systems/InputManager';
import type { GameProgressManager, ObjectiveView } from '../data/GameProgressManager';
import { trialUpgradeChoices, type TrialUpgradeId } from '../data/TrialUpgrades';
import './GameUI.css';

interface UIProps {
    rpgManager: RPGManager;
    progressManager: GameProgressManager;
    feedbackEvents: ReadonlyArray<{ id: number; feedback: UiFeedback }>;
    cooldowns: CombatCooldownState;
    interactPrompt: InteractPrompt | null;
    paused: boolean;
    settings: Readonly<GameSettings>;
    onPauseChange: (paused: boolean) => void;
    onSettingsChange: (partial: Partial<GameSettings>) => void;
    onPlayHealSound: () => void;
    onPlayLevelUpSound: () => void;
    onPlayUiSound: () => void;
    onVirtualAction: (action: Action, isDown: boolean) => void;
}

interface ToastState {
    text: string;
    kind: FeedbackKind;
}

export const GameUI: FC<UIProps> = ({
    rpgManager,
    progressManager,
    feedbackEvents,
    cooldowns,
    interactPrompt,
    paused,
    settings,
    onPauseChange,
    onSettingsChange,
    onPlayHealSound,
    onPlayLevelUpSound,
    onPlayUiSound,
    onVirtualAction
}) => {
    const [stats, setStats] = useState<Readonly<Stats>>(rpgManager.stats);
    const [inventory, setInventory] = useState<readonly Readonly<Item>[]>(rpgManager.inventory);
    const [equippedWeapon, setEquippedWeapon] = useState<Readonly<Weapon> | null>(
        rpgManager.equippedWeapon
    );
    const [totalDamage, setTotalDamage] = useState(rpgManager.getTotalDamage());
    const [showInventory, setShowInventory] = useState(false);
    const [toast, setToast] = useState<ToastState | null>(null);
    const [floatItems, setFloatItems] = useState<FloatTextItem[]>([]);
    const [levelUpLevel, setLevelUpLevel] = useState<number | null>(null);
    const [hitVignette, setHitVignette] = useState(false);
    const [crosshairActive, setCrosshairActive] = useState(false);
    const [invulnerable, setInvulnerable] = useState(false);
    const [showWelcome, setShowWelcome] = useState(true);
    const welcomePauseRequested = useRef(false);
    const [objective, setObjective] = useState<ObjectiveView>(progressManager.objective);
    const [progress, setProgress] = useState(progressManager.progress);
    const toastTimerRef = useRef<number | null>(null);
    const crosshairTimerRef = useRef<number | null>(null);
    const invulnTimerRef = useRef<number | null>(null);
    const processedFeedbackIdRef = useRef(0);

    const refreshInventoryView = useCallback(() => {
        setInventory(rpgManager.inventory);
        setEquippedWeapon(rpgManager.equippedWeapon);
        setTotalDamage(rpgManager.getTotalDamage());
    }, [rpgManager]);

    useEffect(() => {
        return progressManager.subscribe(() => {
            setObjective(progressManager.objective);
            setProgress(progressManager.progress);
        });
    }, [progressManager]);

    useEffect(() => {
        if (welcomePauseRequested.current) return;
        welcomePauseRequested.current = true;
        onPauseChange(true);
    }, [onPauseChange]);

    useEffect(() => {
        const unsubscribeStats = rpgManager.subscribeStats(() => {
            const next = rpgManager.stats;
            setStats(prev => {
                if (next.hp < prev.hp) {
                    setHitVignette(true);
                    window.setTimeout(() => setHitVignette(false), 450);
                }
                return next;
            });
            setInvulnerable(rpgManager.isInvulnerable);
            if (invulnTimerRef.current !== null) window.clearTimeout(invulnTimerRef.current);
            if (rpgManager.isInvulnerable) {
                invulnTimerRef.current = window.setTimeout(() => {
                    setInvulnerable(false);
                    invulnTimerRef.current = null;
                }, Math.ceil(rpgManager.invulnerabilityRemaining * 1000));
            }
        });
        const unsubscribeInventory = rpgManager.subscribeInventory(refreshInventoryView);
        const unsubscribeLevelUp = rpgManager.subscribeLevelUp(level => {
            setLevelUpLevel(level);
            onPlayLevelUpSound();
            window.setTimeout(() => setLevelUpLevel(current => (current === level ? null : current)), 2600);
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (showWelcome) return;
            if (event.code === 'Escape') {
                event.preventDefault();
                if (showInventory) {
                    setShowInventory(false);
                    onPlayUiSound();
                    return;
                }
                onPauseChange(!paused);
                return;
            }
            if (paused) return;
            if (event.code === 'KeyI' || event.code === 'Tab') {
                event.preventDefault();
                setShowInventory(prev => !prev);
                onPlayUiSound();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            unsubscribeStats();
            unsubscribeInventory();
            unsubscribeLevelUp();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        rpgManager,
        refreshInventoryView,
        showInventory,
        paused,
        onPauseChange,
        showWelcome,
        onPlayLevelUpSound,
        onPlayUiSound
    ]);

    useEffect(() => {
        const pending = feedbackEvents.filter(event => event.id > processedFeedbackIdRef.current);
        if (pending.length === 0) return;
        processedFeedbackIdRef.current = pending[pending.length - 1].id;

        for (const { id: eventId, feedback } of pending) {
            if (feedback.type === 'toast') {
                setToast({ text: feedback.text, kind: feedback.kind });
                if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
                toastTimerRef.current = window.setTimeout(() => {
                    setToast(null);
                    toastTimerRef.current = null;
                }, 900);
                if (feedback.kind === 'combat' || feedback.kind === 'hit') {
                    setCrosshairActive(true);
                    if (crosshairTimerRef.current !== null) window.clearTimeout(crosshairTimerRef.current);
                    crosshairTimerRef.current = window.setTimeout(() => {
                        setCrosshairActive(false);
                        crosshairTimerRef.current = null;
                    }, 180);
                }
                continue;
            }

            if (feedback.type === 'float') {
                const floatId = eventId;
                const offsetX = ((eventId * 17) % 49) - 24;
                setFloatItems(prev => [
                    ...prev.slice(-6),
                    { id: floatId, text: feedback.text, kind: feedback.kind, offsetX }
                ]);
                window.setTimeout(() => {
                    setFloatItems(prev => prev.filter(item => item.id !== floatId));
                }, 950);
                continue;
            }

            if (feedback.type === 'levelup') {
                setLevelUpLevel(feedback.level);
                onPlayLevelUpSound();
                window.setTimeout(
                    () => setLevelUpLevel(current => (current === feedback.level ? null : current)),
                    2600
                );
            }
        }
    }, [feedbackEvents, onPlayLevelUpSound]);

    useEffect(() => () => {
        if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
        if (crosshairTimerRef.current !== null) window.clearTimeout(crosshairTimerRef.current);
        if (invulnTimerRef.current !== null) window.clearTimeout(invulnTimerRef.current);
    }, []);

    return (
        <div className="ui-container">
            <div
                className={`crosshair${crosshairActive ? ' crosshair--active' : ''}`}
                aria-hidden="true"
            />

            {toast && <CombatToast text={toast.text} kind={toast.kind} />}
            <FloatTexts items={floatItems} />
            {levelUpLevel !== null && <LevelUpBanner level={levelUpLevel} />}
            {hitVignette && <div className="hit-vignette" aria-hidden="true" />}

            <StatsPanel
                stats={stats}
                equippedWeapon={equippedWeapon}
                totalDamage={totalDamage}
                invulnerable={invulnerable}
            />
            <ObjectiveTracker objective={objective} trialNumber={progress.trialNumber} />

            {!paused && !showInventory && interactPrompt && (
                <InteractPromptBanner label={interactPrompt.label} />
            )}

            <CooldownHud cooldowns={cooldowns} />
            <ControlsHint forceExpanded={showInventory || paused} />
            <MobileControls onAction={onVirtualAction} />

            {stats.hp === 0 && !paused && (
                <DeathOverlay level={stats.level} onRevive={() => rpgManager.revive()} />
            )}

            {showInventory && !paused && (
                <InventoryPanel
                    rpgManager={rpgManager}
                    inventory={inventory}
                    equippedWeapon={equippedWeapon}
                    onClose={() => setShowInventory(false)}
                    onUsedConsumable={() => onPlayHealSound()}
                />
            )}

            {paused && !showWelcome && (
                <PauseMenu
                    settings={settings}
                    onResume={() => onPauseChange(false)}
                    onShowWelcome={() => setShowWelcome(true)}
                    onChange={onSettingsChange}
                />
            )}

            {progress.phase === 'victory' && !progress.victoryAcknowledged && !paused && (
                <VictoryOverlay
                    level={stats.level}
                    trialNumber={progress.trialNumber}
                    defeatedGuardians={progress.defeatedGuardians}
                    upgrades={trialUpgradeChoices}
                    selectedUpgradeId={progress.selectedUpgradeId}
                    onSelectUpgrade={(upgradeId: TrialUpgradeId) => {
                        if (progress.upgradeSelected) return;
                        rpgManager.applyTrialUpgrade(upgradeId);
                        progressManager.selectUpgrade(upgradeId);
                        onPlayLevelUpSound();
                    }}
                    onContinue={() => progressManager.startNextTrial()}
                />
            )}

            {showWelcome && (
                <WelcomeOverlay
                    onStart={() => {
                        setShowWelcome(false);
                        onPauseChange(false);
                        onPlayUiSound();
                    }}
                />
            )}
        </div>
    );
};
