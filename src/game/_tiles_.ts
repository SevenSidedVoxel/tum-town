import { Colors3 } from "../styles/colors";
import { color3, float3, quat4, Utils3 } from "../utils/threeUtils";
import { Anims } from "./GameAnims";
import { CTX } from "./GameState";
import { P2 } from "./P2";
import { Pathing } from "./PathSystem";
import { Z_GroundDepth, Z_PathDepth } from "./render/GameRenderer";
import { calcConnectTile_Adj4, calcConnectTile_Adj8, ConnectTiles, pickConnectModel_Adj4 } from './render/FillTileTypes';
import { RandomSlice } from "./SeededRandom";
import { hasTag, Tile, TileType } from "./Tile";
import { RenderAssets } from "./render/_assets_";
import { ModelMesh } from './render/ModelMesh';

export class Tags {
	public static ConnectsToFields: string = "";
}

export const Tiles = {
	Any: { name: "any" },
	Empty: {
		name: "empty",
		canPlace(game, tile) { return true; },
		regen(ctx, tile) {
			ctx.addAnim(tile.destroyModels_anim(ctx));
			ctx.addAnim(tile.setTileColor_anim(Tile.getTileBaseColor(tile.pos)));
		}
	},

	House1: {
		name: "house",
		model: a => a.model_House,
		icon: {
			baseSize: 1.6,
			baseDegZ: 5,
		},
		color: Colors3.tileHouse1,
		centerVariance: 0.025,
		pathing: Pathing.ConnectAny_Adj8(),
		place(ctx, tile) {
			ctx.addScore(tile, 1);
			ctx.replaceTile(tile, this);
		},
		interact(ctx, tile) {
			ctx.paths.rotatePath(ctx, tile);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);
				const size = rng.nextF(1, 1.2);
				const zDeg = rng.nextDegSnapped(30);

				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					centerPos,
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);
			}
		},
	},
	House2: makeSimpleBuilding("big house", a => a.model_House_L, { scale: 0.8, color: Colors3.tileHouse2 }),
	House3: makeSimpleBuilding("mansion", a => a.model_House_Big, { scale: 0.8, color: Colors3.tileHouse3 }),

	Building: makeSimpleBuilding("building", a => a.model_Building, { scale: 0.8, color: Colors3.tileHouse2 }),
	Sawmill: makeSimpleBuilding("sawmill", a => a.model_Sawmill, { ground: "large" })
		.withPathing(Pathing.ConnectAny_Adj8()),
	Mine: makeSimpleBuilding("mine", a => a.model_Mine, { ground: "large" })
		.withPathing(Pathing.ConnectAny_Adj8()),

	TownBell: makeSimpleBuilding("town bell", a => a.model_TownBell, { color: Colors3.tileHouse2, ground: "small" })
		.withPathing(Pathing.ConnectAll_Adj8().markSource().blockDiagonals()),
	Fountain: makeSimpleBuilding("fountain", a => a.model_Fountain, { ground: "large" })
		.withPathing(Pathing.ConnectAll_Adj8().markSource().blockDiagonals()),
	Path: {
		name: "path",
		model: a => a.model_LineCap,
		icon: { model: a => a.model_RoadStone },
		color: Colors3.tileRoad1,
		centerVariance: 0,
		pathing: Pathing.ConnectAll_Adj8()
			.markSource()
			.blockDiagonals(),
		place(ctx, tile) {
			ctx.addScore(tile, 1);
			ctx.replaceTile(tile, this);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const pos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);
				const size = 0.5;
				const zDeg = tile.rot ?? 0;

				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.model_LineCap,
					new color3(this.color),
					pos.setZ(Z_PathDepth),
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);
			}
		}
	},

	Church: makeSimpleBuilding("church", a => a.model_Church, { scale: 0.8, color: Colors3.white }),
	Graveyard: makeFieldType("graveyard",
		a => a.model_Graves[0]!,
		a => a.model_StoneWalls,
		t => t.type == Tiles.Graveyard || t.type == Tiles.Church,
		{
			color: Colors3.white,
			innerBuild: (ctx, tile) => {
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos);
				distributeObjects(ctx, tile, rng, centerPos, {
					scaleRange: new P2(0.6, 0.8),
					posVariance: 0,
					models: ctx.assets.model_Graves,
					colors: [Colors3.flower1, Colors3.flower2, Colors3.flower3, Colors3.flower4],
					rotVariance: 30,
				});
			}
		}),

	Stone: {
		name: "stone",
		model: a => a.model_Stone1,
		icon: {
			baseDegZ: -60,
		},
		color: Colors3.tileDark,
		centerVariance: 0.05,
		place(ctx, tile) {
			ctx.addScore(tile, 1);
			ctx.replaceTile(tile, this);
		},
		regen(ctx, tile) {
			const rng = tile.rng(ctx);

			// Check for neighbouring stones and adjust the center to be nearer
			const adj = ctx.grid.getAdj8(tile.pos);
			const pullForce = new P2(0, 0);
			let pullCount = 0;
			function addTileWeight(tile: Tile, x: number, y: number) {
				let weight = Math.abs(x) == Math.abs(y) ? 1.25 : 1;

				if (tile.type == Tiles.Stone) {
					pullForce.addXY(x * weight, y * weight);
					pullCount++;
				}
			}
			addTileWeight(adj.ul, -1, +1);
			addTileWeight(adj.u, +0, +1);
			addTileWeight(adj.ur, +1, +1);
			addTileWeight(adj.l, -1, +0);
			addTileWeight(adj.r, +1, +0);
			addTileWeight(adj.dl, -1, -1);
			addTileWeight(adj.d, +0, -1);
			addTileWeight(adj.dr, +1, -1);
			let center = new P2(0, 0);
			if (pullCount > 0) {
				center = pullForce
					.mulS(1.0 / pullCount)
					.mulXY(0.2, 0.2)
					.clampXY(-1, 1, -1, 1);
			}

			const centerPos = new float3(center.x, center.y - 0.1, 0)
				.add({ x: tile.pos.x, y: tile.pos.y, z: 0 });

			// Add random offset
			const offset = this.centerVariance ?? 0;
			centerPos.x += rng.nextF(-offset, offset);
			centerPos.y += rng.nextF(-offset, offset);

			if (tile.firstTimeBuild()) {
				// Grow the new model
				const model = rng.choose(ctx.assets.model_SingleStones);
				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.growMeshOnTile(
					tile.models,
					tile,
					model,
					new color3(this.color),
					centerPos,
					new float3().setScalar(rng.nextF(0.9, 1)),
					Utils3.rotZRad(rng.nextRadians())
				);
				return;
			}
			else {
				// Move the existing model
				ctx.addAnim(Anims.moveModel(
					tile.models.models[0]!,
					centerPos
				));
			}
		},
	},

	Barn: makeSimpleBuilding("barn", a => a.model_Barn),
	Field: makeFieldType("field",
		a => a.model_StoneWalls[0]!,
		a => a.model_StoneWalls,
		t => hasTag(t.type, Tags.ConnectsToFields),
		{
			color: Colors3.white,
			innerBuild: (ctx, tile) => {
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos);
				distributeObjects(ctx, tile, rng, centerPos, {
					models: [...ctx.assets.model_GrassPatches, null],
					colors: [Colors3.grass1, Colors3.grass2, Colors3.grass3, Colors3.grass4],
					posVariance: 0.05,
					rotVariance: 180,
					scaleRange: new P2(0.7, 1.3),
					rotatePattern: true,
				})
			}
		})
		.addTags(Tags.ConnectsToFields),
	Pasture: makeFieldType("pasture",
		a => a.model_Fences[0]!,
		a => a.model_Fences,
		t => t.type == Tiles.Pasture || t.type == Tiles.Barn,
		{
			color: Colors3.fence,
			innerBuild: (ctx, tile) => {
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos);
				distributeObjects(ctx, tile, rng, centerPos, {
					models: [...ctx.assets.model_GrassPatches],
					colors: [Colors3.grass1, Colors3.grass2, Colors3.grass2],
					rotVariance: 180,
					scaleRange: new P2(0.7, 1.3),
					rotatePattern: true,
				});

				const cowOdds = Tile.isDark(tile.pos) ? 0.8 : 0.7;
				if (rng.next01() <= cowOdds) {
					const size = rng.nextF(0.9, 1.6);
					const pos = centerPos.clone()
						.add({ x: rng.nextF(-0.25, 0.25), y: rng.nextF(-0.25, 0.25), z: 0 });
					ctx.growMesh({
						collection: tile.models,
						tile: tile,
						mesh: {
							model: rng.choose(ctx.assets.model_Cows),
							color: rng.choose([Colors3.cow1, Colors3.cow2, Colors3.cow3]),
						},
						target:
						{
							pos: pos,
							scale: new float3(size, size, size),
							rot: Utils3.rotZDeg(rng.nextDeg()),
						}
					});
				}
			}
		}),

	Tree: {
		name: "tree",
		model: a => a.model_Tree1,
		icon: {
			baseDegZ: -60,
			baseSize: 0.8,
		},
		color: Colors3.tileTree1,
		centerVariance: 0.05,
		place(ctx, tile) {
			ctx.addScore(tile, 1);
			ctx.replaceTile(tile, this);
		},
		regen(ctx, tile) {
			const rng = tile.rng(ctx);

			// Check for neighbouring trees and adjust the center to be near other trees
			const adj = ctx.grid.getAdj8(tile.pos);
			const treeCenter = new P2(0, 0);
			const forestCenter = new P2(0, 0);
			const avoidForce = new P2(0, 0);
			let treeCount = 0;
			let forestCount = 0;
			let avoidCount = 0;
			function addTileWeight(tile: Tile, x: number, y: number) {
				let weight = Math.abs(x) == Math.abs(y) ? 1.25 : 1;

				if (tile.type == Tiles.Tree) {
					treeCenter.addXY(x * weight, y * weight);
					treeCount++;
				}
				else if (tile.type == Tiles.Forest) {
					forestCenter.addXY(x * weight, y * weight);
					forestCount++;
				} else if (tile.type == Tiles.House2
					|| tile.type == Tiles.House3) {
					weight *= -0.5;
					avoidForce.addXY(x * weight, y * weight);
					avoidCount++;
				}
			}
			addTileWeight(adj.ul, -1, +1);
			addTileWeight(adj.u, +0, +1);
			addTileWeight(adj.ur, +1, +1);
			addTileWeight(adj.l, -1, +0);
			addTileWeight(adj.r, +1, +0);
			addTileWeight(adj.dl, -1, -1);
			addTileWeight(adj.d, +0, -1);
			addTileWeight(adj.dr, +1, -1);
			let center = new P2(0, 0);
			if (forestCount > 0) {
				const count = forestCount + avoidCount;
				center = forestCenter.addV(avoidForce);
				center.mulS(1.0 / count);
				center.mulXY(0.25, 0.25);
				center.clampXY(
					-1, 1,
					-1, 1
				);
			}
			else if (treeCount > 0) {
				const count = treeCount + avoidCount;
				center = treeCenter.addV(avoidForce);
				center.mulS(1.0 / count);
				center.mulXY(0.25, 0.25);
				center.clampXY(
					-1, 1,
					-1, 1
				);
			}

			const centerPos = new float3(center.x, center.y - 0.1, 0)
				.add({ x: tile.pos.x, y: tile.pos.y, z: 0 });

			// Add random offset
			const offset = this.centerVariance ?? 0;
			centerPos.x += rng.nextF(-offset, offset);
			centerPos.y += rng.nextF(-offset, offset);

			if (tile.firstTimeBuild()) {
				// Grow the new model
				const model = rng.choose(ctx.assets.model_SmallTrees);
				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.growMeshOnTile(
					tile.models,
					tile,
					model,
					new color3(this.color),
					centerPos,
					new float3().setScalar(rng.nextF(0.9, 1)),
					Utils3.rotZRad(rng.nextRadians())
				);
				return;
			}
			else {
				// Move the existing model
				ctx.addAnim(Anims.moveModel(
					tile.models.models[0]!,
					centerPos
				));
			}
		},
		tags: [Tags.ConnectsToFields]
	},
	Forest: {
		name: "forest",
		model: a => a.model_Tree1,
		color: Colors3.tileTree1,
		centerVariance: 0.05,
		place(ctx, tile) {
			ctx.addScore(tile, 1);
			ctx.replaceTile(tile, this);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);

				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				const positions = [
					new P2(0.5, 0.5),
					new P2(0.25, 0.25),
					new P2(0.25, 0.75),
					new P2(0.75, 0.25),
					new P2(0.75, 0.75),
				];
				for (let pos of positions) {
					const model = rng.choose(ctx.assets.model_SmallTrees);
					const p = pos
						.addXY(centerPos.x - 0.5, centerPos.y - 0.5)
						.addXY(rng.nextF(-0.05, 0.05), rng.nextF(-0.05, 0.05));
					ctx.growMeshOnTile(
						tile.models,
						tile,
						model,
						new color3(this.color),
						new float3(p.x, p.y, 0),
						new float3().setScalar(rng.nextF(0.7, 1)),
						Utils3.rotZRad(rng.nextRadians()),
					);
				}
			}
		},
		tags: [Tags.ConnectsToFields]
	},
	BigTree: {
		name: "big tree",
		model: a => a.model_BigTree,
		color: Colors3.tileTree1,
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);

				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					centerPos,
					new float3().setScalar(rng.nextF(0.9, 1)),
					Utils3.rotZRad(tile.rot ?? 0),
				);
				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.model_GrassPatch,
					Colors3.floorForest,
					centerPos,
					new float3().setScalar(rng.nextF(0.9, 1)),
					Utils3.rotZDeg(rng.nextI(0, 4) * 90),
				);
			}
		},
		tags: [Tags.ConnectsToFields]
	},
	XmasTree: {
		name: "xmas tree",
		model: a => a.model_XmasTree,
		color: Colors3.tileTree1,
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);

				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					centerPos,
					new float3().setScalar(rng.nextF(0.9, 1)),
					Utils3.rotZRad(tile.rot ?? 0),
				);
				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.model_GrassPatch,
					Colors3.floorForest,
					centerPos,
					new float3().setScalar(rng.nextF(0.9, 1)),
					Utils3.rotZDeg(rng.nextI(0, 4) * 90),
				);
			}
		},
		tags: [Tags.ConnectsToFields]
	},

	Water: {
		name: "water",
		model: a => a.model_Water,
		icon: { baseSize: 1.25 },
		color: Colors3.tileWater,
		regen(ctx, tile) {
			const [fill, rot] = calcConnectTile_Adj8(ctx, tile, t => t.type == Tiles.Water || t.type == Tiles.Bridge);
			const cachedWaterID = fill << 0x2 | rot & 0x2;
			if (tile.firstTimeBuild() || tile.rot != cachedWaterID) {
				tile.rot = cachedWaterID;

				// Add model
				const centerPos = Tile.calcVisualCenterPos(tile.pos);
				const size = 1;
				const zDeg = rot * 90;
				const rotQuat = Utils3.rotZDeg(zDeg);
				const model = ctx.assets.model_WaterTiles[fill]!;

				// Destroy old models
				ctx.destroyOldModels(tile.models);
				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.growMesh({
					collection: tile.models,
					tile: tile,
					mesh: {
						model: model,
						color: new color3(this.color),
					},
					target:
					{
						pos: centerPos,
						scale: new float3(size, size, size),
						rot: rotQuat,
					},
					anim: {
						scaleOnly: true,
					}
				});

				if (fill == ConnectTiles.Isolated) {
					// Pond
					const rng = tile.rng(ctx);
					ctx.growMesh({
						collection: tile.models,
						tile: tile,
						mesh: {
							model: rng.choose(ctx.assets.model_PondDecors),
							color: Colors3.white,
						},
						target:
						{
							pos: centerPos,
							scale: new float3(size, size, size),
							rot: Utils3.rotZDeg(rng.nextI(0, 3) * 90),
						},
						anim: {
							scaleOnly: true,
						}
					});
				}
			}
		},
	},
	Bridge: {
		name: "bridge",
		model: a => a.model_Bridge,
		color: Colors3.tileBridge,
		pathing: Pathing.ConnectAll_Adj4(),
		regen(ctx, tile) {
			const [waterFill, waterRot] = calcConnectTile_Adj8(ctx, tile, t => t.type == Tiles.Water);
			const cachedWaterID = waterFill << 0x2 | waterRot & 0x2;
			if (tile.firstTimeBuild() || tile.rot != cachedWaterID) {
				tile.rot = cachedWaterID;

				// Calc model position
				const centerPos = Tile.calcVisualCenterPos(tile.pos);
				const rot = Utils3.rotZDeg(waterRot * 90);

				// Destroy old models
				ctx.destroyOldModels(tile.models);
				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));

				// Add water model
				const waterModel = ctx.assets.model_WaterTiles[waterFill]!;
				ctx.growMesh({
					collection: tile.models,
					tile: tile,
					mesh: {
						model: waterModel,
						color: Colors3.tileWater,
					},
					target:
					{
						pos: centerPos,
						scale: new float3().setScalar(1),
						rot: rot,
					},
					anim: {
						scaleOnly: true,
					}
				});

				// Add Bridge Model
				ctx.growMesh({
					collection: tile.models,
					tile: tile,
					mesh: {
						model: ctx.assets.model_Bridge,
						color: new color3(this.color),
					},
					target:
					{
						pos: centerPos.clone().setZ(Z_PathDepth),
						scale: new float3().setScalar(1),
						rot: rot,
					},
					anim: {
						scaleOnly: true,
					}
				});
			}
		},
	},
} as const satisfies Record<string, TileType>;

function makeTileBuilder(tile: TileType) {
	const builder = {
		...tile,
		withPathing(pathing: Pathing) {
			this.pathing = pathing;
			return this;
		},
		addTags(...tags: string[]) {
			if (!this.tags) this.tags = [];
			this.tags.push(...tags);
			return this;
		}
	}
	return builder;
}

function makeSimpleBuilding(
	name: string,
	model: (a: RenderAssets) => ModelMesh,
	draw: {
		scale?: number,
		rot?: number,
		color?: color3,
		ground?: "small" | "large",
	} = {}) {
	const baseModelScale = draw?.scale ?? 1;
	const baseModelRot = draw?.rot ?? 0;
	const color = draw?.color ?? Colors3.tileHouse1;
	const ground = draw?.ground;
	return makeTileBuilder({
		name: name,
		model: model,
		color: color,
		centerVariance: 0,
		pathing: Pathing.ConnectAny_Adj8(),
		interact(ctx, tile) {
			ctx.paths.rotatePath(ctx, tile);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos);
				const size = baseModelScale;
				const zDeg = baseModelRot + (tile.rot ?? 0);

				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					centerPos,
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);

				if (ground)
					addGroundPath(ctx, tile, rng, ground);
			}
		},
	});
}

function makeFieldType(
	name: string,
	model: (a: RenderAssets) => ModelMesh,
	edgeModels: (a: RenderAssets) => ModelMesh[],
	canConnect: (tile: Tile) => boolean,
	draw: {
		color?: color3,
		innerBuild?: (ctx: CTX, tile: Tile) => void,
	} = {}) {
	const color = draw?.color ?? Colors3.white;
	return makeTileBuilder({
		name: name,
		model: model,
		pathing: Pathing.None().blockDiagonals(),
		regen(ctx, tile) {
			const [fill, rI] = calcConnectTile_Adj4(ctx, tile, canConnect);
			const cachedFillID = fill << 0x2 | rI & 0x2;

			if (tile.firstTimeBuild() || cachedFillID != tile.rot) {
				tile.rot = cachedFillID;

				// Add model
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);
				const size = 1;
				const zDeg = rI * 90;
				const model = pickConnectModel_Adj4(fill, edgeModels(ctx.assets));

				ctx.addAnim(tile.setTileColor_anim(Colors3.floorForest));
				ctx.destroyOldModels(tile.models);

				draw.innerBuild?.(ctx, tile);

				if (!model) return;

				ctx.growMesh({
					collection: tile.models,
					tile: tile,
					mesh: {
						model: model,
						color: color,
					},
					target: {
						pos: centerPos,
						rot: Utils3.rotZDeg(zDeg),
						scale: new float3().setScalar(size),
					},
					anim: {
						scaleOnly: true,
					}
				});
			}
		},
	});
}

function addGroundPath(ctx: CTX, tile: Tile, rng: RandomSlice, size: 'small' | 'large', color: color3 = Colors3.tileRoad1) {
	ctx.growMeshOnTile(
		tile.models,
		tile,
		size == 'small' ? ctx.assets.model_PathGround_Small : ctx.assets.model_PathGround_Large,
		color,
		new float3(tile.pos.x, tile.pos.y, Z_GroundDepth),
		new float3().setScalar(1),
		Utils3.rotZRad(rng.nextRadians()),
	);
}

function distributeObjects(ctx: CTX, tile: Tile, rng: RandomSlice,
	centerPos: float3,
	draw: {
		scaleRange?: P2,
		posVariance?: number,
		rotVariance?: number,
		models: (ModelMesh | null)[],
		colors?: color3[],
		rotatePattern?: boolean,
	}) {

	const models = draw.models;
	if (models?.length < 1)
		return;

	const minScale = draw.scaleRange?.x ?? 1;
	const maxScale = draw.scaleRange?.y ?? 1;
	const posVariance = draw.posVariance ?? 0;
	const rotVariance = draw.rotVariance ?? 0;
	const colors = draw.colors ?? [Colors3.white];
	const rotatePattern = draw.rotatePattern ?? false;

	let positions: P2[];
	const positionsChoice = rng.nextI(0, 4);
	switch (positionsChoice) {
		case 2:
			positions = [
				new P2(0.7, 0.25),
				new P2(0.3, 0.4),
				new P2(0.5, 0.75),
			];
			break;
		case 1:
			positions = [
				new P2(0.3, 0.25),
				new P2(0.7, 0.4),
				new P2(0.5, 0.75),
			];
			break;
		case 0:
		default:
			positions = [
				new P2(0.3, 0.25),
				new P2(0.25, 0.75),
				new P2(0.75, 0.25),
				new P2(0.75, 0.75),
			];
			break;
	}

	if (rotatePattern) {
		const deg = rng.nextDeg();
		const [x, y] = Utils3.degToDirs(deg);
		for (let pos of positions)
			pos.subS(0.5).remap(x, y).addS(0.5);
	}

	for (let pos of positions) {
		const model = rng.choose(models);
		if (!model) continue;
		const color = rng.choose(colors);
		const p = pos
			.addXY(centerPos.x - 0.5, centerPos.y - 0.5)
			.addXY(rng.nextF(-posVariance, posVariance), rng.nextF(-posVariance, posVariance));

		ctx.growMeshOnTile(
			tile.models,
			tile,
			model,
			color,
			new float3(p.x, p.y, 0),
			new float3().setScalar(rng.nextF(minScale, maxScale)),
			rotVariance != 0 ? Utils3.rotZDeg(rng.nextF(-rotVariance, +rotVariance)) : new quat4(),
		);
	}
}