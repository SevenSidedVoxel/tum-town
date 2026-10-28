import { P2 } from "./P2";
import { Colors, Colors3 } from '../styles/colors';
import { Anims, GameAnim } from './GameAnims';
import { BatchedInstance } from './render/BatchedInstance';
import { float3, color3, quat4, ZAxis, Utils3 } from '../utils/threeUtils';
import { RandomSlice } from "./SeededRandom";
import { GameState, CTX as CTX } from "./GameState";
import { Tiles } from "./_tiles_";
import { ModelCollection } from "./ModelCollection";
import { Pathing } from "./PathSystem";

export class Tile {
	// State
	public pos: P2;
	public type: TileType;
	public rot: number | null = null;
	public actIndex: number = 0;

	// Temp State
	public shouldCheck: boolean = false;

	// Drawing
	public shouldDraw: boolean = false;
	public shouldRegen: boolean = false;
	public tileBGInst: BatchedInstance | null = null;
	public models: ModelCollection = new ModelCollection();
	private rngSeed: number;
	private drawCache: TileDrawCache = new TileDrawCache();

	public get name() { return this.pos.name(); }

	constructor(pos: P2, type: TileType) {
		this.pos = pos;
		this.type = type;
		this.rngSeed = pos.y * 130 + pos.x * 7;
	}

	public reset() {
		this.rot = null;
		this.type = Tiles.Empty;
		this.shouldCheck = false;
		this.shouldRegen = true;
		this.actIndex = 0;
	}

	public rng(ctx: CTX) { return ctx.game.rng.slice(this.rngSeed); }

	public regenTile(ctx: CTX) { ctx.addAnim(this.regenTile_anim(ctx)); }
	public regenTile_anim(ctx: CTX) {
		if (!this.shouldRegen) return;
		this.shouldRegen = false;

		// console.log("regen", this.pos.name())

		if (!this.shouldDraw || !this.type.regen)
			return;

		ctx.startCombinedAnim();
		this.type.regen(ctx, this);
		ctx.paths.updatePaths(ctx, this);
		return ctx.endCombinedAnim();
	}

	public resetDrawCache() {
		this.drawCache = new TileDrawCache();
	}

	public firstTimeBuild() {
		if (this.drawCache.isBuilt)
			return false;

		this.drawCache.isBuilt = true;
		return true;
	}

	//#region Visuals

	public static calcVisualCenterPos(pos: P2, rng?: RandomSlice, variance?: number | undefined) {
		if (rng && variance) {
			const offset = variance ?? 0;
			return new float3(
				pos.x + rng.nextF(-offset, offset),
				pos.y + rng.nextF(-offset, offset),
				0
			);
		}

		return new float3(pos.x, pos.y, 0);
	}

	public static getTileBaseColor(pos: P2): color3 {
		const isDark = (pos.x + (pos.y % 2)) % 2 == 0;
		return new color3(isDark ? Colors.tileDark : Colors.tileLight);
	}

	//#endregion Visuals

	//#region Animations

	public destroyModels_anim(ctx: CTX, duration: number = Anims.BaseDur): GameAnim | undefined {
		ctx.startCombinedAnim();

		// Destroy Models
		ctx.addAnim(this.models.destroyAll_anim(duration));

		// Destroy Paths
		ctx.addAnim(ctx.paths.disconnectFromAll_anim(this.pos, duration));

		// Reset cache
		this.resetDrawCache();

		return ctx.endCombinedAnim();
	}

	public mergeModels_anim(ctx: CTX, targetPos: float3, duration: number = Anims.BaseDur): GameAnim | undefined {
		ctx.startCombinedAnim();

		// Merge Models
		for (const model of this.models)
			ctx.addAnim(Anims.mergeModel(model, targetPos, duration));
		this.models.reset();

		// Destroy Paths
		ctx.addAnim(ctx.paths.disconnectFromAll_anim(this.pos, duration));

		// Reset cache
		this.resetDrawCache();

		return ctx.endCombinedAnim();
	}

	//#endregion Animations
}

class TileDrawCache {
	public isBuilt: boolean | undefined;
}

export type TileIcon = {
	baseSize?: number;
	baseDegZ?: number;
};

export type TileType = {
	name: string,
	icon?: TileIcon;

	// Placement
	canPlace?: (game: GameState, tile: Tile) => boolean;
	place?: (ctx: CTX, tile: Tile) => void;

	// Interact
	interact?: (ctx: CTX, tile: Tile) => void;

	// Pathing
	pathing?: Pathing;

	// Visuals
	color?: color3;
	model?: string;
	centerVariance?: number;
	regen?: (ctx: CTX, tile: Tile) => void;
};

export function pickLastActIndex(tiles: Tile[]) {
	let last = tiles[0]!;
	for (const tile of tiles) {
		if (tile.actIndex > last.actIndex)
			last = tile;
	}
	return last;
}
