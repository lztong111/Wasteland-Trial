import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it } from 'vitest';
import { RPGManager } from '../data/RPGManager';
import type { Player } from '../entities/Player';
import { EnemyManager } from './EnemyManager';

describe('EnemyManager', () => {
    let engine: NullEngine | null = null;
    let scene: Scene | null = null;

    afterEach(() => {
        scene?.dispose();
        engine?.dispose();
        scene = null;
        engine = null;
    });

    it('敌人受伤后血条缩到剩余生命比例并改变颜色', () => {
        engine = new NullEngine();
        scene = new Scene(engine);
        const playerStub = {
            mesh: { getAbsolutePosition: () => Vector3.Zero() }
        } as unknown as Player;
        const manager = new EnemyManager(scene, new RPGManager(), playerStub);

        const hitCount = manager.damageEnemiesInRadius(new Vector3(6, 1, 6), 0.5, 15);
        const healthFill = scene.meshes.find(mesh => mesh.name.endsWith('HealthFill'));

        expect(hitCount).toBe(1);
        expect(healthFill?.scaling.x).toBeCloseTo(0.5);
        expect(healthFill?.position.x).toBeCloseTo(-0.25);
        expect(healthFill?.material?.name.endsWith('Health')).toBe(true);
        const emissive = (healthFill!.material as StandardMaterial).emissiveColor;
        expect(emissive.r).toBeGreaterThan(emissive.g);
        expect(emissive.g).toBeGreaterThan(0.5);
        manager.dispose();
    });
});
