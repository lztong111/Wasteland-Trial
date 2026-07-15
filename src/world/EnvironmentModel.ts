import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.pure';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.pure';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.pure';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder.pure';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { PhysicsShapeType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin';
import { PhysicsAggregate } from '@babylonjs/core/Physics/v2/physicsAggregate';
import { Scene } from '@babylonjs/core/scene';
import { gameConfig } from '../config/gameConfig';

interface MaterialPalette {
    grass: StandardMaterial;
    path: StandardMaterial;
    stone: StandardMaterial;
    stoneDark: StandardMaterial;
    trunk: StandardMaterial;
    leaves: StandardMaterial;
    leavesLight: StandardMaterial;
    crystal: StandardMaterial;
}

export class EnvironmentModel {
    private readonly materials: StandardMaterial[] = [];
    private readonly meshes: Mesh[] = [];
    private readonly aggregates: PhysicsAggregate[] = [];

    public constructor(private readonly scene: Scene) {
        this.scene.clearColor = new Color4(0.055, 0.08, 0.13, 1);
        this.scene.fogMode = Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.007;
        this.scene.fogColor = new Color3(0.14, 0.2, 0.27);

        const ambientLight = new HemisphericLight('ambientLight', new Vector3(0, 1, 0), this.scene);
        ambientLight.intensity = 0.58;
        ambientLight.diffuse = new Color3(0.65, 0.78, 1);
        ambientLight.groundColor = new Color3(0.16, 0.2, 0.13);

        const sun = new DirectionalLight('sunLight', new Vector3(-0.55, -1, 0.38), this.scene);
        sun.position = new Vector3(24, 32, -20);
        sun.intensity = 1.35;
        sun.diffuse = new Color3(1, 0.82, 0.62);

        const palette = this.createPalette();
        this.createGround(palette);
        this.createRuins(palette);
        this.createTrees(palette);
        this.createRocksAndCrystals(palette);
        this.createGrassClusters(palette);
        this.materials.forEach(material => material.freeze());
    }

    public dispose(): void {
        this.aggregates.splice(0).forEach(aggregate => aggregate.dispose());
        this.meshes.splice(0).forEach(mesh => mesh.dispose());
        this.materials.splice(0).forEach(material => material.dispose());
    }

    private createPalette(): MaterialPalette {
        return {
            grass: this.createMaterial('grass', new Color3(0.12, 0.28, 0.16), new Color3(0.02, 0.03, 0.02)),
            path: this.createMaterial('path', new Color3(0.34, 0.29, 0.21), new Color3(0.03, 0.025, 0.02)),
            stone: this.createMaterial('stone', new Color3(0.32, 0.36, 0.4), new Color3(0.08, 0.08, 0.08)),
            stoneDark: this.createMaterial('stoneDark', new Color3(0.18, 0.21, 0.25), new Color3(0.04, 0.04, 0.04)),
            trunk: this.createMaterial('trunk', new Color3(0.24, 0.13, 0.08), new Color3(0.02, 0.015, 0.01)),
            leaves: this.createMaterial('leaves', new Color3(0.09, 0.3, 0.19), new Color3(0.02, 0.04, 0.025)),
            leavesLight: this.createMaterial('leavesLight', new Color3(0.16, 0.43, 0.25), new Color3(0.02, 0.05, 0.03)),
            crystal: this.createEmissiveMaterial('crystal', new Color3(0.12, 0.65, 0.95))
        };
    }

    private createGround(palette: MaterialPalette): void {
        const size = gameConfig.world.groundSize;
        const ground = CreateGround('worldGround', { width: size, height: size, subdivisions: 4 }, this.scene);
        ground.material = palette.grass;
        ground.receiveShadows = true;
        this.trackMesh(ground);
        this.aggregates.push(new PhysicsAggregate(
            ground,
            PhysicsShapeType.BOX,
            { mass: 0 },
            this.scene
        ));

        const path = CreateGround('ancientPath', { width: 8, height: 72, subdivisions: 1 }, this.scene);
        path.position.y = 0.018;
        path.rotation.y = 0.12;
        path.material = palette.path;
        path.receiveShadows = true;
        this.trackMesh(path);

        const lightSlabs: Mesh[] = [];
        const darkSlabs: Mesh[] = [];
        for (let index = -8; index <= 8; index += 1) {
            const slab = CreateBox(
                `pathSlab_${index}`,
                { width: 2.2 + Math.abs(index % 3) * 0.25, height: 0.06, depth: 1.25 },
                this.scene
            );
            slab.position = new Vector3((index % 2) * 0.35, 0.05, index * 3.6);
            slab.rotation.y = (index % 3) * 0.07;
            slab.material = index % 2 === 0 ? palette.stoneDark : palette.stone;
            slab.receiveShadows = true;
            (index % 2 === 0 ? darkSlabs : lightSlabs).push(slab);
        }
        this.mergeStaticMeshes('pathSlabsDark', darkSlabs, palette.stoneDark);
        this.mergeStaticMeshes('pathSlabsLight', lightSlabs, palette.stone);
    }

    private createRuins(palette: MaterialPalette): void {
        const ruinCenters = [new Vector3(6, 0, 7), new Vector3(-8, 0, -10)];
        ruinCenters.forEach((center, ruinIndex) => {
            const base = CreateBox(
                `ruinBase_${ruinIndex}`,
                { width: 5.4, height: 0.45, depth: 4.2 },
                this.scene
            );
            base.position = center.add(new Vector3(0, 0.225, 0));
            base.material = palette.stoneDark;
            this.trackStaticCollider(base);

            [-1, 1].forEach(side => {
                const column = CreateCylinder(
                    `ruinColumn_${ruinIndex}_${side}`,
                    { height: 3.6, diameter: 0.72, tessellation: 8 },
                    this.scene
                );
                column.position = center.add(new Vector3(side * 1.75, 2.05, 0.9));
                column.material = palette.stone;
                this.trackStaticCollider(column);

                const capital = CreateBox(
                    `ruinCapital_${ruinIndex}_${side}`,
                    { width: 1.05, height: 0.28, depth: 1.05 },
                    this.scene
                );
                capital.position = column.position.add(new Vector3(0, 1.9, 0));
                capital.material = palette.stoneDark;
            this.trackMesh(capital);
            });

            const lintel = CreateBox(
                `ruinLintel_${ruinIndex}`,
                { width: 4.3, height: 0.52, depth: 0.85 },
                this.scene
            );
            lintel.position = center.add(new Vector3(0, 3.92, 0.9));
            lintel.rotation.z = ruinIndex === 0 ? 0.03 : -0.08;
            lintel.material = palette.stoneDark;
            this.trackMesh(lintel);

            const brokenWall = CreateBox(
                `brokenWall_${ruinIndex}`,
                { width: 3.5, height: 1.45, depth: 0.55 },
                this.scene
            );
            brokenWall.position = center.add(new Vector3(0.55, 0.95, -1.45));
            brokenWall.rotation.y = ruinIndex === 0 ? 0.18 : -0.22;
            brokenWall.material = palette.stone;
            this.trackStaticCollider(brokenWall);
        });
    }

    private createTrees(palette: MaterialPalette): void {
        const treePositions = [
            [-12, -4], [-16, 8], [13, -10], [17, 6], [-20, -17], [21, 17], [-10, 18], [10, 22]
        ];
        const trunks: Mesh[] = [];
        const lowerCrowns: Mesh[] = [];
        const upperCrowns: Mesh[] = [];
        treePositions.forEach(([x, z], index) => {
            const trunk = CreateCylinder(
                `treeTrunk_${index}`,
                { height: 2.8, diameterTop: 0.35, diameterBottom: 0.62, tessellation: 7 },
                this.scene
            );
            trunk.position = new Vector3(x, 1.4, z);
            trunk.rotation.z = (index % 3 - 1) * 0.05;
            trunk.material = palette.trunk;
            trunks.push(trunk);

            const lowerCrown = CreateCylinder(
                `treeCrownLower_${index}`,
                { height: 2.5, diameterTop: 0.15, diameterBottom: 3.1, tessellation: 8 },
                this.scene
            );
            lowerCrown.position = new Vector3(x, 3.2, z);
            lowerCrown.material = palette.leaves;
            lowerCrowns.push(lowerCrown);

            const upperCrown = CreateCylinder(
                `treeCrownUpper_${index}`,
                { height: 2.1, diameterTop: 0.08, diameterBottom: 2.35, tessellation: 8 },
                this.scene
            );
            upperCrown.position = new Vector3(x, 4.45, z);
            upperCrown.material = palette.leavesLight;
            upperCrowns.push(upperCrown);
        });
        this.mergeStaticMeshes('treeTrunks', trunks, palette.trunk);
        this.mergeStaticMeshes('treeLowerCrowns', lowerCrowns, palette.leaves);
        this.mergeStaticMeshes('treeUpperCrowns', upperCrowns, palette.leavesLight);
    }

    private createRocksAndCrystals(palette: MaterialPalette): void {
        const rockPositions = [
            [-5, 3, 0.65], [10, 1, 0.85], [-12, 12, 1.1], [15, 13, 0.7], [-4, -16, 0.9], [8, -18, 1.2]
        ];
        const lightRocks: Mesh[] = [];
        const darkRocks: Mesh[] = [];
        rockPositions.forEach(([x, z, size], index) => {
            const rock = CreateIcoSphere(
                `rock_${index}`,
                { radiusX: size, radiusY: size * 0.65, radiusZ: size * 0.8, subdivisions: 1, flat: true },
                this.scene
            );
            rock.position = new Vector3(x, size * 0.48, z);
            rock.rotation = new Vector3(index * 0.37, index * 0.61, index * 0.19);
            rock.material = index % 2 === 0 ? palette.stone : palette.stoneDark;
            (index % 2 === 0 ? lightRocks : darkRocks).push(rock);
        });
        this.mergeStaticMeshes('rocksLight', lightRocks, palette.stone);
        this.mergeStaticMeshes('rocksDark', darkRocks, palette.stoneDark);

        const crystals: Mesh[] = [];
        [[-6, -7], [11, 8], [-15, 2]].forEach(([x, z], clusterIndex) => {
            for (let shardIndex = 0; shardIndex < 3; shardIndex += 1) {
                const crystal = CreateCylinder(
                    `crystal_${clusterIndex}_${shardIndex}`,
                    {
                        height: 0.8 + shardIndex * 0.25,
                        diameterTop: 0,
                        diameterBottom: 0.28,
                        tessellation: 5
                    },
                    this.scene
                );
                crystal.position = new Vector3(
                    x + (shardIndex - 1) * 0.28,
                    0.4 + shardIndex * 0.12,
                    z + Math.abs(shardIndex - 1) * 0.16
                );
                crystal.rotation.z = (shardIndex - 1) * 0.18;
                crystal.material = palette.crystal;
                crystals.push(crystal);
            }
        });
        this.mergeStaticMeshes('crystalClusters', crystals, palette.crystal);
    }

    private createGrassClusters(palette: MaterialPalette): void {
        const darkGrass: Mesh[] = [];
        const lightGrass: Mesh[] = [];
        for (let cluster = 0; cluster < 18; cluster += 1) {
            const angle = cluster * 2.399;
            const radius = 7 + (cluster % 6) * 3.1;
            const centerX = Math.cos(angle) * radius;
            const centerZ = Math.sin(angle) * radius;
            for (let bladeIndex = 0; bladeIndex < 3; bladeIndex += 1) {
                const blade = CreateBox(
                    `grassBlade_${cluster}_${bladeIndex}`,
                    { width: 0.045, height: 0.42 + bladeIndex * 0.08, depth: 0.035 },
                    this.scene
                );
                blade.position = new Vector3(
                    centerX + (bladeIndex - 1) * 0.12,
                    0.22,
                    centerZ + (bladeIndex % 2) * 0.1
                );
                blade.rotation.z = (bladeIndex - 1) * 0.22;
                blade.rotation.y = angle;
                blade.material = bladeIndex === 1 ? palette.leavesLight : palette.leaves;
                (bladeIndex === 1 ? lightGrass : darkGrass).push(blade);
            }
        }
        this.mergeStaticMeshes('grassDark', darkGrass, palette.leaves);
        this.mergeStaticMeshes('grassLight', lightGrass, palette.leavesLight);
    }

    private createMaterial(name: string, diffuse: Color3, specular: Color3): StandardMaterial {
        const material = new StandardMaterial(name, this.scene);
        material.diffuseColor = diffuse;
        material.specularColor = specular;
        this.materials.push(material);
        return material;
    }

    private createEmissiveMaterial(name: string, color: Color3): StandardMaterial {
        const material = this.createMaterial(name, color.scale(0.35), Color3.Black());
        material.emissiveColor = color.scale(0.72);
        return material;
    }

    private trackMesh(mesh: Mesh): void {
        mesh.isPickable = false;
        mesh.freezeWorldMatrix();
        this.meshes.push(mesh);
    }

    private mergeStaticMeshes(
        name: string,
        sourceMeshes: Mesh[],
        material: StandardMaterial,
    ): void {
        const merged = Mesh.MergeMeshes(sourceMeshes, true, true, undefined, false, true);
        if (!merged) throw new Error(`无法合并静态模型：${name}`);
        merged.name = name;
        merged.material = material;
        merged.receiveShadows = true;
        this.trackMesh(merged);
    }

    private trackStaticCollider(mesh: Mesh): void {
        this.trackMesh(mesh);
        mesh.receiveShadows = true;
        this.aggregates.push(new PhysicsAggregate(
            mesh,
            PhysicsShapeType.BOX,
            { mass: 0 },
            this.scene
        ));
    }
}
