import { P2 } from "./P2";
import { Anims, GameAnim } from "./GameAnims";
import { TileType, Tile } from "./Tile";
import { Tiles } from "./_tiles_";
import { makeRules } from "./_rules_";
import { GameRenderer } from "./render/GameRenderer";
import { RandomSlice } from "./SeededRandom";
import { Area3x3, isTile, RuleRotations, Rule } from "./Rule";
import { ProgressionMeter } from "./ProgressionMeter";
import { Grid } from "./Grid";
import { Item } from "./Item";
import { PathSystem } from "./PathSystem";
import { ModelCollection } from "./ModelCollection";
import { color3, float3, quat4 } from "../utils/threeUtils";
import { BatchedInstance } from "./render/BatchedInstance";
import { Colors3 } from "../styles/colors";
import { getLineTransform, trs3D } from "../utils/renderUtils";

export const BuildTimestamp = __BUILD_TIMESTAMP__;
export const BuildID = "botanic";

const shouldLogTileDataUpdates = false;

export class CTX {
	public game: GameState;

	public get grid() { return this.game.grid; }
	public get paths() { return this.game.paths; }

	public get renderer() { return this.game.renderer; }
	public get assets() { return this.game.assets; }

	constructor(game: GameState) {
		this.game = game;
	}

	public finalize() {
		// Flush animations
		this.flushAnimations();
	}

	public resetGame() {
		this.game.clearGame();

		this.regenVisuals();
		// this.game.skipAnims();

		this.game.setupGame();
	}

	//#region Visual Regen

	public afterRegenHandlers: (() => void)[] = [];

	public regenVisuals() {
		this.startCombinedAnim();
		for (const tile of this.grid.cells) {
			if (!tile.shouldRegen) continue;
			tile.regenTile(this);
		}

		this.paths.regen(this);

		this.afterRegenHandlers.forEach(afterRegen => afterRegen());
		this.endAndAddCombinedAnim();
	}

	//#endregion Visual Regen

	//#region Animations

	private _prevAnimLists: GameAnim[][] = [];
	private _currAnimList: GameAnim[] = [];

	public addAnim(anim: GameAnim | null | undefined) {
		if (!anim) return;
		this._currAnimList.push(anim);
		// console.log("addAnim", anim.name);
		return anim;
	}

	public startCombinedAnim() {
		this._prevAnimLists.push(this._currAnimList);
		this._currAnimList = [];
	}

	public endCombinedAnim() {
		if (this._prevAnimLists.length < 1)
			throw "Unexpected end of combined animation";

		let anim: GameAnim | undefined;
		if (this._currAnimList.length == 1 && this._currAnimList[0])
			anim = this._currAnimList[0];
		else if (this._currAnimList.length > 1)
			anim = Anims.combined(this._currAnimList);
		else
			anim = undefined;

		const prevList = this._prevAnimLists.pop()!;
		this._currAnimList = prevList;
		return anim;
	}
	public endAndAddCombinedAnim() {
		const anim = this.endCombinedAnim();
		this.addAnim(anim);
	}

	private flushAnimations() {
		if (this._prevAnimLists.length != 0)
			throw "A combined animation was not ended";

		this.game.addAnims(this._currAnimList);
		this._currAnimList.length = 0;
	}

	//#endregion Animations

	//#region Tile Actions

	public updatePlacementPreview(item: TileType | null, tile: P2);
	public updatePlacementPreview(item: TileType | null, tiles: P2[]);
	public updatePlacementPreview(item: TileType | null, tiles: P2 | P2[]) {
		if (tiles instanceof P2) {
			const pos = tiles;
			const tile = this.game.grid.get(pos);
			const canInteract = item != null
				&& this.game.canPlaceTile(tile, item);
			this.hoverTile(tile, canInteract, item);
		}
		else {
			// Multiple positions
			if (this.game.cachedPlacementTiles.length == tiles.length
				&& this.game.cachedPlacementTiles.every((item, i) => item.equals(tiles[i]!))) {
				console.log("cached saved");
				return; // Already equal
			}

			this.game.cachedPlacementTiles = [...tiles];
			this.game.placementModels.destroyAll();

			// Add the first tile
			const zDepth = 0.06;
			let prevPos: float3;
			{
				const pos = tiles[0]!;
				const tile = this.grid.get(pos);
				const canPlace = this.canPlaceItem(tile, item);
				this.renderer.addModel(this.assets.model_LineCap,
					prevPos = new float3(pos.x, pos.y, zDepth),
					1,
					canPlace ? Colors3.placementGood : Colors3.placementBad,
					this.game.placementModels
				);
			}

			// Add subsequent tiles
			for (let i = 1; i < tiles.length; ++i) {
				const pos = tiles[i]!;
				const currPos = new float3(pos.x, pos.y, zDepth);
				const tile = this.grid.get(pos);
				const canPlace = this.canPlaceItem(tile, item);
				this.renderer.addModel(this.assets.model_LineCap,
					currPos,
					0.7,
					canPlace ? Colors3.placementGood : Colors3.placementBad,
					this.game.placementModels
				);

				let lineTRS = getLineTransform(prevPos, currPos, 0.5);
				this.renderer.addModel_TRS(
					this.assets.model_LineSeg,
					lineTRS.pos,
					lineTRS.rot,
					lineTRS.scale,
					canPlace ? Colors3.placementGood : Colors3.placementBad,
					this.game.placementModels
				);

				prevPos = currPos;
			}
		}
	}
	public clearHoverPlacement() {
		this.hoverTile(null, false, null);
	}
	public clearPlacementPreview() {
		this.hoverTile(null, false, null);
		this.game.placementModels.destroyAll();
	}
	public hoverTile(tile: Tile | null,
		canInteract: boolean,
		potentialTile: TileType | null) {
		if (!this.game.hoverSelectorModel)
			return;

		if (!tile || !tile.shouldDraw) {
			this.game.hoverSelectorModel.setVisible(false);
			this.game.hoverPreviewModel.setVisible(false);
			return;
		}

		const pos = tile.pos;
		this.game.hoverSelectorModel.setMesh(canInteract ? this.assets.model_HoverActive : this.assets.model_Hover);
		this.game.hoverSelectorModel.setColor(canInteract ? Colors3.good : Colors3.bad);
		this.game.hoverSelectorModel.setPosition(pos.x, pos.y, 0);
		this.game.hoverSelectorModel.setVisible(true);

		if (canInteract
			&& potentialTile?.model
			&& this.game.hoverPreviewModel) {
			this.game.hoverPreviewModel.setMesh(this.assets.getModel(potentialTile.model));
			this.game.hoverPreviewModel.setColor(Colors3.tilePreview);
			this.game.hoverPreviewModel.setPosition(pos.x, pos.y, 0);
			this.game.hoverPreviewModel.setScale(0.5, 0.5, 0.5);
			this.game.hoverPreviewModel.setVisible(true);
		}
		else {
			this.game.hoverPreviewModel.setVisible(false);
		}
	}

	public tryInteractTile(tile: Tile) {
		if (tile.type.interact) {
			tile.type.interact(this, tile);
			this.regenVisuals();
			return true;
		}

		return false;
	}

	public canPlaceItem(tile: Tile, item: TileType | null) { return item != null && this.game.canPlaceTile(tile, item); }

	public placeItem(tile: Tile, type: TileType) {
		if (!this.canPlaceItem(tile, type))
			return; // Cannot place

		// Consume item
		this.game.consumeItem(type);

		// Place item
		if (type.place) type.place(this, tile);
		else this.replaceTile(tile, type);
		this.regenVisuals();

		// Apply rules
		this.applyRules();
	}

	public tryPlaceItems(tiles: Tile[], item: TileType): boolean {
		if (!this.game.hasItem(item, tiles.length))
			return false; // Not enough items

		// Check each placement is valid
		for (const tile of tiles) {
			if (!this.canPlaceItem(tile, item))
				return false;
		}

		// Consume items
		this.game.consumeItem(item, tiles.length);

		// Speed up animations
		const prevAnimDuration = Anims.BaseDur;
		const count = tiles.length;
		function updateAnimSpeed(i) {
			const t = i / (count - 1);
			const speed01 = 4 * (t - t * t);
			Anims.BaseDur = 0.1 * (1 - speed01) + 0.3;
		}

		// Place each item
		let i = 0;
		for (const tile of tiles) {
			if (item.place) item.place(this, tile);
			else this.replaceTile(tile, item);

			updateAnimSpeed(i++);
			this.regenVisuals();
		}

		// Restore animation speed
		Anims.BaseDur = prevAnimDuration;


		// Apply rules
		this.applyRules();

		return true;
	}

	public replaceTile(tile: Tile, type: TileType, rot: number | null = null) {
		if (type == Tiles.Empty || tile.type == Tiles.Empty) {
			this.game.setTileType(tile, type, rot);

			// Tile is already empty or becoming empty,
			//   so just use a single animation
			tile.regenTile(this);
			return;
		}

		// Update data
		this.game.setTileType(tile, type, rot);

		// Animate the replacement of tile models
		if (tile.type.regen) {
			Tiles.Empty.regen(this, tile);
			tile.regenTile(this);
		}
	}

	public mergeTilesInto(
		targetTile: Tile,
		tiles: Tile[],
		type: TileType,
		rot: number | null = null) {
		// Update Data
		for (const tile of tiles)
			this.game.setTileType(tile, Tiles.Empty, null);
		this.game.setTileType(targetTile, type, rot);

		// Update Visuals
		console.log("Start merge to " + targetTile.pos.name())
		this.startCombinedAnim();
		const duration = Anims.BaseDur;

		// Merge adjacent tiles
		const targetPos = Tile.calcVisualCenterPos(targetTile.pos);
		for (const tile of tiles)
			this.addAnim(tile.mergeModels_anim(this, targetPos, duration));

		// Destroy center tile
		this.addAnim(targetTile.destroyModels_anim(this, duration * 0.5));

		// Create center tile
		const delay = 0.5 * duration;
		let regenAnim = targetTile.regenTile_anim(this);
		this.addAnim(regenAnim?.delayed(delay));

		this.endAndAddCombinedAnim();
	}

	public applyRules() {
		this.game.applyRules(this);
		this.regenVisuals();
	}

	//#endregion Tile Actions

	//#region Model Creation

	public destroyOldModels(collection: ModelCollection,
		duration: number = Anims.BaseDur,
		delay: number = 0.75 * Anims.BaseDur) {
		this.addAnim(collection.destroyAll_anim(duration)?.delayed(delay))
	}

	public growMeshOnTile(
		collection: ModelCollection,
		tile: Tile,
		modelID: number,
		color: color3,
		pos: float3 = new float3(tile.pos.x, tile.pos.y, 0),
		scale: float3 = new float3().setScalar(1),
		rot: quat4 = new quat4(),
		duration: number = Anims.BaseDur,
		delay: number = 0,
		animRotation: boolean = true,
	): BatchedInstance {
		// Create initial model
		const model = this.renderer.addModel(
			modelID,
			new float3(tile.pos.x, tile.pos.y, 0),
			0,
			color,
			collection);

		// Animate to target transform
		this.addAnim(Anims.growModelTRS(
			model, pos, rot, scale as float3, duration, animRotation ? {} : { rot: rot.clone() }
		).delayed(delay));

		return model;
	}

	public growMesh({
		collection,
		tile,
		mesh,
		target = {
			pos: new float3(tile.pos.x, tile.pos.y, 0),
			rot: new quat4(),
			scale: new float3().setScalar(1),
		},
		anim = {
			duration: Anims.BaseDur,
			delay: 0,
			scaleOnly: false,
		},
	}: {
		collection: ModelCollection,
		tile: Tile,
		mesh: {
			modelID: number,
			color: color3,
		},
		target: trs3D,
		anim?: {
			duration?: number,
			delay?: number,
			scaleOnly: boolean,
		},
	}): BatchedInstance {
		// Extract Args (with Defaults)
		const duration = anim.duration ?? Anims.BaseDur;
		const delay = anim.delay ?? 0;
		const scaleOnly = anim.scaleOnly ?? false;

		// Create initial model
		const model = this.renderer.addModel_TRS(
			mesh.modelID,
			scaleOnly ? target.pos : new float3(tile.pos.x, tile.pos.y, 0),
			scaleOnly ? target.rot : new quat4(),
			new float3(),
			mesh.color,
			collection);

		// Animate to target transform
		this.addAnim(Anims.growModelTRS(
			model, target.pos, target.rot, target.scale, duration
		).delayed(delay));

		return model;
	}

	//#endregion Model Creation

	//#region GameState Access

	public addScore(tile: Tile, s: number) { return this.game.addScore(tile, s); }
	public addPop(tile: Tile, p: number) { return this.game.addPop(tile, p); }
	public addNat(tile: Tile, n: number) { return this.game.addNat(tile, n); }

	//#endregion GameState Access
}

export class GameState {
	public rng = new RandomSlice(Math.random(), 1024);

	public score: ProgressionMeter = new ProgressionMeter(0, 0, 0);
	public population: number = 0;
	public nature: number = 0;
	private _actIndex: number = 0;

	public grid: Grid<Tile>;
	public paths: PathSystem;

	public rules: Rule[] = makeRules();
	public items: Item[] = [];
	public anims: GameAnim[] = [];
	public isCreative = true;

	public renderer: GameRenderer = new GameRenderer();
	public get assets() { return this.renderer.assets; }

	public hoverSelectorModel!: BatchedInstance;
	public hoverPreviewModel!: BatchedInstance;
	public placementModels: ModelCollection = new ModelCollection();
	public cachedPlacementTiles: P2[] = [];

	//#region Setup

	constructor() {
		this.grid = new Grid(10,
			new Tile(new P2(-1, -1), Tiles.Empty),
			pos => new Tile(pos, Tiles.Empty));
		this.paths = new PathSystem(this);
	}

	public setupRendering() {
		// Hover Models
		{
			this.hoverSelectorModel = this.renderer.addModel(
				this.assets.model_Hover,
				new float3(0, 0, 0),
				1,
				Colors3.bad)
				.setName('hover selector');
			this.hoverSelectorModel.setVisible(false);

			this.hoverPreviewModel = this.renderer.addModel(
				this.assets.model_Hover,
				new float3(0, 0, 0),
				1,
				Colors3.white)
				.setName('hover preview');
			this.hoverPreviewModel.setVisible(false);
		}
	}

	public setupGame() {
		this._actIndex = 0;

		this.advanceScoreProgression();

		this.population = 0;
		this.nature = 0;

		this.isCreative = true;
		this.addItem(Tiles.House1, 1);
		this.addItem(Tiles.Path, 1);
		this.addItem(Tiles.Tree, 1);
		this.addItem(Tiles.Water, 1);
	}

	public clearGame() {
		// reset grid
		for (const tile of this.grid.cells) {
			tile.reset();
		}
	}

	//#endregion Setup

	//#region Animations

	private _animList: GameAnim[] = this.anims;

	public addAnim(anim: GameAnim | undefined) {
		if (!anim) return;
		this._animList.push(anim);
		return anim;
	}

	public addAnims(anims: GameAnim[]) {
		for (const anim of anims) {
			if (anim)
				this._animList.push(anim);
		}
	}

	public skipAnims() {
		this.anims.forEach(anim => anim.skip());
		this.anims.length = 0;
	}

	//#endregion Animations

	//#region Progression

	private advanceScoreProgression() {
		let progress = this.score;
		progress.id++;
		progress.startValue = progress.endValue;

		switch (progress.id) {
			case 1: progress.endValue = 8; break;
			case 2: progress.endValue = 15; break;
			case 3: progress.endValue = 30; break;
			case 4: progress.endValue = 45; break;
			case 5: progress.endValue = 60; break;
			case 6: progress.endValue = 90; break;
			case 7: progress.endValue = 120; break;
			case 8: progress.endValue = 150; break;
			case 9: progress.endValue = 180; break;
			case 10: progress.endValue = 210; break;
			case 11: progress.endValue = 240; break;
			case 12: progress.endValue = 270; break;
			case 13: progress.endValue = 300; break;
			default:
				progress.endValue += 50;
				break;
		}
	}

	//#endregion Progression

	//#region State Modification

	public onScoreUpdate: undefined | (() => void);

	public addScore(tile: Tile, s: number) {
		this.score.value += s;
		if (this.score.value >= this.score.endValue) {
			this.advanceScoreProgression();
		}
		this.score.updateVisuals();
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

	public setTileType(tile: Tile, type: TileType, rot: number | null = null) {
		if (tile.type === type)
			return;

		if (shouldLogTileDataUpdates)
			console.log(`Setting ${tile.name} to '${type.name}'`);
		tile.type = type;
		tile.rot = rot;
		tile.shouldRegen = true;
		tile.actIndex = ++this._actIndex;

		this.markForCheck(tile.pos.x, tile.pos.y);
		this.markAdjForCheck(tile.pos);
	}

	public canPlaceTile(tile: Tile, type: TileType) {
		// Ensure the tile is available
		if (!this.hasItem(type))
			return false; // no item

		// Ensure the tile is in bounds
		if (!this.isPlayablePos(tile.pos))
			return false;

		// Check if the tile type has a custom placement function
		if (type.canPlace)
			return type.canPlace(this, tile);

		if (tile.type !== Tiles.Empty)
			return false; // not empty

		return true;
	}

	public isPlayablePos(pos: P2) {
		return pos.x >= 1 && pos.x < this.grid.size - 1
			&& pos.y >= 1 && pos.y < this.grid.size - 1;
	}

	//#endregion State Modification

	//#region Items

	public hasItem(type: TileType, count: number = 1) {
		if (this.isCreative)
			return true;

		for (const item of this.items) {
			if (item.type === type)
				return item.count >= count;
		}

		return false;
	}

	public addItem(type: TileType, count?: number) {
		count ??= 1;
		for (const item of this.items) {
			if (item.type === type) {
				item.count += count;
				return;
			}
		}

		const icon = this.renderer.addModelIcon(
			this.assets.getModel(type.model),
			type.color ?? Colors3.white,
			type.icon);
		const item = new Item(type, count, icon);
		this.items.push(item);
	}

	public consumeItem(type: TileType, count: number = 1) {
		if (this.isCreative)
			return;

		for (const [index, item] of this.items.entries()) {
			if (item.type !== type)
				continue;

			item.count -= count;
			if (item.count < 1) {
				this.renderer.freeIcon(item.icon);
				this.items.splice(index, 1);
			}

			return;
		}
	}

	//#endregion Items

	//#region Rule Application

	private tilesToCheck: number = 0;

	public markForCheck(x: number, y: number) {
		if (x <= 0 || x >= this.grid.size - 1
			|| y <= 0 || y >= this.grid.size - 1)
			return; // Out of bounds or on edge

		const tile = this.grid.get(x, y);
		tile.shouldRegen = true;
		if (!tile.shouldCheck) {
			// console.log(`To Check ${tile.name}`);

			tile.shouldCheck = true;
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

		// console.log(`Checked ${tile.name}`);

		tile.shouldCheck = false;
		this.tilesToCheck--;
	}

	public get hasUnappliedRules() { return this.tilesToCheck > 0; }

	public applyRules(ctx: CTX) {
		while (this.hasUnappliedRules)
			this.applyRulesOnce(ctx);
	}

	public applyRulesOnce(ctx: CTX) {
		if (!this.hasUnappliedRules)
			return;

		// TODO: Consider optimizing by caching the applicable rules against the tile type

		let ruleIndex = Number.MAX_SAFE_INTEGER;
		let ruleToApply: Rule | null = null;
		let areaToApply: Area3x3 | null = null;
		let rotToApply = 0;

		// Check all tiles that require checking
		for (const cc of this.grid.cells) {
			if (!cc.shouldCheck) continue;

			let examinedAllRules = true;

			const pos = cc.pos;
			const tl = this.grid.get(pos.x - 1, pos.y + 1);
			const tc = this.grid.get(pos.x + 0, pos.y + 1);
			const tr = this.grid.get(pos.x + 1, pos.y + 1);
			const cl = this.grid.get(pos.x - 1, pos.y + 0);
			const cr = this.grid.get(pos.x + 1, pos.y + 0);
			const bl = this.grid.get(pos.x - 1, pos.y - 1);
			const bc = this.grid.get(pos.x + 0, pos.y - 1);
			const br = this.grid.get(pos.x + 1, pos.y - 1);

			let rot000 = new Area3x3(tl, tc, tr, cl, cc, cr, bl, bc, br);
			let rot090 = new Area3x3(bl, cl, tl, bc, cc, tc, br, cr, tr);
			let rot180 = new Area3x3(br, bc, bl, cr, cc, cl, tr, tc, tl);
			let rot270 = new Area3x3(tr, cr, br, tc, cc, bc, tl, cl, bl);

			// Search through rules
			for (const [index, rule] of this.rules.entries()) {
				if (index >= ruleIndex) {
					examinedAllRules = false;
					break; // A matched rule is better
				}

				if (!isTile(rule.match.c, cc.type))
					continue; // Center does not match

				// Try matching the rule
				if (rule.match.isMatch(rot000)) {
					examinedAllRules = false;
					ruleToApply = rule;
					areaToApply = rot000;
					rotToApply = 0;
					ruleIndex = index;
					break;
				}

				// Try matching rotations of the rule
				if (rule.rotations & RuleRotations.Rotate1) {
					if (rule.match.isMatch(rot090)) {
						examinedAllRules = false;
						ruleToApply = rule;
						areaToApply = rot090;
						rotToApply = 90;
						ruleIndex = index;
						break;
					}
				}

				if (rule.rotations & RuleRotations.Rotate4) {
					if (rule.match.isMatch(rot180)) {
						examinedAllRules = false;
						ruleToApply = rule;
						areaToApply = rot180;
						rotToApply = 180;
						ruleIndex = index;
						break;
					}

					if (rule.match.isMatch(rot270)) {
						examinedAllRules = false;
						ruleToApply = rule;
						areaToApply = rot270;
						rotToApply = 270;
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
			console.log(`Applying rule '${ruleToApply.name}' at ${areaToApply!.c.pos.name()}`);
			ruleToApply.apply(ctx, areaToApply!, rotToApply);
		}
		// else console.log(`No rule to apply`);
	}

	//#endregion Rule Application

	public getRegenListStr() {
		let str = '';

		for (const tile of this.grid.cells) {
			if (tile.shouldRegen) str += `${tile.name},`;
		}

		return str;
	}
}

