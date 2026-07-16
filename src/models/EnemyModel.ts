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

interface EnemyPalette {
    skin: StandardMaterial;
    skinDark: StandardMaterial;
    horn: StandardMaterial;
    armor: StandardMaterial;
    eye: StandardMaterial;
    health: StandardMaterial;
    healthBackground: StandardMaterial;
}

export class EnemyModel {
    public readonly root: TransformNode;
    public readonly meshes: readonly Mesh[];
    private readonly visualRoot: TransformNode;
    private readonly leftArm: TransformNode;
    private readonly rightArm: TransformNode;
    private readonly healthFill: Mesh;
    private readonly healthMaterial: StandardMaterial;
    private readonly meshState: Mesh[] = [];
    private readonly bodyMeshes: Mesh[] = [];
    private readonly materials: StandardMaterial[] = [];
    private animationTime: number;
    private attackCharge = 0;
    private readonly eyeMaterial: StandardMaterial;

    public constructor(
        name: string,
        position: Vector3,
        skinColor: Color3,
        scene: Scene,
        animationOffset: number,
        modelScale = 1
    ) {
        this.animationTime = animationOffset;
        this.root = new TransformNode(`${name}Root`, scene);
        this.root.position.copyFrom(position);
        this.visualRoot = new TransformNode(`${name}Visual`, scene);
        this.visualRoot.parent = this.root;
        this.visualRoot.scaling.setAll(modelScale);
        const palette = this.createPalette(name, skinColor, scene);
        this.eyeMaterial = palette.eye;
        this.healthMaterial = palette.health;
        this.createGroundShadow(name, palette, scene);

        this.createBody(name, palette, scene);
        this.createHead(name, palette, scene);
        this.leftArm = this.createArm(name, -1, palette, scene);
        this.rightArm = this.createArm(name, 1, palette, scene);
        this.createLeg(name, -1, palette, scene);
        this.createLeg(name, 1, palette, scene);
        this.healthFill = this.createHealthBar(name, palette, scene);
        this.meshes = this.meshState;
    }

    public update(deltaSeconds: number, isMoving: boolean): void {
        this.animationTime += deltaSeconds;
        const pulse = Math.sin(this.animationTime * 3.2);
        const stride = Math.sin(this.animationTime * 7.5) * (isMoving ? 0.38 : 0.08);
        this.visualRoot.position.y = Math.abs(pulse) * 0.045;
        this.visualRoot.scaling.y = 1 + pulse * 0.018;
        this.visualRoot.scaling.x = 1 - pulse * 0.012;
        if (this.attackCharge > 0) {
            const raised = -0.35 - this.attackCharge * 1.15;
            this.leftArm.rotation.x = raised;
            this.rightArm.rotation.x = raised;
            this.visualRoot.scaling.x += this.attackCharge * 0.055;
        } else {
            this.leftArm.rotation.x = stride;
            this.rightArm.rotation.x = -stride;
        }
    }

    public setAttackTelegraph(progress: number): void {
        this.attackCharge = Math.max(0, Math.min(1, progress));
        this.eyeMaterial.emissiveColor = Color3.Lerp(
            new Color3(1, 0.14, 0.03),
            new Color3(1, 0.85, 0.12),
            this.attackCharge
        );
    }

    public setHealthRatio(ratio: number): void {
        const clamped = Math.max(0, Math.min(1, ratio));
        this.healthFill.scaling.x = Math.max(0.001, clamped);
        this.healthFill.position.x = -(1 - clamped) * 0.5;
        const healthColor = clamped > 0.6
            ? new Color3(0.2, 0.95, 0.3)
            : clamped > 0.3
                ? new Color3(1, 0.62, 0.06)
                : new Color3(1, 0.08, 0.04);
        this.healthMaterial.diffuseColor = healthColor.scale(0.25);
        this.healthMaterial.emissiveColor = healthColor;
        this.healthFill.visibility = clamped > 0 ? 1 : 0;
        this.healthFill.computeWorldMatrix(true);
    }

    public setHitFlash(active: boolean): void {
        this.bodyMeshes.forEach(mesh => {
            mesh.renderOverlay = active;
            mesh.overlayColor = Color3.White();
            mesh.overlayAlpha = 0.92;
        });
    }

    public dispose(): void {
        this.root.dispose(false);
        this.materials.forEach(material => material.dispose());
    }

    private createBody(name: string, palette: EnemyPalette, scene: Scene): void {
        const body = CreateIcoSphere(
            `${name}Body`,
            { radiusX: 0.52, radiusY: 0.64, radiusZ: 0.42, subdivisions: 2, flat: true },
            scene
        );
        body.position = new Vector3(0, 0.18, 0);
        body.parent = this.visualRoot;
        body.material = palette.skinDark;
        this.trackBody(body);

        const chest = CreateBox(
            `${name}ChestArmor`,
            { width: 0.72, height: 0.38, depth: 0.12 },
            scene
        );
        chest.position = new Vector3(0, 0.28, 0.4);
        chest.parent = this.visualRoot;
        chest.material = palette.armor;
        this.trackBody(chest);

        const bellyRune = CreateIcoSphere(
            `${name}BellyRune`,
            { radiusX: 0.13, radiusY: 0.17, radiusZ: 0.055, subdivisions: 1, flat: true },
            scene
        );
        bellyRune.position = new Vector3(0, 0.1, 0.5);
        bellyRune.parent = this.visualRoot;
        bellyRune.material = palette.eye;
        this.trackBody(bellyRune);
    }

    private createGroundShadow(name: string, palette: EnemyPalette, scene: Scene): void {
        const shadow = CreateDisc(`${name}GroundShadow`, { radius: 0.68, tessellation: 20 }, scene);
        shadow.parent = this.root;
        shadow.position.y = -0.985;
        shadow.rotation.x = Math.PI / 2;
        shadow.scaling.z = 0.72;
        shadow.material = palette.healthBackground;
        shadow.visibility = 0.48;
        shadow.isPickable = false;
        this.meshState.push(shadow);
    }

    private createHead(name: string, palette: EnemyPalette, scene: Scene): void {
        const head = CreateIcoSphere(
            `${name}Head`,
            { radiusX: 0.42, radiusY: 0.36, radiusZ: 0.39, subdivisions: 2, flat: true },
            scene
        );
        head.position = new Vector3(0, 0.86, 0.03);
        head.parent = this.visualRoot;
        head.material = palette.skin;
        this.trackBody(head);

        for (const side of [-1, 1]) {
            const horn = CreateCylinder(
                `${name}Horn_${side}`,
                { height: 0.52, diameterTop: 0, diameterBottom: 0.19, tessellation: 6 },
                scene
            );
            horn.position = new Vector3(side * 0.31, 1.18, -0.01);
            horn.rotation.z = side * -0.58;
            horn.parent = this.visualRoot;
            horn.material = palette.horn;
            this.trackBody(horn);

            const eye = CreateBox(
                `${name}Eye_${side}`,
                { width: 0.11, height: 0.065, depth: 0.04 },
                scene
            );
            eye.position = new Vector3(side * 0.15, 0.9, 0.39);
            eye.rotation.z = side * -0.12;
            eye.parent = this.visualRoot;
            eye.material = palette.eye;
            this.trackBody(eye);

            const tusk = CreateCylinder(
                `${name}Tusk_${side}`,
                { height: 0.22, diameterTop: 0, diameterBottom: 0.075, tessellation: 5 },
                scene
            );
            tusk.position = new Vector3(side * 0.19, 0.69, 0.37);
            tusk.rotation.z = side * 0.18;
            tusk.parent = this.visualRoot;
            tusk.material = palette.horn;
            this.trackBody(tusk);
        }
    }

    private createArm(
        name: string,
        side: number,
        palette: EnemyPalette,
        scene: Scene
    ): TransformNode {
        const root = new TransformNode(`${name}ArmRoot_${side}`, scene);
        root.position = new Vector3(side * 0.55, 0.38, 0);
        root.parent = this.visualRoot;

        const shoulder = CreateIcoSphere(
            `${name}Shoulder_${side}`,
            { radius: 0.25, subdivisions: 1, flat: true },
            scene
        );
        shoulder.parent = root;
        shoulder.material = palette.armor;
        this.trackBody(shoulder);

        const forearm = CreateCylinder(
            `${name}Forearm_${side}`,
            { height: 0.62, diameterTop: 0.24, diameterBottom: 0.33, tessellation: 7 },
            scene
        );
        forearm.position = new Vector3(side * 0.03, -0.35, 0);
        forearm.rotation.z = side * 0.08;
        forearm.parent = root;
        forearm.material = palette.skin;
        this.trackBody(forearm);

        const claw = CreateIcoSphere(
            `${name}Claw_${side}`,
            { radiusX: 0.2, radiusY: 0.16, radiusZ: 0.24, subdivisions: 1, flat: true },
            scene
        );
        claw.position = new Vector3(side * 0.06, -0.7, 0.05);
        claw.parent = root;
        claw.material = palette.skinDark;
        this.trackBody(claw);
        return root;
    }

    private createLeg(name: string, side: number, palette: EnemyPalette, scene: Scene): void {
        const leg = CreateCylinder(
            `${name}Leg_${side}`,
            { height: 0.52, diameterTop: 0.28, diameterBottom: 0.36, tessellation: 7 },
            scene
        );
        leg.position = new Vector3(side * 0.27, -0.52, 0);
        leg.parent = this.visualRoot;
        leg.material = palette.skinDark;
        this.trackBody(leg);

        const foot = CreateBox(
            `${name}Foot_${side}`,
            { width: 0.36, height: 0.2, depth: 0.52 },
            scene
        );
        foot.position = new Vector3(side * 0.27, -0.82, 0.13);
        foot.parent = this.visualRoot;
        foot.material = palette.skin;
        this.trackBody(foot);
    }

    private createHealthBar(name: string, palette: EnemyPalette, scene: Scene): Mesh {
        const barRoot = new TransformNode(`${name}HealthBarRoot`, scene);
        barRoot.position = new Vector3(0, 1.62, 0);
        barRoot.billboardMode = Mesh.BILLBOARDMODE_ALL;
        barRoot.parent = this.root;

        const background = CreateBox(
            `${name}HealthBackground`,
            { width: 1.14, height: 0.14, depth: 0.035 },
            scene
        );
        background.parent = barRoot;
        background.material = palette.healthBackground;
        background.isPickable = false;
        this.meshState.push(background);

        const fill = CreateBox(
            `${name}HealthFill`,
            { width: 1, height: 0.08, depth: 0.045 },
            scene
        );
        fill.position.z = -0.025;
        fill.parent = barRoot;
        fill.material = palette.health;
        fill.isPickable = false;
        this.meshState.push(fill);
        return fill;
    }

    private createPalette(name: string, skinColor: Color3, scene: Scene): EnemyPalette {
        return {
            skin: this.createMaterial(`${name}Skin`, skinColor, new Color3(0.08, 0.03, 0.03), scene),
            skinDark: this.createMaterial(`${name}SkinDark`, skinColor.scale(0.52), new Color3(0.04, 0.02, 0.02), scene),
            horn: this.createMaterial(`${name}Horn`, new Color3(0.55, 0.48, 0.34), new Color3(0.12, 0.1, 0.07), scene),
            armor: this.createMaterial(`${name}Armor`, new Color3(0.16, 0.14, 0.18), new Color3(0.3, 0.24, 0.32), scene),
            eye: this.createEmissiveMaterial(`${name}Eye`, new Color3(1, 0.14, 0.03), scene),
            health: this.createEmissiveMaterial(`${name}Health`, new Color3(0.2, 0.95, 0.3), scene),
            healthBackground: this.createMaterial(`${name}HealthBackground`, new Color3(0.025, 0.025, 0.03), Color3.Black(), scene)
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
        material.disableLighting = true;
        return material;
    }

    private trackBody(mesh: Mesh): void {
        mesh.isPickable = false;
        this.bodyMeshes.push(mesh);
        this.meshState.push(mesh);
    }
}
