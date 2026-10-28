import { Colors3 } from "../styles/colors";
import { color3, float3, quat4, Utils3 } from "../utils/threeUtils";
import { Anims } from "./GameAnims";
import { P2 } from "./P2";
import { Pathing } from "./PathSystem";
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
				const size = rng.nextF(0.5, 0.6);
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
	House2: makeSimpleBuilding("house2", "model_House2", { scale: 0.8, color: Colors3.tileHouse2 }),
	House3: makeSimpleBuilding("house3", "model_House3", { scale: 0.8, color: Colors3.tileHouse3 }),

	Factory1: makeSimpleBuilding("building", "model_Factory1", { scale: 0.8, color: Colors3.tileHouse2 }),
	Sawmill: makeSimpleBuilding("sawmill", "model_Sawmill", { scale: 0.8, rot: -10, color: Colors3.tileHouse2 }),

	Path: {
		name: "path",
		model: "model_LineCap",
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
					pos,
					new float3(size, size, size),
					Utils3.rotZDeg(zDeg),
				);
			}
		}
	},
	Fountain: {
		name: "fountain",
		model: "model_Fountain",
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
			}
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

function makeSimpleBuilding(
	name: string,
	modelName: string,
	draw: {
		scale?: number,
		rot?: number,
		color?: color3
	} = { }) {
	const baseModelScale = draw?.scale ?? 1;
	const baseModelRot = draw?.rot ?? 0;
	const color = draw?.color ?? Colors3.tileHouse1;
	return {
		name: name,
		model: modelName,
		color: color,
		centerVariance: 0,
		pathing: Pathing.ConnectAny_Adj4(),
		interact(ctx, tile) {
			ctx.paths.rotatePath_Adj4(ctx, tile);
		},
		regen(ctx, tile) {
			if (tile.firstTimeBuild()) {
				// Add model
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
			}
		},
	};
}