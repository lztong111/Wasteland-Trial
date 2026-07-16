import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { Scene } from '@babylonjs/core/scene';

export interface GltfAssetSource {
    rootUrl: string;
    fileName: string;
}

export interface GltfLoadProgress {
    loaded: number;
    total: number;
}

export interface LoadedGltfModel {
    root: TransformNode;
    meshes: readonly AbstractMesh[];
    animationGroups: readonly AnimationGroup[];
    findNode(name: string): TransformNode | null;
    dispose(): void;
}

export function matchesGltfNodeName(actualName: string, expectedName: string): boolean {
    const actual = actualName.trim().toLowerCase();
    const expected = expectedName.trim().toLowerCase();
    if (actual === expected) return true;

    // Mixamo 等导出器会添加命名空间，挂点匹配时只比较最后一段节点名。
    const leafName = actual.split(/[:|/]/).at(-1);
    return leafName === expected;
}

export async function loadGltfModel(
    scene: Scene,
    source: GltfAssetSource,
    onProgress?: (progress: GltfLoadProgress) => void
): Promise<LoadedGltfModel | null> {
    try {
        // 只有配置了外部模型时才下载 glTF loader，默认程序化模型不增加首屏负担。
        await import('@babylonjs/loaders/glTF');
        const result = await SceneLoader.ImportMeshAsync(
            '',
            source.rootUrl,
            source.fileName,
            scene,
            event => onProgress?.({
                loaded: event.loaded,
                total: event.total
            })
        );
        const root = new TransformNode(`gltfRoot_${source.fileName}`, scene);
        const rootMeshes = result.meshes.filter(mesh => mesh.parent === null);
        rootMeshes.forEach(mesh => {
            mesh.parent = root;
            mesh.isPickable = false;
        });
        result.transformNodes
            .filter(node => node.parent === null)
            .forEach(node => node.parent = root);

        const nodes = [...result.transformNodes, ...result.meshes]
            .filter(node => node !== root);
        return {
            root,
            meshes: result.meshes,
            animationGroups: result.animationGroups,
            findNode: name => {
                const found = nodes.find(node => matchesGltfNodeName(node.name, name));
                return found ? found as TransformNode : null;
            },
            dispose: () => {
                result.animationGroups.forEach(group => group.dispose());
                result.transformNodes.forEach(node => node.dispose(false));
                result.meshes.forEach(mesh => mesh.dispose(false, true));
                root.dispose(false);
            }
        };
    } catch {
        // 外部模型缺失、网络失败或格式不兼容时由调用方继续使用程序化模型。
        return null;
    }
}
