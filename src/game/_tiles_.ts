import { Colors3 } from "../styles/colors";
import { color3, float3, quat4, Utils3 } from "../utils/threeUtils";
import { Anims } from "./GameAnims";
import { CTX } from "./GameState";
import { P2 } from "./P2";
import { Pathing } from "./PathSystem";
import { RenderAssets, Z_PathDepth } from "./render/GameRenderer";
import { RandomSlice } from "./SeededRandom";
import { Tile, TileType } from "./Tile";

export const Tiles = {
	Any: { name: "any" },
	Empty: {
		name: "empty",
		canPlace(game, tile) { return true; },
		regen(ctx, tile) {
			ctx.addAnim(tile.destroyModels_anim(ctx));
		}
	},

	House1: {
		name: "house",
		model: a => a.model_House1,
		icon: {
			baseSize: 1.6,
			baseDegZ: 5,
		},
		color: Colors3.tileHouse1,
		centerVariance: 0.025,
		pathing: Pathing.ConnectAny_Adj4(),
		place(ctx, tile) {
			ctx.addScore(tile, 1);
			ctx.replaceTile(tile, this);
		},
		interact(ctx, tile) {
			ctx.paths.rotatePath_Adj4(ctx, tile);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);
				const size = rng.nextF(1, 1.2);
				const zDeg = rng.nextDegSnapped(30);

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
	House2: makeSimpleBuilding("house2", a => a.model_House2, { scale: 0.8, color: Colors3.tileHouse2 }),
	House3: makeSimpleBuilding("house3", a => a.model_House3, { scale: 0.8, color: Colors3.tileHouse3 }),

	Factory1: makeSimpleBuilding("building", a => a.model_Factory1, { scale: 0.8, color: Colors3.tileHouse2 }),
	Sawmill: {
		name: "sawmill",
		model: a => a.model_Sawmill,
		color: Colors3.tileHouse2,
		pathing: Pathing.ConnectAny_Adj4(),
		interact(ctx, tile) {
			ctx.paths.rotatePath_Adj4(ctx, tile);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);
				const size = 1;
				const zDeg = tile.rot ?? 0;

				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					centerPos,
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);
				addGroundPath(ctx, tile, rng, "large");
			}
		},
	},

	Path: {
		name: "path",
		model: a => a.model_LineCap,
		color: Colors3.tileRoad1,
		centerVariance: 0,
		pathing: Pathing.ConnectAll_Adj8(),
		place(ctx, tile) {
			ctx.addScore(tile, 1);
			ctx.replaceTile(tile, this);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const pos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);
				const size = rng.nextF(0.5, 0.5);
				const zDeg = tile.rot ?? 0;

				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					pos.setZ(Z_PathDepth),
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);
			}
		}
	},
	Fountain: {
		name: "fountain",
		model: a => a.model_Fountain,
		color: Colors3.tileRoad1,
		centerVariance: 0,
		pathing: Pathing.ConnectAll_Adj4()
			.preventDiagonals(),
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				const rng = tile.rng(ctx);
				const pos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);

				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					pos,
				);
				addGroundPath(ctx, tile, rng, "large");
			}
		},
	},

	Tree: {
		name: "tree",
		model: a => a.model_Tree1,
		icon: {
			baseDegZ: -60,
			baseSize: 0.6,
		},
		color: Colors3.tileTree1,
		centerVariance: 0.1,
		place(ctx, tile) {
			ctx.addScore(tile, 1);
			ctx.replaceTile(tile, this);
		},
		regen(ctx, tile) {
			const rng = tile.rng(ctx);

			// Check for neighbouring trees and adjust the center to be near other trees
			const adj = ctx.grid.getAdj8(tile.pos);
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
			addTileWeight(adj.u, +0, +1);
			addTileWeight(adj.ur, +1, +1);
			addTileWeight(adj.l, -1, +0);
			addTileWeight(adj.r, +1, +0);
			addTileWeight(adj.dl, -1, -1);
			addTileWeight(adj.d, +0, -1);
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
			const offset = this.centerVariance ?? 0;
			centerPos.x += rng.nextF(-offset, offset);
			centerPos.y += rng.nextF(-offset, offset);

			if (tile.firstTimeBuild()) {
				// Grow the new model
				const model = rng.choose(ctx.assets.model_SingleTrees);
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

				const positions = [
					new P2(0.5, 0.5),
					new P2(0.25, 0.25),
					new P2(0.25, 0.75),
					new P2(0.75, 0.25),
					new P2(0.75, 0.75),
				];
				for (let pos of positions) {
					const model = rng.choose(ctx.assets.model_SingleTrees);
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
	},

	Water: {
		name: "water",
		model: a => a.model_Water,
		color: Colors3.tileWater,
		interact(ctx, tile) { },
		regen(ctx, tile) {
			let waterModelID = 0;
			let rot = 0;

			calcWaterConnection();

			function calcWaterConnection() {
				// Calculate water connections
				const adj = ctx.grid.getAdj8(tile.pos);
				const isWaterU = adj.u.type == Tiles.Water;
				const isWaterD = adj.d.type == Tiles.Water;
				const isWaterL = adj.l.type == Tiles.Water;
				const isWaterR = adj.r.type == Tiles.Water;
				const isWaterUL = adj.ul.type == Tiles.Water;
				const isWaterUR = adj.ur.type == Tiles.Water;
				const isWaterDL = adj.dl.type == Tiles.Water;
				const isWaterDR = adj.dr.type == Tiles.Water;
				const count4 = 0
					+ (isWaterU ? 1 : 0)
					+ (isWaterD ? 1 : 0)
					+ (isWaterL ? 1 : 0)
					+ (isWaterR ? 1 : 0);
				if (count4 == 0) {
					waterModelID = 0; // Puddle
					rot = 0;
					return;
				}

				if (count4 == 1) {
					waterModelID = 1; // End
					rot = isWaterR ? 0
						: isWaterU ? 1
							: isWaterL ? 2
								: 3;
					return;
				}

				if (count4 == 2) {
					// Check for straight segments
					{
						if (isWaterL && isWaterR) {
							waterModelID = 2; // I
							rot = 0;
							return;
						}

						if (isWaterU && isWaterD) {
							waterModelID = 2; // I
							rot = 1;
							return;
						}
					}

					// Water must be an L-bend
					waterModelID = 3; // L
					if (isWaterR) {
						if (isWaterU) rot = 1;
						else rot = 0;
					}
					else {
						// water must be on the left here
						if (isWaterU) rot = 2;
						else rot = 3;
					}
					return;
				}

				if (count4 == 3) {
					waterModelID = 4; // T
					if (!isWaterU) rot = 0;
					else if (!isWaterL) rot = 1;
					else if (!isWaterR) rot = 3;
					else rot = 2;
					return;
				}

				waterModelID = 5; // X
			}

			const cachedWaterID = waterModelID << 0x2 | rot & 0x2;
			if (tile.firstTimeBuild() || tile.rot != cachedWaterID) {
				tile.rot = cachedWaterID;

				// Add model
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos);
				const size = 1;
				const zDeg = rot * 90;
				const model = ctx.assets.model_WaterTiles[waterModelID]!;

				// Destroy old models
				ctx.destroyOldModels(tile.models);
				ctx.growMeshOnTile(
					tile.models,
					tile,
					model,
					new color3(this.color),
					centerPos,
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
					Anims.BaseDur,
					0,
					false,
				);
			}
		},
	},
} as const satisfies Record<string, TileType>;

function makeSimpleBuilding(
	name: string,
	model: (a: RenderAssets) => number,
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
	return {
		name: name,
		model: model,
		color: color,
		centerVariance: 0,
		pathing: Pathing.ConnectAny_Adj4(),
		interact(ctx, tile) {
			ctx.paths.rotatePath_Adj4(ctx, tile);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const centerPos = Tile.calcVisualCenterPos(tile.pos);
				const size = baseModelScale;
				const zDeg = baseModelRot + (tile.rot ?? 0);

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
	};
}

function addGroundPath(ctx: CTX, tile: Tile, rng: RandomSlice, size: 'small' | 'large') {
	ctx.growMeshOnTile(
		tile.models,
		tile,
		size == 'small' ? ctx.assets.model_PathGround_Small : ctx.assets.model_PathGround_Large,
		Colors3.tileRoad1,
		new float3(tile.pos.x, tile.pos.y, Z_PathDepth),
		new float3().setScalar(1),
		Utils3.rotZRad(rng.nextRadians()),
	);
}