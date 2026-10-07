import { P2 } from "./P2";
import { Colors, Colors3 } from '../styles/colors';
import { Anims, GameAnim } from './GameAnims';
import { BatchedInstance } from './GameRenderer';
import { float3, color3, quat4, ZAxis, Utils3 } from '../utils/threeUtils';
import { RandomSlice } from "./SeededRandom";
import { GameState } from "./GameState";
import { Rule, MatchFlags } from "./Rule";

export class Tile {
	public pos: P2;
	public type: TileType;
	public draw: TileDraw | null = null;
	public shouldRegen: boolean = false;
	public shouldCheck: boolean = false;
	public actIndex: number = 0;

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

	recalcCenterPos(pos: P2, centerOffset: number | undefined) {
		const offset = centerOffset ?? 0;
		this.centerPos.set(
			pos.x + this.rng.nextF(-offset, offset),
			pos.y + this.rng.nextF(-offset, offset),
			0
		);
		return this.centerPos;
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
		name: "house",
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
			const houseSize = rng.nextF(0.7, 0.8);
			const zDeg = rng.nextDegSnapped(30);

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
					Utils3.rotZDeg(zDeg)
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
				tile.pos.y - 0.1 + rng.nextF(-offset, offset),
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
			const tileL = game.grid.getTileOffset(tile.pos, -1, +0);
			const tileR = game.grid.getTileOffset(tile.pos, +1, +0);
			const connectU = isPath(tileU.type);
			const connectL = isPath(tileL.type);
			const connectR = isPath(tileR.type);

			let tileUR: Tile | null = null;
			let connectUR = false;
			if (!connectU && !connectR) {
				tileUR = game.grid.getTileOffset(tile.pos, +1, +1);
				connectUR = isPath(tileUR.type);
			}

			let tileUL: Tile | null = null;
			let connectUL = false;
			if (!connectU && !connectL) {
				tileUL = game.grid.getTileOffset(tile.pos, -1, +1);
				connectUL = isPath(tileUL.type);
			}

			const connectionHash =
				(connectU ? 0x1 : 0) +
				(connectR ? 0x2 : 0) +
				(connectUR ? 0x4 : 0) +
				(connectUL ? 0x8 : 0);

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
			if (connectUR) connectTo(tileUR!);
			if (connectUL) connectTo(tileUL!);

			return;

			function connectTo(this, otherTile: Tile) {
				const targetTile = otherTile;
				const targetPos = targetTile.getCenterPos();

				buildPath(game, tile, centerPos, targetPos);
			}
		}
	},
	Bridge: { name: "bridge", color: Colors.tileBridge },

	Tree: {
		name: "tree",
		color: Colors.tileTree1,
		centerOffset: 0.1,
		place(game, tile) {
			game.addScore(tile, 1);
			game.replaceTile(tile, this);
		},
		animCreate(game, tile) {
			if (!tile.draw) return;

			const rng = tile.draw.rng;
			rng.reset();

			// Check for neighbouring trees and adjust the center to be near other trees
			const adj = game.grid.getAdj8(tile.pos);
			const center = new P2(0, 0);
			let count = 0;
			function addTileWeight(tile: Tile, x: number, y: number) {
				let weight = 0;
				if (tile.type == Tiles.Tree)
					weight = 1;
				if (tile.type == Tiles.Forest)
					weight = 1.5;

				weight *= 2 / (1 + x * x + y * y);

				if (weight == 0) return;
				center.addXY(x * weight, y * weight);
				count++;
			}
			addTileWeight(adj.ul, -1, +1);
			addTileWeight(adj.uc, +0, +1);
			addTileWeight(adj.ur, +1, +1);
			addTileWeight(adj.cl, -1, +0);
			addTileWeight(adj.cr, +1, +0);
			addTileWeight(adj.dl, -1, -1);
			addTileWeight(adj.dc, +0, -1);
			addTileWeight(adj.dr, +1, -1);
			if (count != 0) {
				center.mulS(1.0 / count);
				center.clampXY(
					-1, 1,
					-1, 1
				);
				center.mulXY(0.2, 0.2);
			}
			const centerPos = new float3(center.x, center.y - 0.1, 0)
				.add({ x: tile.pos.x, y: tile.pos.y, z: 0 });

			// Add random offset
			const offset = this.centerOffset ?? 0;
			centerPos.x += tile.draw.rng.nextF(-offset, offset);
			centerPos.y += tile.draw.rng.nextF(-offset, offset);

			if (!tile.draw.firstTimeBuild()) {
				if (tile.draw.models.length > 0
					&& !tile.draw.centerPos.equals(centerPos)) {
					tile.draw.centerPos.copy(centerPos);
					// Move the model towards the center pos
					game.addAnim(Anims.moveModel(
						tile.draw.models[0]!,
						tile.draw.centerPos
					));
				}
				return;
			}

			tile.draw.centerPos = centerPos;
			game.startCombinedAnim();
			game.renderer.growMeshOnTile(
				game.assets.model_Tree1,
				tile,
				new color3(this.color),
				Anims.BaseDur,
				centerPos,
				new float3().setScalar(rng.nextF(0.9, 1)),
				Utils3.rotZRad(rng.nextRadians())
			);
			game.endAndAddCombinedAnim();
		},
	},

	Forest: {
		name: "forest",
		color: Colors.tileTree1,
		centerOffset: 0.05,
		place(game, tile) {
			game.addScore(tile, 1);
			game.replaceTile(tile, this);
		},
		animCreate(game, tile) {
			if (!tile.draw) return;

			const rng = tile.draw.rng;
			rng.reset();
			const centerPos = tile.draw.recalcCenterPos(tile.pos, this.centerOffset);

			if (!tile.draw.firstTimeBuild())
				return;

			game.startCombinedAnim();
			game.renderer.growMeshOnTile(
				game.assets.model_Tree2,
				tile,
				new color3(this.color),
				Anims.BaseDur,
				centerPos,
				new float3().setScalar(rng.nextF(0.9, 1)),
				Utils3.rotZRad(rng.nextRadians())
			);
			game.endAndAddCombinedAnim();
		},
	},

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

	// rules.push(new Rule("Add Road between Houses",
	// 	{
	// 		cc: Tiles.Empty,
	// 		uc: Tiles.House1,
	// 		dc: Tiles.House1,
	// 	},
	// 	(game, area) => {
	// 		game.replaceTile(area.cc, Tiles.Path);
	// 		game.addScore(area.cc, 1);
	// 	},
	// 	MatchFlags.Rotate1));

	rules.push(new Rule("Make Forest X",
		{
			cc: Tiles.Tree,
			ul: Tiles.Tree,
			ur: Tiles.Tree,
			dl: Tiles.Tree,
			dr: Tiles.Tree,
		},
		(game, area) => {
			// Choose the newest tile to become the forest
			game.mergeTilesInto(
				area.cc,
				[area.ul, area.ur, area.dl, area.dr],
				Tiles.Forest
			);

			game.addScore(area.cc, 4);
			game.addNat(area.cc, 2);
		},
		MatchFlags.None));
	rules.push(new Rule("Make Forest",
		{
			cc: Tiles.Tree,
			uc: Tiles.Tree,
			ul: Tiles.Tree,
			cl: Tiles.Tree,
		},
		(game, area) => {
			// Choose the newest tile to become the forest
			const tiles = [area.cc, area.uc, area.ul, area.cl];
			const lastTile = pickLastActIndex(tiles);

			game.mergeTilesInto(
				lastTile,
				tiles.filter(t => t !== lastTile),
				Tiles.Forest
			);

			game.addScore(lastTile, 4);
			game.addNat(lastTile, 2);
		},
		MatchFlags.None));

	return rules;
}

export function isPath(type: TileType) {
	return type == Tiles.Path;
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

function pickLastActIndex(tiles: Tile[]) {
	let last = tiles[0]!;
	for (const tile of tiles) {
		if (tile.actIndex > last.actIndex)
			last = tile;
	}
	return last;
}
