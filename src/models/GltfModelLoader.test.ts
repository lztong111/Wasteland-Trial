import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { describe, expect, it } from 'vitest';
import { loadGltfModel, matchesGltfNodeName } from './GltfModelLoader';

describe('GltfModelLoader', () => {
    it('可以匹配带 Mixamo 命名空间的右手骨骼', () => {
        expect(matchesGltfNodeName('mixamorig:RightHand', 'RightHand')).toBe(true);
        expect(matchesGltfNodeName('Armature|hand_r', 'hand_r')).toBe(true);
        expect(matchesGltfNodeName('mixamorig:LeftHand', 'RightHand')).toBe(false);
    });

    it('外部模型不存在时返回空并允许程序化模型继续工作', async () => {
        const engine = new NullEngine();
        const scene = new Scene(engine);
        try {
            await expect(loadGltfModel(scene, {
                rootUrl: '/models/',
                fileName: 'missing-player.glb'
            })).resolves.toBeNull();
        } finally {
            scene.dispose();
            engine.dispose();
        }
    }, 15_000);
});
