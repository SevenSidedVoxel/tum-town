import { P2 } from "./P2";
import { Colors, Colors3 } from '../styles/colors';
import { Anims, GameAnim } from './GameAnims';
import { BatchedInstance } from './GameRenderer';
import { float3, color3, quat4, ZAxis, Utils3 } from '../utils/threeUtils';
import { RandomSlice } from "./SeededRandom";
import { GameState } from "./GameState";
import { Tiles } from "./_tiles_";
import { getLineTransform } from "../utils/renderUtils";

export class Tile {
	public pos: P2;

	public type: TileType;
	public rot: number | null = null;

	public draw: TileDraw | null = null;
	public shouldRegen: boolean = false;
	public shouldCheck: boolean = false;
	public actIndex: number = 0;

	constructor(pos: P2, type: TileType) {
		this.pos = pos;
		this.type = type;
	}

	public reset() {
		this.rot = null;
		this.type = Tiles.Empty;
		this.shouldCheck = false;
		this.shouldRegen = true;
		this.actIndex = 0;
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

	// Interact
	interact?: (game: GameState, tile: Tile) => void;

	// Visuals
	color?: number;
	model?: string;
	centerOffset?: number;
	animCreate?: (game: GameState, tile: Tile) => void;
};
export function connectPathToAdj(game: GameState, tile: Tile) {
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

	if (connectTile != null)
		connectToTile(game, tile, connectTile);
}

export function rotatePathConnection(game: GameState, tile: Tile) {
	if (!tile.draw)
		return;

	const connDir = tile.draw.drawCache["connectTarget"] as P2;
	if (!connDir) return;

	let connectTile: Tile | null = null;
	const testDir = connDir.clone().subV(tile.pos);
	for (let i = 0; i < 3; ++i) {
		// Rotate the direction
		const { x, y } = testDir;
		testDir.x = y;
		testDir.y = -x;

		// Check if can connect
		const testTile = game.grid.getTileOffset(tile.pos, testDir.x, testDir.y);
		if (isPath(testTile.type)) {
			connectTile = testTile;
			break;
		}
	}

	if (connectTile != null)
		connectToTile(game, tile, connectTile);
}

export function connectToTile(game: GameState, fromTile: Tile, toTile: Tile) {
	if (!fromTile.draw) return;

	fromTile.draw.drawCache["connectTarget"] = toTile.pos;

	const centerPos = fromTile.getCenterPos();
	const targetPos = toTile.getCenterPos();

	// Destroy all the old models (delayed till after creating the new models)
	const oldModels = fromTile.draw.drawCache["pathModels"];
	if (oldModels) {
		const removeSet = new Set(oldModels);
		fromTile.draw.models = fromTile.draw.models.filter(item => !removeSet.has(item));
		game.addAnim(Anims.destroyModels(oldModels, 0).delayed(Anims.BaseDur));
	}

	// Build a new path
	fromTile.draw.drawCache["pathModels"] = buildPath_Lines(game, fromTile, centerPos, targetPos);
}

export function isPath(type: TileType) {
	return type == Tiles.Path || type == Tiles.Fountain;
}

export function buildPath_Lines(
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

	// Calculate path positions
	let pathPositions: [float3, number][] = [];
	pathPositions.push([start, 0.5]);
	if (len < 0.1) {
		// Segment of path is relatively short
		const size = rng.nextF(0.4, 0.5);
		pathPositions.push([new float3()
			.addScaledVector(para, 0.5 * len)
			.add(start),
			size]);
	}
	else {
		// Segment of path is longer
		const count = Math.ceil(len / 0.5);
		const spacing = len / count;
		for (let i = 1; i < count; ++i) {
			const pos = new float3()
				.addScaledVector(para, i * spacing)
				.addScaledVector(perp, (i % 2 ? -1 : +1) * 0.025)
				.add(start);
			const size = rng.nextF(0.4, 0.5);
			pathPositions.push([new float3()
				.addScaledVector(para, i * spacing)
				.addScaledVector(perp, (i % 2 ? -1 : +1) * 0.025)
				.add(start),
				size
			]);
		}
	}
	pathPositions.push([end, 0.5]);

	// Create path lines
	let pathModels: BatchedInstance[] = [];
	let [prevPos, prevSize] = pathPositions[0]!;
	for (let i = 1; i < pathPositions.length; ++i) {
		const [currPos, currSize] = pathPositions[i]!;

		if (i != 1) {
			pathModels.push(
				game.renderer.growMeshOnTile(
					game.assets.model_LineCap,
					tile,
					Colors3.tileRoad1,
					animDur,
					prevPos,
					new float3(prevSize, prevSize, prevSize),
					Utils3.rotZDeg(rng.nextF(-180, 180))
				));
		}

		let lineTRS = getLineTransform(prevPos, currPos, currSize);
		pathModels.push(
			game.renderer.growMeshOnTile(
				game.assets.model_LineSeg,
				tile,
				Colors3.tileRoad1,
				animDur,
				lineTRS.pos,
				lineTRS.scale,
				lineTRS.rot)
		);

		prevPos = currPos!;
	}

	game.endAndAddCombinedAnim();

	return pathModels;
}

export function buildPath_Stones(
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
		const size = rng.nextF(0.4, 0.6);
		pathModels.push(
			game.renderer.growMeshOnTile(
				game.assets.model_RoadStone,
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
		const count = Math.ceil(len / 0.2);
		const spacing = len / count;
		for (let i = 1; i < count; ++i) {
			const pos = new float3()
				.addScaledVector(para, i * spacing)
				.addScaledVector(perp, (i % 2 ? -1 : +1) * 0.025)
				.add(start);
			const size = rng.nextF(0.4, 0.5);

			pathModels.push(
				game.renderer.growMeshOnTile(
					game.assets.model_RoadStone,
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

export function pickLastActIndex(tiles: Tile[]) {
	let last = tiles[0]!;
	for (const tile of tiles) {
		if (tile.actIndex > last.actIndex)
			last = tile;
	}
	return last;
}
