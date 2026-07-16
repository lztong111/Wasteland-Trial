import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameProgressManager } from '../data/GameProgressManager';
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

        const hitCount = manager.damageEnemiesInRadius(new Vector3(6, 1, 6), 0.5, 20);
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

    it('近战扇形只命中前方范围内的敌人', () => {
        engine = new NullEngine();
        scene = new Scene(engine);
        const playerStub = {
            mesh: { getAbsolutePosition: () => Vector3.Zero() },
            physicsBody: null
        } as unknown as Player;
        const manager = new EnemyManager(scene, new RPGManager(), playerStub);

        const hitCount = manager.damageEnemiesInCone(
            Vector3.Zero(),
            new Vector3(1, 0, 1),
            10,
            Math.PI / 7,
            10
        );

        expect(hitCount).toBe(1);
        manager.dispose();
    });

    it('开启补给箱后生成第二波并在清除后开放神龛', () => {
        engine = new NullEngine();
        scene = new Scene(engine);
        const playerStub = {
            mesh: { getAbsolutePosition: () => Vector3.Zero() },
            physicsBody: null
        } as unknown as Player;
        const progress = new GameProgressManager();
        const feedback = vi.fn();
        const manager = new EnemyManager(
            scene,
            new RPGManager(),
            playerStub,
            feedback,
            null,
            progress
        );

        for (const position of [[6, 1, 6], [-7, 1, 4], [4, 1, -8]] as const) {
            expect(manager.damageEnemiesInRadius(new Vector3(...position), 0.5, 100)).toBe(1);
        }
        expect(progress.objective.phase).toBe('chest');

        progress.recordChestOpened();
        manager.update(0);
        expect(progress.objective.phase).toBe('reinforcements');
        expect(feedback).toHaveBeenCalledWith({
            type: 'toast',
            text: '第二波守卫来袭',
            kind: 'warning'
        });

        for (const position of [[6, 1, 6], [-7, 1, 4], [4, 1, -8]] as const) {
            expect(manager.damageEnemiesInRadius(new Vector3(...position), 0.5, 100)).toBe(1);
        }
        expect(progress.objective.phase).toBe('shrine');
        expect(progress.progress.defeatedGuardians).toBe(6);

        progress.recordShrineActivated(0);
        progress.startNextTrial();
        manager.update(0);
        expect(progress.progress.trialNumber).toBe(2);
        // 第二轮生命提高 25%，第一轮刚好致死的 30 点伤害不再能直接击杀。
        expect(manager.damageEnemiesInRadius(new Vector3(6, 1, 6), 0.5, 30)).toBe(1);
        expect(progress.progress.defeatedGuardians).toBe(0);
        expect(manager.damageEnemiesInRadius(new Vector3(6, 1, 6), 0.5, 100)).toBe(1);
        expect(progress.progress.defeatedGuardians).toBe(1);
        manager.dispose();
    });
});
