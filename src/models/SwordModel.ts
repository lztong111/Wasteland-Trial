import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.pure';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.pure';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder.pure';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';

export class SwordModel {
    public readonly root: TransformNode;
    public readonly meshes: readonly Mesh[];
    private readonly materialState: StandardMaterial[] = [];
    private readonly meshState: Mesh[] = [];
    private readonly bladeMaterial: StandardMaterial;
    private readonly runeMaterial: StandardMaterial;

    public constructor(scene: Scene, parent: TransformNode) {
        this.root = new TransformNode('swordRoot', scene);
        this.root.parent = parent;
        this.root.position = new Vector3(0, -0.02, 0.02);
        this.root.rotation = new Vector3(-0.14, 0, 0.42);

        this.bladeMaterial = this.createMaterial(
            'swordBladeMaterial',
            new Color3(0.55, 0.68, 0.8),
            new Color3(0.95, 0.97, 1),
            scene
        );
        const bladeDark = this.createMaterial(
            'swordBladeDarkMaterial',
            new Color3(0.16, 0.23, 0.31),
            new Color3(0.42, 0.5, 0.62),
            scene
        );
        const leather = this.createMaterial(
            'swordGripMaterial',
            new Color3(0.19, 0.075, 0.035),
            new Color3(0.07, 0.03, 0.02),
            scene
        );
        const gold = this.createMaterial(
            'swordGoldMaterial',
            new Color3(0.58, 0.36, 0.08),
            new Color3(0.85, 0.68, 0.28),
            scene
        );
        this.runeMaterial = this.createMaterial(
            'swordRuneMaterial',
            new Color3(0.04, 0.2, 0.28),
            Color3.Black(),
            scene
        );
        this.runeMaterial.emissiveColor = new Color3(0.08, 0.62, 0.95);

        this.createBlade(scene, bladeDark);
        this.createHilt(scene, leather, gold);
        this.meshes = this.meshState;
    }

    public setAttackGlow(intensity: number): void {
        const clamped = Math.max(0, Math.min(1, intensity));
        this.bladeMaterial.emissiveColor = new Color3(0.1, 0.58, 1).scale(clamped * 0.75);
        this.runeMaterial.emissiveColor = new Color3(0.15, 0.75, 1).scale(0.65 + clamped * 0.8);
    }

    public setScale(scale: number): void {
        this.root.scaling.setAll(scale);
    }

    public dispose(): void {
        this.root.dispose(false);
        this.materialState.forEach(material => material.dispose());
    }

    private createBlade(scene: Scene, bladeDark: StandardMaterial): void {
        const blade = this.createBox(
            'swordBlade',
            { width: 0.13, height: 1.15, depth: 0.075 },
            new Vector3(0, 0.82, 0),
            this.bladeMaterial,
            scene
        );
        blade.scaling.x = 0.9;

        const fuller = this.createBox(
            'swordFuller',
            { width: 0.035, height: 0.9, depth: 0.018 },
            new Vector3(0, 0.79, 0.047),
            bladeDark,
            scene
        );
        fuller.isPickable = false;

        const rune = this.createBox(
            'swordRune',
            { width: 0.022, height: 0.38, depth: 0.012 },
            new Vector3(0, 0.78, 0.06),
            this.runeMaterial,
            scene
        );
        rune.rotation.z = 0.08;

        const tip = CreateCylinder(
            'swordTip',
            { height: 0.28, diameterTop: 0, diameterBottom: 0.145, tessellation: 4 },
            scene
        );
        tip.position = new Vector3(0, 1.53, 0);
        tip.rotation.y = Math.PI / 4;
        tip.parent = this.root;
        tip.material = this.bladeMaterial;
        this.track(tip);
    }

    private createHilt(scene: Scene, leather: StandardMaterial, gold: StandardMaterial): void {
        const guard = this.createBox(
            'swordGuard',
            { width: 0.62, height: 0.09, depth: 0.15 },
            new Vector3(0, 0.2, 0),
            gold,
            scene
        );
        guard.rotation.z = -0.03;

        const grip = CreateCylinder(
            'swordGrip',
            { height: 0.36, diameter: 0.12, tessellation: 10 },
            scene
        );
        grip.position = new Vector3(0, -0.025, 0);
        grip.parent = this.root;
        grip.material = leather;
        this.track(grip);

        for (let index = 0; index < 4; index += 1) {
            const wrap = CreateCylinder(
                `swordGripWrap_${index}`,
                { height: 0.025, diameter: 0.135, tessellation: 10 },
                scene
            );
            wrap.position = new Vector3(0, -0.16 + index * 0.095, 0);
            wrap.parent = this.root;
            wrap.material = gold;
            this.track(wrap);
        }

        const pommel = CreateIcoSphere(
            'swordPommel',
            { radius: 0.12, subdivisions: 1, flat: true },
            scene
        );
        pommel.position = new Vector3(0, -0.28, 0);
        pommel.parent = this.root;
        pommel.material = gold;
        this.track(pommel);
    }

    private createBox(
        name: string,
        size: { width: number; height: number; depth: number },
        position: Vector3,
        material: StandardMaterial,
        scene: Scene
    ): Mesh {
        const mesh = CreateBox(name, size, scene);
        mesh.position.copyFrom(position);
        mesh.parent = this.root;
        mesh.material = material;
        this.track(mesh);
        return mesh;
    }

    private createMaterial(name: string, diffuse: Color3, specular: Color3, scene: Scene): StandardMaterial {
        const material = new StandardMaterial(name, scene);
        material.diffuseColor = diffuse;
        material.specularColor = specular;
        this.materialState.push(material);
        return material;
    }

    private track(mesh: Mesh): void {
        mesh.isPickable = false;
        this.meshState.push(mesh);
    }
}
