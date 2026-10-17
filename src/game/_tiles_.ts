import { Colors } from "../styles/colors";
import { color3, float3, quat4, Utils3 } from "../utils/threeUtils";
import { Anims } from "./GameAnims";
import { P2 } from "./P2";
import { connectPathToAdj, isPath, Tile, buildPath_Stones, TileType, buildPath_Lines, rotatePathConnection } from "./Tile";

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
		model: "model_House1",
		color: Colors.tileHouse1,
		centerOffset: 0.025,
		place(game, tile) {
			game.addScore(tile, 1);
			game.replaceTile(tile, this);
		},
		interact(game, tile) {
			rotatePathConnection(game, tile);
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
					game.assets.getModel(this.model),
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
		model: "model_House2",
		color: Colors.tileHouse2,
		centerOffset: 0.005,
		interact(game, tile) {
			rotatePathConnection(game, tile);
		},
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
			const size = rng.nextF(0.7, 0.8);

			// Connect to adjacent path
			connectPathToAdj(game, tile);

			if (tile.draw.firstTimeBuild()) {
				// Add model
				game.renderer.growMeshOnTile(
					game.assets.getModel(this.model),
					tile,
					new color3(this.color),
					Anims.BaseDur,
					centerPos,
					new float3(size, size, size),
					Utils3.rotZDeg(tile.rot ?? 0)
				);
			}

			game.endAndAddCombinedAnim();
		}
	},
	House3: {
		name: "house3",
		model: "model_House3",
		color: Colors.tileHouse3,
		interact(game, tile) {
			rotatePathConnection(game, tile);
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
			const size = rng.nextF(0.7, 0.8);

			// Connect to adjacent path
			connectPathToAdj(game, tile);

			if (tile.draw.firstTimeBuild()) {
				// Add model
				game.renderer.growMeshOnTile(
					game.assets.getModel(this.model),
					tile,
					new color3(this.color),
					Anims.BaseDur,
					centerPos,
					new float3(size, size, size),
					Utils3.rotZDeg(tile.rot ?? 0)
				);
			}

			game.endAndAddCombinedAnim();
		}
	},

	Path: {
		name: "path",
		model: "model_LineCap",
		color: Colors.tileRoad1,
		centerOffset: 0,
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

			const connectionHash = (connectU ? 0x1 : 0) +
				(connectR ? 0x2 : 0) +
				(connectUR ? 0x4 : 0) +
				(connectUL ? 0x8 : 0);

			if (tile.draw.drawCache["connectionHash"] == connectionHash)
				return; // Already connected as desired
			tile.draw.drawCache["connectionHash"] = connectionHash;

			// Destroy all the old models (delayed till after creating the new models)
			tile.draw.animDestroyAllModels(game, Anims.BaseDur * 0.5);

			// Add center stone
			const size = rng.nextF(0.5, 0.6);
			const model = game.renderer.growMeshOnTile(
				game.assets.getModel(this.model),
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

				buildPath_Lines(game, tile, centerPos, targetPos);
			}
		}
	},
	Bridge: { name: "bridge", color: Colors.tileBridge },
	Fountain: {
		name: "fountain",
		model: "model_Fountain",
		color: Colors.tileRoad1,
		centerOffset: 0,
		animCreate(game, tile) {
			if (!tile.draw) return;

			const rng = tile.draw.rng;
			rng.reset();
			const centerPos = tile.draw.recalcCenterPos(tile.pos, this.centerOffset);

			if (!tile.draw.firstTimeBuild())
				return;

			game.startCombinedAnim();
			game.renderer.growMeshOnTile(
				game.assets.getModel(this.model),
				tile,
				new color3(this.color),
				Anims.BaseDur,
				centerPos,
				new float3().setScalar(1),
				new quat4(),
			);
			game.endAndAddCombinedAnim();
		},
	},

	Tree: {
		name: "tree",
		model: "model_Tree1",
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

			const model = rng.choose(game.assets.model_SingleTrees);

			tile.draw.centerPos = centerPos;
			game.startCombinedAnim();
			game.renderer.growMeshOnTile(
				model,
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
		model: "model_Tree2",
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
				game.assets.getModel(this.model),
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
