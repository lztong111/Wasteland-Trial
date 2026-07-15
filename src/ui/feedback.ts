export type FeedbackKind = 'combat' | 'hit' | 'system' | 'warning';

export type UiFeedback =
    | { type: 'toast'; text: string; kind: FeedbackKind }
    | { type: 'float'; text: string; kind: 'damage' | 'xp' }
    | { type: 'levelup'; level: number };

export type CombatFeedbackHandler = (feedback: UiFeedback) => void;

export interface CombatCooldownState {
    /** 0 = 就绪，1 = 刚进入冷却 */
    melee: number;
    ranged: number;
}

export function toast(text: string, kind: FeedbackKind = 'combat'): UiFeedback {
    return { type: 'toast', text, kind };
}
