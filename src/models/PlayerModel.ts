import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.pure';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.pure';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder.pure';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder.pure';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Scene } from '@babylonjs/core/scene';
import { GltfAnimationController, type GltfAnimationState } from './GltfAnimationController';
import {
    loadGltfModel,
    type GltfAssetSource,
    type GltfLoadProgress,
    type LoadedGltfModel
} from './GltfModelLoader';

interface PlayerPalette {
    armor: StandardMaterial;
    armorDark: StandardMaterial;
    cloth: StandardMaterial;
    leather: StandardMaterial;
    skin: StandardMaterial;
    cape: StandardMaterial;
    eye: StandardMaterial;
}

export class PlayerModel {
    public readonly root: TransformNode;
    public readonly weaponAnchor: TransformNode;
    public readonly meshes: readonly Mesh[];
    private readonly materials: StandardMaterial[] = [];
    private readonly meshState: Mesh[] = [];
    private readonly leftArm: TransformNode;
    private readonly rightArm: TransformNode;
    private readonly leftLeg: TransformNode;
    private readonly rightLeg: TransformNode;
    private readonly followTarget: TransformNode;
    private readonly groundShadow: Mesh;
    private animationTime = 0;
    private externalModel: LoadedGltfModel | null = null;
    private externalAnimations: GltfAnimationController | null = null;

    public constructor(scene: Scene, parent: TransformNode) {
        this.followTarget = parent;
        this.root = new TransformNode('playerModelRoot', scene);
        this.root.parent = parent;
        const palette = this.createPalette(scene);
        this.groundShadow = this.createGroundShadow(scene);

        this.leftLeg = this.createLimbRoot('playerLeftLeg', new Vector3(-0.23, -0.38, 0), scene);
        this.rightLeg = this.createLimbRoot('playerRightLeg', new Vector3(0.23, -0.38, 0), scene);
        this.createLeg(this.leftLeg, palette, -1, scene);
        this.createLeg(this.rightLeg, palette, 1, scene);

        this.createTorso(palette, scene);
        this.createHead(palette, scene);

        this.leftArm = this.createLimbRoot('playerLeftArm', new Vector3(-0.58, 0.28, 0), scene);
        this.rightArm = this.createLimbRoot('playerRightArm', new Vector3(0.58, 0.28, 0), scene);
        this.createArm(this.leftArm, palette, -1, scene);
        this.createArm(this.rightArm, palette, 1, scene);

        this.weaponAnchor = new TransformNode('playerWeaponAnchor', scene);
        this.weaponAnchor.parent = this.rightArm;
        this.weaponAnchor.position = new Vector3(0, -0.54, 0.08);

        this.meshes = this.meshState;
    }

    public update(deltaSeconds: number, isMoving: boolean, dodgeProgress: number | null = null): void {
        this.animationTime += deltaSeconds;
        if (this.externalModel) {
            const state: GltfAnimationState = dodgeProgress !== null
                ? 'dodge'
                : isMoving ? 'run' : 'idle';
            this.externalAnimations?.play(state);
            this.updateGroundShadow();
            return;
        }
        if (dodgeProgress !== null) {
            const arc = Math.sin(Math.min(1, dodgeProgress) * Math.PI);
            this.leftLeg.rotation.x = -1.05;
            this.rightLeg.rotation.x = -1.05;
            this.leftArm.rotation.x = -0.85;
            this.rightArm.rotation.x = -0.85;
            this.root.position.y = arc * 0.16;
            this.root.rotation.x = -arc * 0.85;
            this.root.rotation.z = 0;
            this.updateGroundShadow();
            return;
        }
        const movementBlend = isMoving ? 1 : 0;
        const stride = Math.sin(this.animationTime * 10) * 0.58 * movementBlend;
        const idle = Math.sin(this.animationTime * 2.2);

        this.leftLeg.rotation.x = stride;
        this.rightLeg.rotation.x = -stride;
        this.leftArm.rotation.x = -stride * 0.72 - 0.08;
        this.rightArm.rotation.x = stride * 0.72 - 0.08;
        this.root.position.y = (isMoving ? Math.abs(Math.sin(this.animationTime * 10)) * 0.055 : idle * 0.018);
        this.root.rotation.x = 0;
        this.root.rotation.z = isMoving ? Math.sin(this.animationTime * 10) * 0.018 : idle * 0.008;
        this.updateGroundShadow();
    }

    public async loadExternalModel(
        source: GltfAssetSource,
        onProgress?: (progress: GltfLoadProgress) => void
    ): Promise<boolean> {
        const loaded = await loadGltfModel(this.root.getScene(), source, onProgress);
        if (!loaded) return false;

        this.externalAnimations?.dispose();
        this.externalModel?.dispose();
        this.externalModel = loaded;
        this.externalModel.root.parent = this.root;
        this.externalAnimations = new GltfAnimationController(loaded.animationGroups);

        // 有正式骨骼挂点时把武器锚点迁移过去；没有挂点仍保留程序化模型降级。
        const weaponNode = loaded.findNode('weaponAnchor')
            ?? loaded.findNode('hand_r')
            ?? loaded.findNode('RightHand');
        if (weaponNode) {
            this.weaponAnchor.parent = weaponNode;
            this.weaponAnchor.position.setAll(0);
            this.weaponAnchor.rotation.setAll(0);
        }
        this.meshState.forEach(mesh => mesh.visibility = 0);
        this.externalAnimations.play('idle');
        return true;
    }

    private updateGroundShadow(): void {
        const worldPosition = this.followTarget.getAbsolutePosition();
        this.groundShadow.position.x = worldPosition.x;
        this.groundShadow.position.z = worldPosition.z;
    }

    public dispose(): void {
        this.externalAnimations?.dispose();
        this.externalModel?.dispose();
        this.externalAnimations = null;
        this.externalModel = null;
        this.groundShadow.dispose();
        this.root.dispose(false);
        this.materials.forEach(material => material.dispose());
    }

    private createTorso(palette: PlayerPalette, scene: Scene): void {
        const torso = this.createBox(
            'playerTorso',
            { width: 0.82, height: 0.78, depth: 0.4 },
            new Vector3(0, 0.18, 0),
            palette.cloth,
            this.root,
            scene
        );
        torso.scaling.x = 0.92;

        const chestPlate = this.createBox(
            'playerChestPlate',
            { width: 0.7, height: 0.54, depth: 0.12 },
            new Vector3(0, 0.27, 0.23),
            palette.armor,
            this.root,
            scene
        );
        chestPlate.rotation.x = -0.05;

        this.createBox(
            'playerBelt',
            { width: 0.86, height: 0.12, depth: 0.46 },
            new Vector3(0, -0.23, 0),
            palette.leather,
            this.root,
            scene
        );
        this.createBox(
            'playerBeltBuckle',
            { width: 0.16, height: 0.14, depth: 0.08 },
            new Vector3(0, -0.22, 0.28),
            palette.armor,
            this.root,
            scene
        );

        const cape = this.createBox(
            'playerCape',
            { width: 0.72, height: 0.9, depth: 0.055 },
            new Vector3(0, 0.05, -0.25),
            palette.cape,
            this.root,
            scene
        );
        cape.rotation.x = -0.12;
    }

    private createGroundShadow(scene: Scene): Mesh {
        const material = new StandardMaterial('playerGroundShadowMaterial', scene);
        material.diffuseColor = Color3.Black();
        material.emissiveColor = new Color3(0.015, 0.02, 0.025);
        material.alpha = 0.28;
        material.disableLighting = true;
        material.backFaceCulling = false;
        this.materials.push(material);

        const shadow = CreateDisc('playerGroundShadow', { radius: 0.62, tessellation: 24 }, scene);
        shadow.position.y = 0.022;
        shadow.rotation.x = Math.PI / 2;
        shadow.scaling.z = 0.72;
        shadow.material = material;
        shadow.isPickable = false;
        this.meshState.push(shadow);
        return shadow;
    }

    private createHead(palette: PlayerPalette, scene: Scene): void {
        const neck = CreateCylinder(
            'playerNeck',
            { height: 0.18, diameter: 0.24, tessellation: 10 },
            scene
        );
        neck.position = new Vector3(0, 0.68, 0);
        neck.parent = this.root;
        neck.material = palette.skin;
        this.track(neck);

        const head = CreateIcoSphere(
            'playerHead',
            { radiusX: 0.29, radiusY: 0.33, radiusZ: 0.28, subdivisions: 2, flat: true },
            scene
        );
        head.position = new Vector3(0, 0.91, 0);
        head.parent = this.root;
        head.material = palette.skin;
        this.track(head);

        const helmet = CreateIcoSphere(
            'playerHelmet',
            { radiusX: 0.34, radiusY: 0.31, radiusZ: 0.32, subdivisions: 2, flat: true },
            scene
        );
        helmet.position = new Vector3(0, 1.04, -0.015);
        helmet.parent = this.root;
        helmet.material = palette.armorDark;
        this.track(helmet);

        this.createBox(
            'playerHelmetBand',
            { width: 0.68, height: 0.1, depth: 0.38 },
            new Vector3(0, 0.98, 0.11),
            palette.armor,
            this.root,
            scene
        );

        for (const side of [-1, 1]) {
            this.createBox(
                `playerEye_${side}`,
                { width: 0.075, height: 0.045, depth: 0.035 },
                new Vector3(side * 0.105, 0.92, 0.285),
                palette.eye,
                this.root,
                scene
            );
        }

        const crest = CreateBox(
            'playerHelmetCrest',
            { width: 0.08, height: 0.38, depth: 0.42 },
            scene
        );
        crest.position = new Vector3(0, 1.34, -0.03);
        crest.rotation.x = -0.2;
        crest.parent = this.root;
        crest.material = palette.cape;
        this.track(crest);
    }

    private createArm(root: TransformNode, palette: PlayerPalette, side: number, scene: Scene): void {
        const shoulder = CreateIcoSphere(
            `playerShoulder_${side}`,
            { radiusX: 0.25, radiusY: 0.2, radiusZ: 0.24, subdivisions: 1, flat: true },
            scene
        );
        shoulder.position = new Vector3(0, 0.02, 0);
        shoulder.parent = root;
        shoulder.material = palette.armor;
        this.track(shoulder);

        const arm = this.createBox(
            `playerArm_${side}`,
            { width: 0.22, height: 0.58, depth: 0.24 },
            new Vector3(0, -0.3, 0),
            palette.cloth,
            root,
            scene
        );
        arm.rotation.z = side * 0.04;

        const bracer = CreateCylinder(
            `playerBracer_${side}`,
            { height: 0.26, diameterTop: 0.2, diameterBottom: 0.24, tessellation: 8 },
            scene
        );
        bracer.position = new Vector3(0, -0.49, 0);
        bracer.parent = root;
        bracer.material = palette.armorDark;
        this.track(bracer);

        const hand = CreateIcoSphere(
            `playerHand_${side}`,
            { radius: 0.13, subdivisions: 1, flat: true },
            scene
        );
        hand.position = new Vector3(0, -0.65, 0.02);
        hand.parent = root;
        hand.material = palette.skin;
        this.track(hand);
    }

    private createLeg(root: TransformNode, palette: PlayerPalette, side: number, scene: Scene): void {
        this.createBox(
            `playerLeg_${side}`,
            { width: 0.27, height: 0.62, depth: 0.3 },
            new Vector3(0, -0.28, 0),
            palette.armorDark,
            root,
            scene
        );
        const boot = this.createBox(
            `playerBoot_${side}`,
            { width: 0.31, height: 0.28, depth: 0.46 },
            new Vector3(0, -0.7, 0.08),
            palette.leather,
            root,
            scene
        );
        boot.rotation.x = -0.06;
    }

    private createLimbRoot(name: string, position: Vector3, scene: Scene): TransformNode {
        const root = new TransformNode(name, scene);
        root.position.copyFrom(position);
        root.parent = this.root;
        return root;
    }

    private createPalette(scene: Scene): PlayerPalette {
        return {
            armor: this.createMaterial('playerArmor', new Color3(0.32, 0.48, 0.68), new Color3(0.7, 0.75, 0.85), scene),
            armorDark: this.createMaterial('playerArmorDark', new Color3(0.12, 0.2, 0.31), new Color3(0.35, 0.42, 0.55), scene),
            cloth: this.createMaterial('playerCloth', new Color3(0.08, 0.25, 0.38), new Color3(0.03, 0.04, 0.05), scene),
            leather: this.createMaterial('playerLeather', new Color3(0.22, 0.11, 0.055), new Color3(0.08, 0.05, 0.03), scene),
            skin: this.createMaterial('playerSkin', new Color3(0.68, 0.48, 0.34), new Color3(0.08, 0.06, 0.04), scene),
            cape: this.createMaterial('playerCape', new Color3(0.42, 0.055, 0.08), new Color3(0.04, 0.01, 0.01), scene),
            eye: this.createEmissiveMaterial('playerEye', new Color3(0.2, 0.8, 1), scene)
        };
    }

    private createMaterial(name: string, diffuse: Color3, specular: Color3, scene: Scene): StandardMaterial {
        const material = new StandardMaterial(name, scene);
        material.diffuseColor = diffuse;
        material.specularColor = specular;
        this.materials.push(material);
        return material;
    }

    private createEmissiveMaterial(name: string, color: Color3, scene: Scene): StandardMaterial {
        const material = this.createMaterial(name, color.scale(0.25), Color3.Black(), scene);
        material.emissiveColor = color;
        return material;
    }

    private createBox(
        name: string,
        size: { width: number; height: number; depth: number },
        position: Vector3,
        material: StandardMaterial,
        parent: TransformNode,
        scene: Scene
    ): Mesh {
        const mesh = CreateBox(name, size, scene);
        mesh.position.copyFrom(position);
        mesh.parent = parent;
        mesh.material = material;
        this.track(mesh);
        return mesh;
    }

    private track(mesh: Mesh): void {
        mesh.isPickable = false;
        this.meshState.push(mesh);
    }
}
