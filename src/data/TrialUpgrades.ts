import { gameConfig } from '../config/gameConfig';

export type TrialUpgradeId = 'vitality' | 'power' | 'endurance';

export interface TrialUpgradeChoice {
    id: TrialUpgradeId;
    icon: string;
    title: string;
    summary: string;
}

export const trialUpgradeChoices: readonly TrialUpgradeChoice[] = Object.freeze([
    {
        id: 'vitality',
        icon: '♥',
        title: '坚韧之心',
        summary: `生命上限 +${gameConfig.progression.trialUpgradeHp}`
    },
    {
        id: 'power',
        icon: '⚔',
        title: '锋刃祝福',
        summary: `基础伤害 +${gameConfig.progression.trialUpgradeDamage}`
    },
    {
        id: 'endurance',
        icon: '◆',
        title: '不竭步伐',
        summary: `体力上限 +${gameConfig.progression.trialUpgradeStamina}`
    }
]);

export function isTrialUpgradeId(value: unknown): value is TrialUpgradeId {
    return trialUpgradeChoices.some(choice => choice.id === value);
}
