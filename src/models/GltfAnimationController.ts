import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';

export type GltfAnimationState = 'idle' | 'run' | 'attack' | 'hit' | 'death' | 'dodge';

const STATE_ALIASES: Readonly<Record<GltfAnimationState, readonly string[]>> = {
    idle: ['idle', 'stand', 'breath'],
    run: ['run', 'walk', 'locomotion'],
    attack: ['attack', 'slash', 'swing'],
    hit: ['hit', 'hurt', 'damage'],
    death: ['death', 'die'],
    dodge: ['dodge', 'roll', 'evade']
};

export function resolveAnimationStateName(
    state: GltfAnimationState,
    names: readonly string[]
): string | null {
    const normalized = names.map(name => ({ original: name, value: name.toLowerCase() }));
    const aliases = STATE_ALIASES[state];
    return normalized.find(item => aliases.some(alias => item.value.includes(alias)))?.original ?? null;
}

export class GltfAnimationController {
    private currentName: string | null = null;

    public constructor(private readonly groups: readonly AnimationGroup[]) {}

    public play(state: GltfAnimationState, loop = true): boolean {
        const name = resolveAnimationStateName(
            state,
            this.groups.map(group => group.name)
        );
        if (!name) return false;
        if (this.currentName === name) return true;

        this.groups.forEach(group => {
            group.stop();
            group.reset();
        });
        const group = this.groups.find(candidate => candidate.name === name);
        if (!group) return false;
        group.loopAnimation = loop;
        group.play(loop);
        this.currentName = name;
        return true;
    }

    public dispose(): void {
        this.groups.forEach(group => group.stop());
        this.currentName = null;
    }

    public stop(): void {
        this.groups.forEach(group => group.stop());
        this.currentName = null;
    }
}
