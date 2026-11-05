import * as THREE from 'three';
import { GLTF } from "three/examples/jsm/Addons.js";
import { CTX } from '../GameState';
import { Tiles } from '../_tiles_';
import { ModelMesh, ModelMeshFlags } from './ModelMesh';
import { DrawBatch } from './GameRenderer';

export let dev_ShouldAddDevVisualModels = 0;
export function addDevVisualModels(ctx: CTX) {
	// Dev: Add various models for visual development
	console.warn("Adding Dev Visual Models");
	ctx.startCombinedAnim();

	if (dev_ShouldAddDevVisualModels == 1) {
		const tile = Tiles.Pasture;
		addRotations(ctx, 1, 1, tile);
		addRotations(ctx, 5, 1, tile);
		addRotations(ctx, 1, 2, tile);
		addRotations(ctx, 5, 2, tile);
		addRotations(ctx, 1, 3, tile);
		addRotations(ctx, 5, 3, tile);
		addRotations(ctx, 1, 4, tile);
		addRotations(ctx, 5, 4, tile);
		addRotations(ctx, 1, 5, tile);
		addRotations(ctx, 5, 5, tile);
		addRotations(ctx, 1, 6, tile);
		addRotations(ctx, 5, 6, tile);
		addRotations(ctx, 1, 7, tile);
		addRotations(ctx, 5, 7, tile);
		addRotations(ctx, 1, 8, tile);
		addRotations(ctx, 5, 8, tile);
	}

	if (dev_ShouldAddDevVisualModels == 2) {
		addTile(ctx, 1, 8, Tiles.House1, 270);
		addTile(ctx, 2, 8, Tiles.House2, 270);
		addTile(ctx, 3, 8, Tiles.House3, 270);
		addTile(ctx, 4, 8, Tiles.Church);
		addTile(ctx, 5, 8, Tiles.Graveyard);
		addTile(ctx, 6, 8, Tiles.Fountain);
		addTile(ctx, 7, 8, Tiles.TownBell);

		addTile(ctx, 1, 7, Tiles.Building);
		addTile(ctx, 2, 7, Tiles.Sawmill);

		addTile(ctx, 8, 1, Tiles.BigTree);
		addTile(ctx, 7, 1, Tiles.Forest);
		addTile(ctx, 6, 1, Tiles.Tree);
		addTile(ctx, 5, 1, Tiles.Stone);

		addTiles(ctx, 1, 5, 2, [
			Tiles.Pasture, Tiles.Pasture,
			[Tiles.Barn, 180], Tiles.Pasture,
		]);

		addTiles(ctx, 7, 2, 2, [
			Tiles.Field, Tiles.Field,
			Tiles.Field, Tiles.Field,
		]);

		addTiles(ctx, 1, 1, 3, [
			Tiles.Water, Tiles.Water, Tiles.Water,
			Tiles.Path, Tiles.Water, Tiles.Path,
			Tiles.Water, Tiles.Water, null,
			Tiles.Water, Tiles.Water, null,
		]);

		// addTile(ctx, 6, 2, Tiles.Barn, 180);
		// addTile(ctx, 7, 2, Tiles.Field);
		// addTile(ctx, 6, 1, Tiles.Field);
		// addTile(ctx, 7, 1, Tiles.Field);
	}

	ctx.applyRules();
	ctx.endAndAddCombinedAnim();

	function addRotations(self, xStart, y, tileType) {
		self.replaceTile(self.game.grid.get(xStart++, y), tileType, 0);
		self.replaceTile(self.game.grid.get(xStart++, y), tileType, 90);
		self.replaceTile(self.game.grid.get(xStart++, y), tileType, 180);
		self.replaceTile(self.game.grid.get(xStart++, y), tileType, 270);
	}

	function addTile(self, x, y, tileType, rot = 0) {
		self.replaceTile(self.game.grid.get(x, y), tileType, rot);
	}

	function addTiles(self, x0, y0, width, tiles) {
		let i = 0;
		const height = tiles.length / width;
		for (let y = 0; y < height; ++y) {
			for (let x = 0; x < width; ++x) {
				const tile = tiles[i++];
				if (!tile) continue;
				if (tile.length && tile.length > 0)
					self.replaceTile(self.game.grid.get(x0 + x, y0 + y), tile[0], tile[1]);
				else
					self.replaceTile(self.game.grid.get(x0 + x, y0 + y), tile, 0);
			}
		}
	}
}

export class RenderAssets {
	public tex_Palette: THREE.Texture | undefined;
	public tex_GeomData: THREE.DataTexture | undefined;

	public mat_Default: THREE.Material | undefined;

	public model_Missing!: ModelMesh;
	public model_TileBG!: ModelMesh;
	public model_Hover!: ModelMesh;
	public model_HoverActive!: ModelMesh;

	public model_House!: ModelMesh;
	public model_House_L!: ModelMesh;
	public model_House_Big!: ModelMesh;
	public model_Church!: ModelMesh;
	public model_Graves!: ModelMesh[];

	public model_Building!: ModelMesh;
	public model_Sawmill!: ModelMesh;
	public model_StoneWalls!: ModelMesh[];
	public model_Fences!: ModelMesh[];
	public model_Barn!: ModelMesh;

	public model_LineSeg!: ModelMesh;
	public model_LineCap!: ModelMesh;

	public model_PathGround_Small!: ModelMesh;
	public model_PathGround_Large!: ModelMesh;

	public model_RoadStone!: ModelMesh;
	public model_Fountain!: ModelMesh;
	public model_TownBell!: ModelMesh;

	public model_GrassPatch!: ModelMesh;
	public model_GrassPatches!: ModelMesh[];
	public model_Tree1!: ModelMesh;
	public model_SingleTrees!: ModelMesh[];
	public model_BigTree!: ModelMesh;
	public model_XmasTree!: ModelMesh;

	public model_Stone1!: ModelMesh;
	public model_SingleStones!: ModelMesh[];

	public model_Water!: ModelMesh;
	public model_WaterTiles!: ModelMesh[];
	public model_Bridge!: ModelMesh;

	// Animals
	public model_Cows!: ModelMesh[];

	public allModels: ModelMesh[] = [];

	loadModels(gltf: GLTF, batch: DrawBatch) {
		{
			const missingGeom = new THREE.BoxGeometry(0.5, 0.5, 0.5);
			const uvs = missingGeom.attributes.uv!;
			for (let i = 0; i < uvs.count; i++) {
				uvs.setXY(i, 0, 0);
			}
			this.model_Missing = new ModelMesh(batch.mesh.addGeometry(missingGeom));
			this.allModels.push(this.model_Missing);
		}

		this.model_LineSeg = addMesh(this, 'line_seg', ModelMeshFlags.NoHeightShading);
		this.model_LineCap = addMesh(this, 'line_cap', ModelMeshFlags.NoHeightShading);

		this.model_TileBG = addMesh(this, 'tile_bg', ModelMeshFlags.None);
		this.model_Hover = addMesh(this, 'hover');
		this.model_HoverActive = addMesh(this, 'hover_active');

		this.model_House = addMesh(this, 'house');
		this.model_House_L = addMesh(this, 'house_L');
		this.model_House_Big = addMesh(this, 'house_Big');
		this.model_Church = addMesh(this, 'church');
		this.model_Graves = [
			addMesh(this, 'grave.001'),
			addMesh(this, 'grave.002'),
			addMesh(this, 'grave.003'),
			addMesh(this, 'grave.004'),
		];

		this.model_Building = addMesh(this, 'building');
		this.model_Sawmill = addMesh(this, 'sawmill');
		this.model_StoneWalls = [
			addMesh(this, 'wall_0', ModelMeshFlags.Default),
			addMesh(this, 'wall_End', ModelMeshFlags.Default),
			addMesh(this, 'wall_I', ModelMeshFlags.Default),
			addMesh(this, 'wall_L', ModelMeshFlags.Default),
			addMesh(this, 'wall_T', ModelMeshFlags.Default),
		];
		this.model_Fences = [
			addMesh(this, 'fence_0', ModelMeshFlags.Default),
			addMesh(this, 'fence_End', ModelMeshFlags.Default),
			addMesh(this, 'fence_I', ModelMeshFlags.Default),
			addMesh(this, 'fence_L', ModelMeshFlags.Default),
			addMesh(this, 'fence_T', ModelMeshFlags.Default),
		];
		this.model_Barn = addMesh(this, 'barn');

		this.model_RoadStone = addMesh(this, 'road_stone');
		this.model_PathGround_Small = addMesh(this, 'ground_s', ModelMeshFlags.NoHeightShading);
		this.model_PathGround_Large = addMesh(this, 'ground_l', ModelMeshFlags.NoHeightShading);

		this.model_Fountain = addMesh(this, 'fountain');
		this.model_TownBell = addMesh(this, 'town_bell');

		this.model_GrassPatch = addMesh(this, 'grass.001');
		this.model_GrassPatches = [
			addMesh(this, 'grass.002'),
			addMesh(this, 'grass.003'),
			addMesh(this, 'grass.004'),
			addMesh(this, 'grass.005'),
		];
		this.model_SingleTrees = [
			addMesh(this, 'tree.001'),
			addMesh(this, 'tree.002'),
			addMesh(this, 'tree.003'),
			addMesh(this, 'tree.004'),
		];
		this.model_Tree1 = this.model_SingleTrees[0]!;
		this.model_SingleTrees.push(this.model_Tree1); // make Tree1 more likely
		this.model_BigTree = addMesh(this, 'tree_big.001');
		this.model_XmasTree = addMesh(this, 'tree_xmas');

		this.model_SingleStones = [
			addMesh(this, 'stone.001'),
			addMesh(this, 'stone.002'),
			addMesh(this, 'stone.003'),
			addMesh(this, 'stone.004'),
		];
		this.model_Stone1 = this.model_SingleStones[0]!;

		this.model_WaterTiles = [
			addMesh(this, 'water_0', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_End', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_I', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_L', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_T', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_X', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_L_fill', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_T_fill_L', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_T_fill_R', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_T_fill', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_X_fill_1', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_X_fill_2H', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_X_fill_2O', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_X_fill_3', ModelMeshFlags.NoHeightShading),
			addMesh(this, 'water_Full', ModelMeshFlags.NoHeightShading),
		];
		this.model_Water = this.model_WaterTiles[0]!;
		this.model_Bridge = addMesh(this, 'bridge');

		// Animals
		this.model_Cows = [
			addMesh(this, 'cow.001'),
			addMesh(this, 'cow.002'),
		];

		return;

		function addMesh(self: RenderAssets, name: string, flags: ModelMeshFlags = ModelMeshFlags.Default) {
			let geom = gltf.scene.getGeometryByName(name);
			if (!geom) {
				console.warn(`Could not find model '${name}'`);
				return self.model_Missing;
			}

			const geometryId = batch.mesh.addGeometry(geom);
			const model = new ModelMesh(geometryId, flags);
			self.allModels.push(model);
			return model;
		}
	}

	public getModel(model: ((assets: RenderAssets) => ModelMesh) | undefined): ModelMesh {
		if (!model) return this.model_Missing;
		return model(this) ?? this.model_Missing;
	}
}