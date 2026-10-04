import { P2 } from "./P2";
import { Colors, Colors3 } from '../styles/colors';
import { Anims, GameAnim } from './GameAnims';
import { BatchedInstance } from './GameRenderer';
import { float3, color3, quat4, ZAxis, Utils3 } from '../utils/threeUtils';
import { RandomSlice } from "./SeededRandom";
import { GameState } from "./GameState";
import { Rule, MatchFlags } from "./Rule";
import { RectAreaLightUniformsLib } from "three/examples/jsm/Addons.js";

export class Tile {
	public pos: P2;
	public type: TileType;
	public draw: TileDraw | null = null;
	public shouldRegen: boolean = false;
	public shouldCheck: boolean = false;

	constructor(pos: P2, type: TileType) {
		this.pos = pos;
		this.type = type;
	}

	getCenterPos() {
		return this.draw?.centerPos ?? new float3(this.pos.x, this.pos.y, 0);
	}

	regen(game: GameState) {
		if (!this.shouldRegen) return;
		this.shouldRegen = false;

		// console.log("regen", this.pos.name())

		if (!this.draw || !this.type.animCreate)
			return;

		this.type.animCreate(game, this);
	}
}

export class TileDraw {
	public centerPos: float3;
	public baseColor: color3;

	public rng: RandomSlice;
	public models: BatchedInstance[] = [];
	public visualIndex: number = -1;

	public drawCache = {};

	constructor(x: number, y: number, gridIndex: number, rng: RandomSlice) {
		this.rng = rng;
		this.centerPos = new float3(x + 1, y + 1, 0);
		this.baseColor = this.getBaseColor();
		this.visualIndex = gridIndex;
	}

	getBaseColor(): color3 {
		const isDark = (this.centerPos.x + (this.centerPos.y % 2)) % 2 == 0;
		return new color3(isDark ? Colors.tileDark : Colors.tileLight);
	}

	getCenterPos(offset: number): float3 {
		const centerX = this.centerPos.x + this.rng.nextF(-offset, offset);
		const centerY = this.centerPos.y + this.rng.nextF(-offset, offset);
		return new float3(centerX, centerY, 0);
	}

	firstTimeBuild() {
		if (this.drawCache["isBuilt"])
			return false;

		this.drawCache["isBuilt"] = true;
		return true;
	}

	animDestroyAllModels(game: GameState, delay: number) {
		if (this.models.length < 1)
			return;

		game.startCombinedAnim();

		for (const model of this.models)
			game.addAnim(Anims.destroyModel(model, 0.01));
		this.clearDraw();

		game.addAnim(
			game.endCombinedAnim()?.delayed(delay)
		);
	}

	destroyAllModels(duration: number) {
		let anims: GameAnim[] = [];
		for (const model of this.models)
			anims.push(Anims.destroyModel(model, duration));

		this.clearDraw();
		return Anims.combined(anims);
	}

	mergeModelsInto(targetPos: float3, duration: number): GameAnim | undefined {
		if (this.models.length < 1)
			return;

		let anims: GameAnim[] = [];
		for (const model of this.models)
			anims.push(Anims.mergeModel(model, targetPos, duration));
		this.clearDraw();

		return Anims.combined(anims);
	}

	private clearDraw() {
		// Reset draw state
		this.models.length = 0;
		this.drawCache = {};
	}
}


export type TileType = {
	name: string,

	// Placement
	canPlace?: (game: GameState, tile: Tile) => boolean;
	place?: (game: GameState, tile: Tile) => void;

	// Visuals
	color?: number;
	centerOffset?: number;
	animCreate?: (game: GameState, tile: Tile) => void;
};
export const Tiles = {
	Any: { name: "any" },
	Empty: {
		name: "empty",
		animCreate(game, tile) {
			if (!tile.draw) return;
			game.addAnim(tile.draw.destroyAllModels(Anims.BaseDur));
		}
	},

	House1: {
		name: "house1",
		color: Colors.tileHouse1,
		centerOffset: 0.025,
		place(game, tile) {
			game.addScore(tile, 1);
			game.replaceTile(tile, this);
		},
		animCreate(game, tile) {
			if (!tile.draw) return;
			game.startCombinedAnim();

			const rng = tile.draw.rng;
			rng.reset();
			const offset = this.centerOffset ?? 0;
			tile.draw.centerPos.set(
				tile.pos.x + rng.nextF(-offset, offset),
				tile.pos.y + rng.nextF(-offset, offset),
				0
			);
			const centerPos = tile.draw.centerPos;

			// Calculate house model vars
			const houseSize = rng.nextF(0.9, 1);
			const houseZRad = rng.nextRadians();

			// Connect to adjacent path
			connectPathToAdj(game, tile);

			if (tile.draw.firstTimeBuild()) {
				// Add model
				game.renderer.growMeshOnTile(
					game.assets.model_House1,
					tile,
					new color3(this.color),
					Anims.BaseDur,
					centerPos,
					new float3(houseSize, houseSize, houseSize),
					Utils3.rotZRad(houseZRad)
				);
			}

			game.endAndAddCombinedAnim();
		},
	},
	House2: {
		name: "house2",
		color: Colors.tileHouse2,
		centerOffset: 0.005,
		animCreate(game, tile) {
			if (!tile.draw) return;
			game.startCombinedAnim();

			const rng = tile.draw.rng;
			rng.reset();
			const offset = this.centerOffset ?? 0;
			tile.draw.centerPos.set(
				tile.pos.x + rng.nextF(-offset, offset),
				tile.pos.y + rng.nextF(-offset, offset),
				0
			);
			const centerPos = tile.draw.centerPos;

			// Calculate house model vars
			const houseSize = rng.nextF(0.9, 1);

			// Connect to adjacent path
			connectPathToAdj(game, tile);

			if (tile.draw.firstTimeBuild()) {
				// Add model
				game.renderer.growMeshOnTile(
					game.assets.model_House2,
					tile,
					new color3(this.color),
					Anims.BaseDur,
					centerPos,
					new float3(houseSize, houseSize, houseSize),
					Utils3.rotZRad(0)
				);
			}

			game.endAndAddCombinedAnim();
		}
	},
	House3: {
		name: "house3",
		color: Colors.tileHouse3,
		animCreate(game, tile) {
			if (!tile.draw) return;
			game.startCombinedAnim();

			const rng = tile.draw.rng;
			rng.reset();
			const offset = this.centerOffset ?? 0;
			tile.draw.centerPos.set(
				tile.pos.x + rng.nextF(-offset, offset),
				tile.pos.y + rng.nextF(-offset, offset),
				0
			);
			const centerPos = tile.draw.centerPos;

			// Calculate house model vars
			const houseSize = rng.nextF(0.9, 1);

			// Connect to adjacent path
			connectPathToAdj(game, tile);

			if (tile.draw.firstTimeBuild()) {
				// Add model
				game.renderer.growMeshOnTile(
					game.assets.model_House3,
					tile,
					new color3(this.color),
					Anims.BaseDur,
					centerPos,
					new float3(houseSize, houseSize, houseSize),
					Utils3.rotZRad(0)
				);
			}

			game.endAndAddCombinedAnim();
		}
	},

	Path: {
		name: "path",
		color: Colors.tileRoad1,
		centerOffset: 0.1,
		place(game, tile) {
			game.addScore(tile, 1);
			game.replaceTile(tile, this);
		},
		animCreate(game, tile) {
			if (!tile.draw) return;

			const rng = tile.draw.rng;
			rng.reset();

			// Update center position
			const centerPos = tile.draw.centerPos;
			const offset = this.centerOffset!;
			centerPos.set(
				tile.pos.x + rng.nextF(-offset, offset),
				tile.pos.y + rng.nextF(-offset, offset),
				0
			);

			// Check connected tiles
			const tileU = game.grid.getTileOffset(tile.pos, +0, +1);
			const tileR = game.grid.getTileOffset(tile.pos, +1, +0);
			const connectU = isPath(tileU.type);
			const connectR = isPath(tileR.type);
			const connectionHash =
				(connectU ? 0x1 : 0) +
				(connectR ? 0x2 : 0);

			if (tile.draw.drawCache["connectionHash"] == connectionHash)
				return; // Already connected as desired
			tile.draw.drawCache["connectionHash"] = connectionHash;

			// Destroy all the old models (delayed till after creating the new models)
			tile.draw.animDestroyAllModels(game, Anims.BaseDur * 0.5);

			// Add center stone
			const size = rng.nextF(0.8, 1);
			const model = game.renderer.growMeshOnTile(
				game.assets.model_RoadJoin,
				tile,
				new color3(this.color),
				Anims.BaseDur,
				centerPos,
				size
			);
			model.setName(`${tile.pos.name()}_${tile.type.name}`);

			// Connect to other tiles
			if (connectU) connectTo(tileU);
			if (connectR) connectTo(tileR);

			return;

			function connectTo(this, otherTile: Tile) {
				const targetTile = otherTile;
				const targetPos = targetTile.getCenterPos();

				buildPath(game, tile, centerPos, targetPos);
			}
		}
	},
	PathJoin: {
		name: "path_join",
		color: Colors.tileRoad2,
		centerOffset: 0.1,
		animCreate(game, tile) {
			if (!tile.draw) return;

			const rng = tile.draw.rng;
			rng.reset();

			// Update center position
			const centerPos = tile.draw.centerPos;
			const offset = this.centerOffset!;
			centerPos.set(
				tile.pos.x + rng.nextF(-offset, offset),
				tile.pos.y + rng.nextF(-offset, offset),
				0
			);

			// Check connected tiles
			const tileU = game.grid.getTileOffset(tile.pos, +0, +1);
			const tileR = game.grid.getTileOffset(tile.pos, +1, +0);
			const connectU = isPath(tileU.type);
			const connectR = isPath(tileR.type);
			const connectionHash =
				(connectU ? 0x1 : 0) +
				(connectR ? 0x2 : 0);

			if (tile.draw.drawCache["connectionHash"] == connectionHash)
				return; // Already connected as desired
			tile.draw.drawCache["connectionHash"] = connectionHash;

			// Destroy all the old models (delayed till after creating the new models)
			if (tile.draw.models.length > 0) {
				game.addAnim(
					tile.draw.destroyAllModels(0.01)
						.delayed(Anims.BaseDur * 0.5)
				);
			}

			// Add center stone
			const size = rng.nextF(0.8, 1);

			const model = game.renderer.growMeshOnTile(
				game.assets.model_RoadJoin,
				tile,
				new color3(this.color),
				Anims.BaseDur,
				centerPos,
				size
			);
			model.setName(`${tile.pos.name()}_${tile.type.name}`);

			// Connect to other tiles
			if (connectU) connectTo(tileU);
			if (connectR) connectTo(tileR);

			return;

			function connectTo(this, otherTile: Tile) {
				const targetTile = otherTile;
				const targetPos = targetTile.getCenterPos();

				buildPath(game, tile, centerPos, targetPos);
			}
		}
	},
	Bridge: { name: "bridge", color: Colors.tileBridge },

	Grass: { name: "grass", color: Colors.tileGrass },
	Tree: { name: "tree", color: Colors.tileTree1 },
	Water: { name: "water", color: Colors.tileWater },
} as const satisfies Record<string, TileType>;

function connectPathToAdj(game: GameState, tile: Tile) {
	if (!tile.draw)
		return;

	const previousConnection = tile.draw.drawCache["connectTarget"];
	if (previousConnection) {
		const tilePrev = game.grid.getTile(previousConnection);
		if (tilePrev && isPath(tilePrev.type))
			return; // already connected
	}

	// Find new best connection
	const tileU = game.grid.getTileOffset(tile.pos, +0, +1);
	const tileR = game.grid.getTileOffset(tile.pos, +1, +0);
	const tileD = game.grid.getTileOffset(tile.pos, +0, -1);
	const tileL = game.grid.getTileOffset(tile.pos, -1, +0);

	let connectTile: Tile | null = null;
	if (isPath(tileD.type)) connectTile = tileD;
	else if (isPath(tileL.type)) connectTile = tileL;
	else if (isPath(tileR.type)) connectTile = tileR;
	else if (isPath(tileU.type)) connectTile = tileU;

	if (connectTile == null)
		return;

	tile.draw.drawCache["connectTarget"] = connectTile.pos;

	const centerPos = tile.getCenterPos();
	const targetPos = connectTile.getCenterPos();

	// Destroy all the old models (delayed till after creating the new models)
	const oldModels = tile.draw.drawCache["pathModels"];
	if (oldModels) {
		const removeSet = new Set(oldModels);
		tile.draw.models = tile.draw.models.filter(item => !removeSet.has(item));
		game.addAnim(Anims.destroyModels(oldModels, 0).delayed(Anims.BaseDur));
	}

	// Build a new path
	tile.draw.drawCache["pathModels"] = buildPath(game, tile, centerPos, targetPos);
}

export function makeRules(): Rule[] {
	let rules: Rule[] = [];

	rules.push(new Rule("Make Building",
		{
			cc: Tiles.House2,
			uc: Tiles.House1,
			dc: Tiles.House1,
			cl: Tiles.House1,
			cr: Tiles.House1,
		},
		(game, area) => {
			game.mergeTilesInto(area.cc,
				[area.uc, area.dc, area.cl, area.cr],
				Tiles.House3);
			game.addScore(area.cc, 4);
			game.addPop(area.cc, 4);
		},
		MatchFlags.None));
	rules.push(new Rule("Make Cull-de-sac",
		{
			cc: Tiles.Path,
			uc: Tiles.House1,
			cl: Tiles.House1,
			dc: Tiles.House1,
		},
		(game, area) => {
			game.mergeTilesInto(area.cc,
				[area.uc, area.dc, area.cl],
				Tiles.House2);
			game.addScore(area.cc, 3);
		},
		MatchFlags.Rotate4));

	rules.push(new Rule("Add Road between Houses",
		{
			cc: Tiles.Empty,
			uc: Tiles.House1,
			dc: Tiles.House1,
		},
		(game, area) => {
			game.replaceTile(area.cc, Tiles.Path);
			game.addScore(area.cc, 1);
		},
		MatchFlags.Rotate1));

	rules.push(new Rule("Make Intersection",
		{
			cc: Tiles.Empty,
			uc: Tiles.Path,
			dc: Tiles.Path,
			cl: Tiles.Path,
		},
		(game, area) => {
			game.replaceTile(area.cc, Tiles.PathJoin);
			game.addScore(area.cc, 4);
		},
		MatchFlags.Rotate4));
	rules.push(new Rule("Upgrade Intersection",
		{
			cc: Tiles.Path,
			uc: Tiles.Path,
			dc: Tiles.Path,
			cl: Tiles.Path,
		},
		(game, area) => {
			game.replaceTile(area.cc, Tiles.PathJoin);
			game.addScore(area.cc, 4);
		},
		MatchFlags.Rotate4));

	rules.push(new Rule("Make Tree",
		{
			cc: Tiles.Grass,
			uc: Tiles.Grass,
			ul: Tiles.Grass,
			cl: Tiles.Grass,
		},
		(game, area) => {
			game.replaceTile(area.cc, Tiles.Tree);
			game.replaceTile(area.uc, Tiles.Empty);
			game.replaceTile(area.ul, Tiles.Empty);
			game.replaceTile(area.cl, Tiles.Empty);
			game.addScore(area.cc, 4);
			game.addNat(area.cc, 2);
		},
		MatchFlags.None));

	rules.push(new Rule("Make Pond",
		{
			cc: Tiles.Empty,
			uc: Tiles.Grass,
			ul: Tiles.Grass,
			cl: Tiles.Grass,
			cr: Tiles.Grass,
		},
		(game, area) => {
			game.replaceTile(area.cc, Tiles.Water);
			game.replaceTile(area.uc, Tiles.Empty);
			game.replaceTile(area.ul, Tiles.Empty);
			game.replaceTile(area.cl, Tiles.Empty);
			game.replaceTile(area.cr, Tiles.Empty);
			game.addScore(area.cc, 2);
		},
		MatchFlags.None));

	return rules;
}

export function isPath(type: TileType) {
	return type == Tiles.Path
		|| type == Tiles.PathJoin;
}

export function buildPath(
	game: GameState,
	tile: Tile,
	start: float3,
	end: float3) {
	const dir = new float3().subVectors(end, start);
	const len = dir.length();
	const para = dir.clone().divideScalar(len);

	const rng = tile.draw!.rng;
	const perp = new float3(-para.y, para.x);

	const animDur = Anims.BaseDur * 0.25;
	game.startCombinedAnim();

	let pathModels: BatchedInstance[] = [];
	if (len < 0.1) {
		// Segment of path is relatively short
		const size = rng.nextF(0.7, 0.9);
		pathModels.push(
			game.renderer.growMeshOnTile(
				game.assets.model_PathStone,
				tile,
				Colors3.tileRoad1,
				animDur,
				new float3()
					.addScaledVector(para, 0.5 * len)
					.add(start),
				new float3(size, size, size),
				Utils3.rotZDeg(rng.nextF(-180, 180))
			));
	}
	else {
		// Segment of path is longer
		const count = Math.ceil(len / 0.3);
		const spacing = len / count;
		for (let i = 1; i < count; ++i) {
			const pos = new float3()
				.addScaledVector(para, i * spacing)
				.addScaledVector(perp, (i % 2 ? -1 : +1) * 0.025)
				.add(start);
			const size = rng.nextF(0.6, 0.75);

			pathModels.push(
				game.renderer.growMeshOnTile(
					game.assets.model_PathStone,
					tile,
					Colors3.tileRoad1,
					animDur,
					pos,
					new float3(size, size, size),
					Utils3.rotZDeg(rng.nextF(-180, 180))
				));
		}
	}

	game.endAndAddCombinedAnim();

	return pathModels;
}