import * as THREE from 'three';
import { GLTF } from "three/examples/jsm/Addons.js";

export class RenderAssets {
	public texPalette: THREE.Texture | undefined;

	public matDefault: THREE.Material | undefined;

	public model_Missing!: number;
	public model_TileBG!: number;
	public model_Hover!: number;
	public model_HoverActive!: number;
	public model_House1!: number;
	public model_House2!: number;
	public model_House3!: number;

	public model_Factory1!: number;
	public model_Sawmill!: number;

	public model_LineSeg!: number;
	public model_LineCap!: number;

	public model_PathGround_Small!: number;
	public model_PathGround_Large!: number;

	public model_RoadStone!: number;
	public model_Fountain!: number;

	public model_GrassPatch!: number;
	public model_Tree1!: number;
	public model_SingleTrees!: number[];
	public model_BigTree!: number;
	public model_XmasTree!: number;

	public model_Water!: number;
	public model_WaterTiles!: number[];
	public model_Bridge!: number;

	loadModels(gltf: GLTF, batch: THREE.BatchedMesh) {
		this.model_Missing = batch.addGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5));
		this.model_LineSeg = addGeom(this, 'line_seg');
		this.model_LineCap = addGeom(this, 'line_cap');

		this.model_TileBG = addGeom(this, 'tile_bg');
		this.model_Hover = addGeom(this, 'hover');
		this.model_HoverActive = addGeom(this, 'hover_active');
		this.model_House1 = addGeom(this, 'house.001');
		this.model_House2 = addGeom(this, 'house.002');
		this.model_House3 = addGeom(this, 'house.003');
		this.model_Factory1 = addGeom(this, 'building.002');
		this.model_Sawmill = addGeom(this, 'sawmill');

		this.model_RoadStone = addGeom(this, 'road_stone');
		this.model_PathGround_Small = addGeom(this, 'ground_s');
		this.model_PathGround_Large = addGeom(this, 'ground_l');

		this.model_Fountain = addGeom(this, 'fountain');

		this.model_GrassPatch = addGeom(this, 'grass.001');
		this.model_SingleTrees = [
			addGeom(this, 'tree.001'),
			addGeom(this, 'tree.002'),
			addGeom(this, 'tree.003'),
			addGeom(this, 'tree.004'),
		];
		this.model_Tree1 = this.model_SingleTrees[0]!;
		this.model_SingleTrees.push(this.model_Tree1); // make Tree1 more likely
		this.model_BigTree = addGeom(this, 'tree_big.001');
		this.model_XmasTree = addGeom(this, 'tree_xmas');

		this.model_Water = addGeom(this, 'water_0');
		this.model_WaterTiles = [
			this.model_Water, // isolated
			addGeom(this, 'water_End'),
			addGeom(this, 'water_I'),
			addGeom(this, 'water_L'),
			addGeom(this, 'water_L_fill'),
			addGeom(this, 'water_T'),
			addGeom(this, 'water_T_fill_L'),
			addGeom(this, 'water_T_fill_R'),
			addGeom(this, 'water_T_fill'),
			addGeom(this, 'water_X'),
			addGeom(this, 'water_X_fill_1'),
			addGeom(this, 'water_X_fill_2H'),
			addGeom(this, 'water_X_fill_2O'),
			addGeom(this, 'water_X_fill_3'),
			addGeom(this, 'water_Full'),
		];
		this.model_Bridge = addGeom(this, 'bridge');

		return;

		function addGeom(self: RenderAssets, name: string) {
			let geom = gltf.scene.getGeometryByName(name);
			if (!geom) {
				console.warn(`Could not find model '${name}'`);
				return self.model_Missing;
			}
			return batch.addGeometry(geom);
		}
	}

	public getModel(model: ((assets: RenderAssets) => number) | undefined): number {
		if (!model) return this.model_Missing;
		return model(this) ?? this.model_Missing;
	}
}