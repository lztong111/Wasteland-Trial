import { describe, expect, it } from 'vitest';
import { resolveAnimationStateName } from './GltfAnimationController';

describe('GltfAnimationController', () => {
    it('按常见 GLB 动画命名映射状态', () => {
        expect(resolveAnimationStateName('idle', ['Armature|Idle'])).toBe('Armature|Idle');
        expect(resolveAnimationStateName('run', ['WalkCycle'])).toBe('WalkCycle');
        expect(resolveAnimationStateName('dodge', ['RollForward'])).toBe('RollForward');
        expect(resolveAnimationStateName('attack', ['Breathing'])).toBeNull();
    });
});
