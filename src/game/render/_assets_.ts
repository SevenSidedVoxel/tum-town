import * as THREE from 'three';
import { GLTF } from "three/examples/jsm/Addons.js";
import { CTX } from '../GameState';
import { Tiles } from '../_tiles_';

export const dev_ShouldAddDevVisualModels = false;
export function addDevVisualModels(ctx: CTX) {
	// Dev: Add various models for visual development
	console.warn("Adding Dev Visual Models");
	ctx.startCombinedAnim();

	if (true) {
		addRotations(ctx, 1, 1, Tiles.Graveyard);
		addRotations(ctx, 5, 1, Tiles.Graveyard);
		addRotations(ctx, 1, 2, Tiles.Graveyard);
		addRotations(ctx, 5, 2, Tiles.Graveyard);
		addRotations(ctx, 1, 3, Tiles.Graveyard);
		addRotations(ctx, 5, 3, Tiles.Graveyard);
		addRotations(ctx, 1, 4, Tiles.Graveyard);
		addRotations(ctx, 5, 4, Tiles.Graveyard);
		addRotations(ctx, 1, 5, Tiles.Graveyard);
		addRotations(ctx, 5, 5, Tiles.Graveyard);
		addRotations(ctx, 1, 6, Tiles.Graveyard);
		addRotations(ctx, 5, 6, Tiles.Graveyard);
		addRotations(ctx, 1, 7, Tiles.Graveyard);
		addRotations(ctx, 5, 7, Tiles.Graveyard);
		addRotations(ctx, 1, 8, Tiles.Graveyard);
		addRotations(ctx, 5, 8, Tiles.Graveyard);
	}

	if (false) {
		addRotations(ctx, 1, 8, Tiles.House2);
		addRotations(ctx, 5, 8, Tiles.House3);

		addRotations(ctx, 1, 7, Tiles.House1);
		addTile(ctx, 5, 7, Tiles.Church);
		addTile(ctx, 6, 7, Tiles.Graveyard);

		addRotations(ctx, 1, 6, Tiles.Foundation1);
		addRotations(ctx, 5, 6, Tiles.Sawmill);

		addTile(ctx, 1, 5, Tiles.Stone);
		addTile(ctx, 2, 5, Tiles.Stone);
		addTile(ctx, 3, 5, Tiles.Stone);
		addTile(ctx, 4, 5, Tiles.Tree);
		addTile(ctx, 5, 5, Tiles.Tree);
		addTile(ctx, 6, 5, Tiles.Forest);
		addTile(ctx, 7, 5, Tiles.Forest);
		addTile(ctx, 8, 5, Tiles.BigTree);

		addRotations(ctx, 1, 4, Tiles.Path);
		addTile(ctx, 5, 4, Tiles.Fountain);
		addTile(ctx, 6, 4, Tiles.TownBell);

		addTile(ctx, 1, 3, Tiles.Water);
		addTile(ctx, 2, 3, Tiles.Water);
		addTile(ctx, 3, 3, Tiles.Water);
		addTile(ctx, 4, 3, Tiles.Water);
		addTile(ctx, 5, 3, Tiles.Water);
		addTile(ctx, 1, 2, Tiles.Water);
		addTile(ctx, 2, 2, Tiles.Water);
		addTile(ctx, 4, 2, Tiles.Water);
		addTile(ctx, 4, 1, Tiles.Water);
		addTile(ctx, 3, 2, Tiles.Path);
		addTile(ctx, 5, 2, Tiles.Path);
	}

	ctx.applyRules();
	ctx.endAndAddCombinedAnim();

	function addRotations(self, xStart, y, tileType) {
		self.replaceTile(self.game.grid.get(xStart++, y), tileType, 0);
		self.replaceTile(self.game.grid.get(xStart++, y), tileType, 90);
		self.replaceTile(self.game.grid.get(xStart++, y), tileType, 180);
		self.replaceTile(self.game.grid.get(xStart++, y), tileType, 270);
	}

	function addTile(self, x, y, tileType) {
		self.replaceTile(self.game.grid.get(x, y), tileType, 0);
	}
}

export class RenderAssets {
	public texPalette: THREE.Texture | undefined;

	public matDefault: THREE.Material | undefined;

	public model_Missing!: number;
	public model_TileBG!: number;
	public model_Hover!: number;
	public model_HoverActive!: number;

	public model_House!: number;
	public model_House_L!: number;
	public model_House_Big!: number;
	public model_Church!: number;
	public model_Graves!: number[];

	public model_Building!: number;
	public model_Sawmill!: number;

	public model_LineSeg!: number;
	public model_LineCap!: number;

	public model_PathGround_Small!: number;
	public model_PathGround_Large!: number;

	public model_RoadStone!: number;
	public model_Fountain!: number;
	public model_TownBell!: number;

	public model_GrassPatch!: number;
	public model_Tree1!: number;
	public model_SingleTrees!: number[];
	public model_BigTree!: number;
	public model_XmasTree!: number;

	public model_Stone1!: number;
	public model_SingleStones!: number[];

	public model_Water!: number;
	public model_WaterTiles!: number[];
	public model_Bridge!: number;

	loadModels(gltf: GLTF, batch: THREE.BatchedMesh) {
		{
			const missingGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
			const uvs = missingGeom.attributes.uv!;
			for (let i = 0; i < uvs.count; i++) {
				uvs.setXY(i, 0, 0);
			}
			this.model_Missing = batch.addGeometry(missingGeom);
		}

		this.model_LineSeg = addGeom(this, 'line_seg');
		this.model_LineCap = addGeom(this, 'line_cap');

		this.model_TileBG = addGeom(this, 'tile_bg');
		this.model_Hover = addGeom(this, 'hover');
		this.model_HoverActive = addGeom(this, 'hover_active');

		this.model_House = addGeom(this, 'house');
		this.model_House_L = addGeom(this, 'house_L');
		this.model_House_Big = addGeom(this, 'house_Big');
		this.model_Church = addGeom(this, 'church');
		this.model_Graves = [
			addGeom(this, 'grave.001'),
			addGeom(this, 'grave.002'),
			addGeom(this, 'grave.003'),
			addGeom(this, 'grave.004'),
		];

		this.model_Building = addGeom(this, 'building');
		this.model_Sawmill = addGeom(this, 'sawmill');

		this.model_RoadStone = addGeom(this, 'road_stone');
		this.model_PathGround_Small = addGeom(this, 'ground_s');
		this.model_PathGround_Large = addGeom(this, 'ground_l');

		this.model_Fountain = addGeom(this, 'fountain');
		this.model_TownBell = addGeom(this, 'town_bell');

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

		this.model_SingleStones = [
			addGeom(this, 'stone.001'),
			addGeom(this, 'stone.002'),
			addGeom(this, 'stone.003'),
			addGeom(this, 'stone.004'),
		];
		this.model_Stone1 = this.model_SingleStones[0]!;

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