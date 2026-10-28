import { Colors3 } from "../styles/colors";
import { color3, float3, quat4, Utils3 } from "../utils/threeUtils";
import { Anims } from "./GameAnims";
import { P2 } from "./P2";
import { PathSystem } from "./PathSystem";
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
		model: "model_House1",
		icon: {
			baseSize: 0.7,
			baseDegZ: 5,
		},
		color: Colors3.tileHouse1,
		centerVariance: 0.025,
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
				const size = rng.nextF(0.7, 0.8);
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

			// Connect to an adjacent path
			ctx.paths.connectToAny_Adj4(ctx, tile);
		},
	},
	House2: {
		name: "house2",
		model: "model_House2",
		color: Colors3.tileHouse2,
		centerVariance: 0.005,
		interact(ctx, tile) {
			ctx.paths.rotatePath(ctx, tile);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const pos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance)
					.add({ x: 0, y: -0.1, z: 0 });
				const size = rng.nextF(0.7, 0.8);
				const zDeg = tile.rot ?? 0;

				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					pos,
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);
			}

			// Connect to an adjacent path
			ctx.paths.connectToAny_Adj4(ctx, tile);
		}
	},
	House3: {
		name: "house3",
		model: "model_House3",
		color: Colors3.tileHouse3,
		interact(ctx, tile) {
			ctx.paths.rotatePath(ctx, tile);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
				const rng = tile.rng(ctx);
				const pos = Tile.calcVisualCenterPos(tile.pos, rng, this.centerVariance);
				const size = rng.nextF(0.7, 0.8);
				const zDeg = tile.rot ?? 0;

				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					pos,
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);
			}

			// Connect to an adjacent path
			ctx.paths.connectToAny_Adj4(ctx, tile);
		}
	},

	Path: {
		name: "path",
		model: "model_LineCap",
		color: Colors3.tileRoad1,
		centerVariance: 0,
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
					pos,
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);
			}

			{
				// Connect to adjacent paths in the Up/Left/Right directions
				const adj = ctx.grid.getAdj8(tile.pos);
				const connectU = PathSystem.isPath(adj.uc);
				const connectL = PathSystem.isPath(adj.cl);
				const connectR = PathSystem.isPath(adj.cr);
				const connectD = PathSystem.isPath(adj.dc);

				updatePath(tile, adj.uc, connectU, false);
				updatePath(tile, adj.dc, connectD, false);
				updatePath(tile, adj.cl, connectL, false);
				updatePath(tile, adj.cr, connectR, false);
				updatePath(tile, adj.ul, !connectU && !connectL && PathSystem.isPath(adj.ul), true);
				updatePath(tile, adj.ur, !connectU && !connectR && PathSystem.isPath(adj.ur), true);
				updatePath(tile, adj.dl, !connectD && !connectL && PathSystem.isPath(adj.dl), true);
				updatePath(tile, adj.dr, !connectD && !connectR && PathSystem.isPath(adj.dr), true);
				return;

				function updatePath(tile: Tile, otherTile: Tile, shouldConnect: boolean, forceRemove: boolean) {
					if (shouldConnect)
						ctx.paths.connectTiles(ctx, tile.pos, otherTile.pos);
					else if (otherTile.type == Tiles.Empty || forceRemove)
						ctx.paths.disconnectTiles(ctx, tile.pos, otherTile.pos);
				}
			}
		}
	},
	Fountain: {
		name: "fountain",
		model: "model_Fountain",
		color: Colors3.tileRoad1,
		centerVariance: 0,
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
			}

			// Connect to all adjacent paths
			ctx.paths.connectToAll_Adj4(ctx, tile);
		},
	},

	Tree: {
		name: "tree",
		model: "model_Tree1",
		icon: {
			baseDegZ: -60,
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
		model: "model_Tree2",
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

				ctx.growMeshOnTile(
					tile.models,
					tile,
					ctx.assets.getModel(this.model),
					new color3(this.color),
					centerPos,
					new float3().setScalar(rng.nextF(0.9, 1)),
				);
			}
		},
	},

	Water: { name: "water", color: Colors3.tileWater },
} as const satisfies Record<string, TileType>;
