import { P2 } from "./P2";
import { Anims, GameAnim } from "./GameAnims";
import { makeRules, Tiles, TileType, Tile } from "./Tile";
import { GameRenderer } from "./GameRenderer";
import { RandomSlice } from "./SeededRandom";
import { Area3x3, isTile, MatchFlags, Rule } from "./Rule";

export class GameState {
	public score: number = 0;
	public population: number = 0;
	public nature: number = 0;

	public grid: Grid = new Grid();
	public rules: Rule[] = makeRules();
	public items: Item[] = [];
	public anims: GameAnim[] = [];
	public rng = new RandomSlice(Math.random(), 1024);
	public isCreative = true;

	public renderer: GameRenderer = new GameRenderer();
	public get assets() { return this.renderer.assets; }

	//#region Visuals

	private _combinedAnimStack: GameAnim[][] = [];
	private _currAnimList: GameAnim[] = this.anims;

	public addAnim(anim: GameAnim | undefined) {
		if (!anim) return;
		this._currAnimList.push(anim);
		return anim;
	}

	public startCombinedAnim() {
		this._combinedAnimStack.push(this._currAnimList);
		this._currAnimList = [];
	}

	public endCombinedAnim() {
		if (this._combinedAnimStack.length < 1)
			throw "Unexpected end of combined animation";

		let anim: GameAnim | undefined;
		const prevList = this._combinedAnimStack.pop()!;
		if (this._currAnimList.length == 1 && this._currAnimList[0])
			anim = this._currAnimList[0];
		else if (this._currAnimList.length > 1)
			anim = Anims.combined(this._currAnimList);
		else
			anim = undefined;

		this._currAnimList = prevList;
		return anim;
	}
	public endAndAddCombinedAnim() {
		const anim = this.endCombinedAnim();
		this.addAnim(anim);
	}

	public regenVisuals() {
		this.startCombinedAnim();
		for (const tile of this.grid.tiles) {
			if (!tile.shouldRegen) continue;
			tile.regen(this);
		}
		this.endAndAddCombinedAnim();
	}

	//#endregion Visuals

	//#region State Modification

	public onScoreUpdate: undefined | (() => void);

	public addScore(tile: Tile, s: number) {
		this.score += s;
		this.onScoreUpdate?.();
		return Anims.addCount(this, tile.pos, s);
	}

	public addPop(tile: Tile, p: number) {
		this.population += p;
		return Anims.addCount(this, tile.pos, p);
	}

	public addNat(tile: Tile, n: number) {
		this.nature += n;
		return Anims.addCount(this, tile.pos, n);
	}

	private setTileType(tile: Tile, type: TileType) {
		if (tile.type === type)
			return;

		console.log(`Setting ${tile.pos.name()} to '${type.name}'`);
		tile.type = type;
		tile.shouldRegen = true;

		this.markForCheck(tile.pos.x, tile.pos.y);
		this.markAdjForCheck(tile.pos);

		if (tile.draw)
			tile.draw.drawCache = {};
	}

	public replaceTile(tile: Tile, type: TileType) {
		if (type == Tiles.Empty || tile.type == Tiles.Empty) {
			// Tile is already empty or becoming empty,
			//   so just use a single animation
			this.setTileType(tile, type);

			tile.regen(this);
			return;
		}

		// Update Data
		this.setTileType(tile, type);

		// Animate the replacement of tile models
		if (tile.type.animCreate) {
			Tiles.Empty.animCreate(this, tile);
			tile.regen(this);
		}
	}

	public mergeTilesInto(
		targetTile: Tile,
		tiles: Tile[],
		type: TileType) {
		// Update Data
		for (const tile of tiles)
			this.setTileType(tile, Tiles.Empty);
		this.setTileType(targetTile, type);

		// Update Visuals
		if (!targetTile.draw) return;

		console.log("Start merge to " + targetTile.pos.name())
		this.startCombinedAnim();

		// Merge adjacent tiles
		const targetPos = targetTile.draw.centerPos;
		for (const tile of tiles) {
			if (!tile.draw) continue;
			this.addAnim(tile.draw
				.mergeModelsInto(targetPos, Anims.BaseDur));
		}

		// Destroy center tile
		targetTile.draw.animDestroyAllModels(this, Anims.BaseDur);

		// Create center tile
		const delay = 0.25 * Anims.BaseDur;
		this.startCombinedAnim();
		targetTile.regen(this);
		let combAnim = this.endCombinedAnim();
		this.addAnim(
			combAnim?.delayed(delay)
		);

		this.endAndAddCombinedAnim();
	}

	//#endregion State Modification

	//#region Items

	public addItem(type: TileType, count?: number) {
		count ??= 1;
		for (const item of this.items) {
			if (item.type === type) {
				item.count += count;
				return;
			}
		}

		this.items.push(new Item(type, count));
	}

	private hasItem(type: TileType) {
		for (const item of this.items) {
			if (item.type === type
				&& item.count > 0)
				return true;
		}

		return false;
	}

	private consumeItem(type: TileType) {
		if (this.isCreative)
			return;

		for (const [index, item] of this.items.entries()) {
			if (item.type !== type)
				continue;

			item.count--;
			if (item.count < 1)
				this.items.splice(index, 1);

			return;
		}
	}

	//#endregion Items

	//#region Rule Application

	public canPlaceTile(tile: Tile, type: TileType) {
		// Ensure the tile is available
		if (!this.isCreative && !this.hasItem(type))
			return false; // no item

		// Check if the tile type has a custom placement function
		if (type.canPlace)
			return type.canPlace(this, tile);

		if (tile.type !== Tiles.Empty)
			return false; // not empty

		return true;
	}

	public placeTile(tile: Tile, type: TileType) {
		if (!this.canPlaceTile(tile, type))
			return; // Cannot place

		this.consumeItem(type);
		if (type.place)
			type.place(this, tile);
		else
			this.replaceTile(tile, type);

		// Update game state
		this.applyRules();
		this.regenVisuals();
	}

	private tilesToCheck: number = 0;

	public markForCheck(x: number, y: number) {
		if (x <= 0 || x >= this.grid.size - 1
			|| y <= 0 || y >= this.grid.size - 1)
			return; // Out of bounds or on edge

		const tile = this.grid.getTile(x, y);
		if (!tile.shouldCheck) {
			// console.log(`To Check ${tile.pos.name()}`);

			tile.shouldCheck = true;
			tile.shouldRegen = true;
			this.tilesToCheck++;
		}
	}
	public markAdjForCheck(pos: P2) {
		this.markForCheck(pos.x - 1, pos.y - 1);
		this.markForCheck(pos.x + 0, pos.y - 1);
		this.markForCheck(pos.x + 1, pos.y - 1);
		this.markForCheck(pos.x - 1, pos.y + 0);
		// this.markForCheck(pos.x + 0, pos.y + 0);
		this.markForCheck(pos.x + 1, pos.y + 0);
		this.markForCheck(pos.x - 1, pos.y + 1);
		this.markForCheck(pos.x + 0, pos.y + 1);
		this.markForCheck(pos.x + 1, pos.y + 1);
	}
	private markTileChecked(tile: Tile) {
		if (!tile.shouldCheck) return;

		// console.log(`Checked ${tile.pos.name()}`);

		tile.shouldCheck = false;
		this.tilesToCheck--;
	}

	public get hasUnappliedRules() { return this.tilesToCheck > 0; }

	public applyRules() {
		while (this.hasUnappliedRules)
			this.applyRulesOnce();
	}

	public applyRulesOnce() {
		if (!this.hasUnappliedRules)
			return;

		let ruleIndex = Number.MAX_SAFE_INTEGER;
		let ruleToApply: Rule | null = null;
		let areaToApply: Area3x3 | null = null;

		// Check all tiles that require checking
		for (const cc of this.grid.tiles) {
			if (!cc.shouldCheck) continue;

			let examinedAllRules = true;

			const pos = cc.pos;
			const tl = this.grid.getTile(pos.x - 1, pos.y + 1);
			const tc = this.grid.getTile(pos.x + 0, pos.y + 1);
			const tr = this.grid.getTile(pos.x + 1, pos.y + 1);
			const cl = this.grid.getTile(pos.x - 1, pos.y + 0);
			const cr = this.grid.getTile(pos.x + 1, pos.y + 0);
			const bl = this.grid.getTile(pos.x - 1, pos.y - 1);
			const bc = this.grid.getTile(pos.x + 0, pos.y - 1);
			const br = this.grid.getTile(pos.x + 1, pos.y - 1);

			let rot000 = new Area3x3(tl, tc, tr, cl, cc, cr, bl, bc, br);
			let rot090 = new Area3x3(tr, cr, br, tc, cc, bc, tl, cl, bl);
			let rot180 = new Area3x3(br, bc, bl, cr, cc, cl, tr, tc, tl);
			let rot270 = new Area3x3(bl, cl, tl, bc, cc, tc, br, cr, tr);

			// Search through rules
			for (const [index, rule] of this.rules.entries()) {
				if (index >= ruleIndex) {
					examinedAllRules = false;
					break; // A matched rule is better
				}

				if (!isTile(rule.match.cc, cc.type))
					continue; // Center does not match

				// Try matching the rule
				if (rule.match.isMatch(rot000)) {
					examinedAllRules = false;
					ruleToApply = rule;
					areaToApply = rot000;
					ruleIndex = index;
					break;
				}

				// Try matching rotations of the rule
				if (rule.matchFlags & MatchFlags.Rotate1) {
					if (rule.match.isMatch(rot090)) {
						examinedAllRules = false;
						ruleToApply = rule;
						areaToApply = rot090;
						ruleIndex = index;
						break;
					}
				}

				if (rule.matchFlags & MatchFlags.Rotate4) {
					if (rule.match.isMatch(rot180)) {
						examinedAllRules = false;
						ruleToApply = rule;
						areaToApply = rot180;
						ruleIndex = index;
						break;
					}

					if (rule.match.isMatch(rot270)) {
						examinedAllRules = false;
						ruleToApply = rule;
						areaToApply = rot270;
						ruleIndex = index;
						break;
					}
				}
			}

			// Only mark the tile checked if every rule was examined
			if (examinedAllRules)
				this.markTileChecked(cc);
		}

		// If we found a rule, apply it
		if (ruleToApply !== null) {
			console.log(`Applying rule '${ruleToApply.name}' at ${areaToApply!.cc.pos.name()}`);
			ruleToApply.apply(this, areaToApply!);
		}
		// else console.log(`No rule to apply`);
	}

	//#endregion Rule Application
}

export class Item {
	constructor(public type: TileType, public count: number) { }
}

class Grid {
	public size: number = 10;
	public tiles: Tile[];

	private _emptyTile: Tile = new Tile(new P2(-1, -1), Tiles.Empty);

	constructor() {
		this.tiles = Array(this.size * this.size);
		for (let y = 0; y < this.size; ++y) {
			for (let x = 0; x < this.size; ++x) {
				this.tiles[y * this.size + x] = new Tile(
					new P2(x, y), Tiles.Empty);
			}
		}
	}

	public getTileOffset(pos: P2, x: number, y: number): Tile {
		return this.getTile(pos.x + x, pos.y + y);
	}

	public getTile(pos: P2): Tile;
	public getTile(x: number, y: number): Tile;
	public getTile(xOrPos: number | P2, y?: number): Tile {
		if (typeof xOrPos === 'object')
			return this.getTileInternal(xOrPos.x, xOrPos.y);
		return this.getTileInternal(xOrPos, y!);
	}
	private getTileInternal(x: number, y: number): Tile {
		if (x < 0 || x >= this.size || y < 0 || y >= this.size)
			return this._emptyTile;
		return this.tiles[y * this.size + x]!;
	}

	public getTileType(pos: P2): TileType;
	public getTileType(x: number, y: number): TileType;
	public getTileType(xOrPos: number | P2, y?: number): TileType {
		if (typeof xOrPos === 'object')
			return this.getTileInternal(xOrPos.x, xOrPos.y).type;
		return this.getTileInternal(xOrPos, y!).type;
	}

	public isTileEmpty(pos: P2) {
		return this.getTileType(pos) === Tiles.Empty;
	}
}

