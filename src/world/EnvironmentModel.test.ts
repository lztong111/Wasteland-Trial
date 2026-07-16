import { describe, expect, it } from 'vitest';
import { getPathPoint } from './EnvironmentModel';

describe('环境道路几何', () => {
    it('道路中心线沿旋转后的 Z 轴延伸', () => {
        const origin = getPathPoint(0);
        const forward = getPathPoint(10);

        expect(origin.x).toBeCloseTo(0);
        expect(origin.z).toBeCloseTo(0);
        expect(forward.x).toBeGreaterThan(0);
        expect(forward.z).toBeGreaterThan(9);
    });

    it('左右边界在中心线两侧保持对称', () => {
        const left = getPathPoint(8, -4.7);
        const right = getPathPoint(8, 4.7);

        expect(left.x + right.x).toBeCloseTo(2 * getPathPoint(8).x);
        expect(left.z + right.z).toBeCloseTo(2 * getPathPoint(8).z);
        expect(Math.hypot(left.x - right.x, left.z - right.z)).toBeCloseTo(9.4);
    });
});
