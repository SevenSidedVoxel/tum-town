import { Colors3 } from "../styles/colors";
import { getLineTransform } from "../utils/renderUtils";
import { float3, Utils3 } from "../utils/threeUtils";
import { Tiles } from "./_tiles_";
import { Anims, GameAnim } from "./GameAnims";
import { CTX, GameState } from "./GameState";
import { Grid } from "./Grid";
import { Directions8, P2 } from "./P2";
import { Tile } from "./Tile";
import { ModelCollection } from "./ModelCollection";
import { Z_PathDepth } from "./render/GameRenderer";

class Path {
	public pA: P2;
	public pB: P2;
	public isUsed: boolean = true;

	public startPos: float3;
	public endPos: float3;
	public models: ModelCollection = new ModelCollection();

	constructor(from: P2, to: P2) {
		this.pA = from;
		this.pB = to;
		this.startPos = new float3(from.x, from.y, 0);
		this.endPos = new float3(to.x, to.y, 0);
	}

	public connects(from: P2, to: P2): boolean {
		return (this.pA == from && this.pB == to)
			|| (this.pB == from && this.pA == to);
	}

	public getOtherPos(pos: P2): P2 {
		return pos == this.pA ? this.pB : this.pA;
	}

	public getDirFrom(pos: P2): P2 {
		const dir = this.pB.clone().subV(this.pA);
		return pos == this.pA ? dir : dir.mulS(-1);
	}
}

enum PathRules {
	None,

	ConnectAll_Adj4,
	ConnectAll_Adj8,

	ConnectAny_Adj4,
	ConnectAny_Adj8,
}

enum PathRestrictions {
	None,
	PreventDiagonals = 0x1,
}

export class Pathing {
	public static Default = new Pathing(PathRules.None);
	public static None() { return new Pathing(PathRules.None); };
	public static ConnectAll_Adj4() { return new Pathing(PathRules.ConnectAll_Adj4); };
	public static ConnectAny_Adj4() { return new Pathing(PathRules.ConnectAny_Adj4); };
	public static ConnectAll_Adj8() { return new Pathing(PathRules.ConnectAll_Adj8); };
	public static ConnectAny_Adj8() { return new Pathing(PathRules.ConnectAny_Adj8); };

	public isSource: boolean = false;
	public connections: PathRules;
	public restrictions: PathRestrictions = PathRestrictions.None;

	constructor(connRules: PathRules) {
		this.connections = connRules;
	}

	public markSource(isSource: boolean = true): this {
		this.isSource = isSource;
		return this;
	}

	public get preventsDiagonals(): boolean { return (this.restrictions & PathRestrictions.PreventDiagonals) != 0; }
	public blockDiagonals(): this {
		this.restrictions |= PathRestrictions.PreventDiagonals;
		return this;
	}
}

class PathCell {
	public paths: Path[] = [];
	public preferredConnIndex: number | null = null;
}

const shouldLog = false;
export class PathSystem {

	private game: GameState;
	private grid: Grid<PathCell>;
	private dirtyPaths: Path[] = [];

	constructor(game: GameState) {
		this.game = game;
		this.grid = new Grid<PathCell>(10, null, pos => new PathCell());
	}

	public reset() {
		this.grid.cells.forEach(cell => {
			cell.paths.forEach(p => {
				this.game.addAnim(p.models.destroyAll_anim());
			});
			cell.paths.length = 0;
		});
	}

	public updatePaths(ctx: CTX, tile: Tile) {
		const pathing = tile.type.pathing ?? Pathing.Default;

		// Apply connection rule
		switch (pathing.connections) {
			case PathRules.None:
				break;
			case PathRules.ConnectAny_Adj4:
				this.connectToAny_Adj4(ctx, tile);
				break;
			case PathRules.ConnectAll_Adj4:
				this.connectToAll_Adj4(ctx, tile);
				break;

			case PathRules.ConnectAny_Adj8:
				this.connectToAny_Adj8(ctx, tile);
				break;
			case PathRules.ConnectAll_Adj8:
				this.connectToAll_Adj8(ctx, tile);
				break;
		}
	}

	public getPaths(pos: P2) {
		return this.grid.get(pos).paths;
	}

	private findPath(from: P2, to: P2): [index: number, path: Path | null] {
		const fromPaths = this.getPaths(from);
		if (!fromPaths) return [-1, null];

		const index = fromPaths.findIndex(p => p.connects(from, to));
		const path = fromPaths[index] ?? null;
		return [index, path];
	}
	private addPath(from: P2, to: P2): Path {
		const [_, existingPath] = this.findPath(from, to);
		if (existingPath) return existingPath;

		const fromPaths = this.getPaths(from);
		const toPaths = this.getPaths(to);
		if (!fromPaths && !toPaths)
			throw "Adding a path between grid cells that are both out of bounds";

		const path = new Path(from, to);
		fromPaths?.push(path);
		toPaths?.push(path);
		if (shouldLog)
			console.log(`Add path from ${from.name()} to ${to.name()}`);
		return path;
	}
	private removePath(from: P2, to: P2): Path | null {
		let path: Path | null | undefined = null;

		const fromPaths = this.getPaths(from);
		if (fromPaths) {
			const fromIndex = fromPaths.findIndex(p => p.connects(from, to));
			if (fromIndex != -1) {
				path = fromPaths[fromIndex];
				fromPaths.splice(fromIndex, 1);
			}
		}

		const toPaths = this.getPaths(to);
		if (toPaths) {
			const toIndex = toPaths.findIndex(p => p.connects(to, from));
			if (toIndex != -1) {
				path = toPaths[toIndex];
				toPaths.splice(toIndex, 1);
			}
		}

		if (shouldLog && path != null)
			console.log(`Remove path from ${from.name()} to ${to.name()}`);
		return path ?? null;
	}
	private restorePath(path: Path): Path {
		const fromPaths = this.getPaths(path.pA);
		const toPaths = this.getPaths(path.pB);
		if (!fromPaths && !toPaths)
			throw "Adding a path between grid cells that are both out of bounds";

		fromPaths?.push(path);
		toPaths?.push(path);
		if (shouldLog)
			console.log(`Restored path from ${path.pA.name()} to ${path.pB.name()}`);

		return path;
	}

	public connectTiles(from: P2, to: P2): Path | null {
		let [_, path] = this.findPath(from, to);

		if (path == null) {
			// Check if there is a path we can recycle
			const index = this.dirtyPaths.findIndex(p => !p.isUsed && p.connects(from, to));
			if (index != -1) {
				path = this.restorePath(this.dirtyPaths[index]!);
				this.dirtyPaths.splice(index, 1);
			}
		}

		// Check if path is already connected as desired
		const start = Tile.calcVisualCenterPos(from);
		const end = Tile.calcVisualCenterPos(to);
		if (path != null
			&& (
				(path.startPos.equals(start) && path.endPos.equals(end))
				|| (path.endPos.equals(start) && path.startPos.equals(end))
			)) {
			path.isUsed = true;
			return path;
		}

		if (!path) {
			// Create a new path
			path = this.addPath(from, to);
		}

		// Update path visuals
		path.startPos.copy(start);
		path.endPos.copy(end);
		path.isUsed = true;
		this.dirtyPaths.push(path);
		return path;
	}
	public disconnectTiles(from: P2, to: P2) {
		let path = this.removePath(from, to);
		if (!path) return;

		path.isUsed = false;
		this.dirtyPaths.push(path);
	}

	public connectToAll_Adj4(
		ctx: CTX,
		tile: Tile,
	) {
		tryConnect(+0, +1); // up
		tryConnect(+0, -1); // down
		tryConnect(-1, +0); // left
		tryConnect(+1, +0); // right

		function tryConnect(xOffset, yOffset) {
			const otherTile = ctx.grid.getOffset(tile.pos, xOffset, yOffset);
			if (PathSystem.canConnect(ctx, tile, otherTile, false)) {
				ctx.paths.connectTiles(tile.pos, otherTile.pos);
			}
			else {
				ctx.paths.disconnectTiles(tile.pos, otherTile.pos);
			}
		}
	}

	public connectToAny_Adj4(
		ctx: CTX,
		tile: Tile,
	) {
		this.quietDisconnectFromAll(tile.pos);

		// Check other tiles for potential connections
		// Ordered to maximize visibility of the path
		if (tryConnect(+0, -1)) return; // down
		if (tryConnect(+1, +0)) return; // right
		if (tryConnect(-1, +0)) return; // left
		if (tryConnect(+0, +1)) return; // up

		function tryConnect(xOffset, yOffset) {
			const otherTile = ctx.grid.getOffset(tile.pos, xOffset, yOffset);
			if (PathSystem.canConnect(ctx, tile, otherTile, false)) {
				ctx.paths.connectTiles(tile.pos, otherTile.pos);
				return true;
			}

			return false;
		}
	}

	public connectToAll_Adj8(
		ctx: CTX,
		tile: Tile,
	) {
		// Connect to adjacent paths in the Up/Left/Right directions
		const adj = ctx.grid.getAdj8(tile.pos);
		const connectU = PathSystem.canConnect(ctx, tile, adj.u, false);
		const connectL = PathSystem.canConnect(ctx, tile, adj.l, false);
		const connectR = PathSystem.canConnect(ctx, tile, adj.r, false);
		const connectD = PathSystem.canConnect(ctx, tile, adj.d, false);

		const blockedU = adj.u.type.pathing?.preventsDiagonals ?? false;
		const blockedL = adj.l.type.pathing?.preventsDiagonals ?? false;
		const blockedR = adj.r.type.pathing?.preventsDiagonals ?? false;
		const blockedD = adj.d.type.pathing?.preventsDiagonals ?? false;

		const connectUL = !blockedU && !blockedL && PathSystem.canConnect(ctx, tile, adj.ul, true);
		const connectUR = !blockedU && !blockedR && PathSystem.canConnect(ctx, tile, adj.ur, true);
		const connectDL = !blockedD && !blockedL && PathSystem.canConnect(ctx, tile, adj.dl, true);
		const connectDR = !blockedD && !blockedR && PathSystem.canConnect(ctx, tile, adj.dr, true);

		updatePath(tile, adj.u, connectU, false);
		updatePath(tile, adj.d, connectD, false);
		updatePath(tile, adj.l, connectL, false);
		updatePath(tile, adj.r, connectR, false);
		updatePath(tile, adj.ul, connectUL, true);
		updatePath(tile, adj.ur, connectUR, true);
		updatePath(tile, adj.dl, connectDL, true);
		updatePath(tile, adj.dr, connectDR, true);

		function updatePath(tile: Tile, otherTile: Tile, shouldConnect: boolean, forceRemove: boolean) {
			if (shouldConnect)
				ctx.paths.connectTiles(tile.pos, otherTile.pos);
			else if (otherTile.type == Tiles.Empty || forceRemove)
				ctx.paths.disconnectTiles(tile.pos, otherTile.pos);
		}
	}

	public connectToAny_Adj8(
		ctx: CTX,
		tile: Tile,
	) {
		this.quietDisconnectFromAll(tile.pos);
		const cell = this.grid.get(tile.pos);

		// Connect to adjacent paths in the Up/Left/Right directions
		const adj = ctx.grid.getAdj8(tile.pos);
		const connectU = PathSystem.canConnect(ctx, tile, adj.u, false);
		const connectL = PathSystem.canConnect(ctx, tile, adj.l, false);
		const connectR = PathSystem.canConnect(ctx, tile, adj.r, false);
		const connectD = PathSystem.canConnect(ctx, tile, adj.d, false);

		const blockedU = adj.u.type.pathing?.preventsDiagonals ?? false;
		const blockedL = adj.l.type.pathing?.preventsDiagonals ?? false;
		const blockedR = adj.r.type.pathing?.preventsDiagonals ?? false;
		const blockedD = adj.d.type.pathing?.preventsDiagonals ?? false;

		const connectUL = !blockedU && !blockedL && PathSystem.canConnect(ctx, tile, adj.ul, true);
		const connectUR = !blockedU && !blockedR && PathSystem.canConnect(ctx, tile, adj.ur, true);
		const connectDL = !blockedD && !blockedL && PathSystem.canConnect(ctx, tile, adj.dl, true);
		const connectDR = !blockedD && !blockedR && PathSystem.canConnect(ctx, tile, adj.dr, true);

		// Check preferred rotation for connection
		if (cell.preferredConnIndex != null) {

			const conns = [connectR, connectUR, connectU, connectUL, connectL, connectDL, connectD, connectDR];
			const canConnect = conns[cell.preferredConnIndex];
			if (canConnect) {
				const adjs = [adj.r, adj.ur, adj.u, adj.ul, adj.l, adj.dl, adj.d, adj.dr];
				const other = adjs[cell.preferredConnIndex]
				if (tryConnect(other, canConnect)) return; // preferred connection was made
			}

			// preferred connection is no longer valid
			cell.preferredConnIndex = null;
		}

		// Check other tiles for potential connections
		// Ordered to maximize visibility of the path
		if (tryConnect(adj.d, connectD)) return;
		if (tryConnect(adj.r, connectR)) return;
		if (tryConnect(adj.l, connectL)) return;
		if (tryConnect(adj.u, connectU)) return;
		if (tryConnect(adj.dr, connectDR)) return;
		if (tryConnect(adj.dl, connectDL)) return;
		if (tryConnect(adj.ul, connectUL)) return;
		if (tryConnect(adj.ur, connectUR)) return;

		function tryConnect(otherTile, shouldConnect) {
			if (shouldConnect) {
				ctx.paths.connectTiles(tile.pos, otherTile.pos);
				return true;
			}

			return false;
		}
	}

	public rotatePath(
		ctx: CTX,
		tile: Tile,

	) {
		const cell = this.grid.get(tile.pos);
		const paths = cell.paths;
		if (paths?.length != 1)
			return; // can only rotate when there is exactly one path connected

		const connRule = tile.type.pathing?.connections ?? PathRules.None;
		if (connRule == PathRules.None)
			return; // tile isn't allowed to connect

		const oldPath = paths[0]!;
		const oldTilePos = oldPath.getOtherPos(tile.pos);
		const oldDir = oldTilePos.clone().subV(tile.pos);

		const connections = Directions8;
		const startIndex = connections.findIndex(d => d.equals(oldDir));

		if (startIndex == -1)
			return; // Current connection is not to an adjacent cell?

		const allowDiagonals = connRule == PathRules.ConnectAny_Adj8 || connRule == PathRules.ConnectAll_Adj8;
		const step = allowDiagonals ? 1 : 2; // 2 skips every other connection (and the connection would have started on an Adj4)
		for (let i = step; i < 8; i += step) {
			const connIndex = (startIndex + i) % connections.length;
			const connDir = connections[connIndex]!;

			// Check if can connect
			const newTile = ctx.grid.getOffset(tile.pos, connDir.x, connDir.y);
			if (PathSystem.canConnect(ctx, tile, newTile, connDir.len2() == 2)) {
				// TODO: Consider morphing the path instead of recreating it
				this.disconnectTiles(tile.pos, oldTilePos);
				this.connectTiles(tile.pos, newTile.pos);
				cell.preferredConnIndex = connIndex;
				return;
			}
		}
	}

	private quietDisconnectFromAll(pos: P2) {
		// Disconnect all paths
		const paths = this.getPaths(pos);
		const pathsToRemove = [...paths];
		for (const path of pathsToRemove) {
			this.disconnectTiles(path.pA, path.pB);
		}
		paths.length = 0;
	}

	public clear(pos: P2) {
		const cell = this.grid.get(pos);

		// Disconnect all paths
		const pathsToRemove = [...cell.paths];
		for (const path of pathsToRemove) {
			this.disconnectTiles(path.pA, path.pB);
		}
		cell.paths.length = 0;

		// Remove pathing preferences
		cell.preferredConnIndex = null;
	}

	// public removeUnusedPathsAfterRegen(ctx: CTX, pos: P2) {
	// 	const paths = ctx.paths.getPaths(pos);
	// 	for (const path of paths) {
	// 		path.isUsed = false;
	// 	}

	// 	ctx.afterRegenHandlers.push(afterRegen);

	// 	function afterRegen() {
	// 		for (let i = paths.length; i >= 0; --i) {
	// 			const path = paths[i]!;
	// 			if (path.isUsed) continue;

	// 			ctx.game.addAnim(path.models.destroyAll_anim());
	// 			paths.splice(i, 1);
	// 		}
	// 	}
	// }

	public regen(ctx: CTX) {
		for (const path of this.dirtyPaths) {
			if (path.isUsed) {
				// Rebuild
				const tile = ctx.grid.get(path.pA);
				ctx.addAnim(PathSystem.addPathLines_anim(ctx, tile, path));
			}
			else {
				// Destroy
				ctx.addAnim(path.models.destroyAll_anim());
			}
		}

		this.dirtyPaths.length = 0;
	}

	public getTotalCount(): any {
		let totalpaths = 0;
		for (const cell of this.grid.cells) {
			if (cell)
				totalpaths += cell.paths.length;
		}
		return totalpaths;
	}

	public static addPathLines_anim(
		ctx: CTX,
		tile: Tile,
		path: Path) {
		const zLevel = Z_PathDepth;
		const start = path.startPos.clone().setZ(zLevel);
		const end = path.endPos.clone().setZ(zLevel);
		const dir = new float3().subVectors(end, start);
		const len = dir.length();
		const para = dir.clone().divideScalar(len);

		const rng = tile.rng(ctx);
		const perp = new float3(-para.y, para.x);

		// Calculate path positions
		let pathPositions: [float3, number][] = [];
		pathPositions.push([start, 0.5]); // path start node

		// Segment of path is longer
		const count = 3;
		const spacing = len / count;
		for (let i = 1; i < count; ++i) {
			const size = rng.nextF(0.4, 0.5);
			pathPositions.push([new float3(0, 0, 0)
				.addScaledVector(para, i * spacing)
				.addScaledVector(perp, (i % 2 ? -1 : +1) * 0.025)
				.add(start),
				size
			]);
		}

		pathPositions.push([end, 0.5]); // path end node

		const animDur = Anims.BaseDur * 0.5;
		ctx.startCombinedAnim();

		// Create path lines
		let [prevPos, prevSize] = pathPositions[0]!;
		let delay = 0.25 * animDur;
		let runningDelay = 0;
		function getDelay() {
			const d = runningDelay;
			runningDelay += delay;
			return d;
		}
		for (let i = 1; i < pathPositions.length; ++i) {
			const [currPos, currSize] = pathPositions[i]!;

			// Add joins
			if (i != 1) {
				ctx.growMeshOnTile(
					path.models,
					tile,
					ctx.assets.model_LineCap,
					Colors3.tileRoad1,
					prevPos,
					new float3(prevSize, prevSize, prevSize),
					Utils3.rotZDeg(rng.nextF(-180, 180)),
					animDur,
					getDelay(),
				);
			}

			// Add segments
			let lineTRS = getLineTransform(prevPos, currPos, currSize);
			ctx.growMeshOnTile(
				path.models,
				tile,
				ctx.assets.model_LineSeg,
				Colors3.tileRoad1,
				lineTRS.pos,
				lineTRS.scale,
				lineTRS.rot,
				animDur,
				getDelay(),
			);

			prevPos = currPos!;
		}

		return ctx.endCombinedAnim();
	}

	public static addPathStones_anim(
		ctx: CTX,
		tile: Tile,
		path: Path) {
		const start = path.startPos;
		const end = path.endPos;
		const dir = new float3().subVectors(start, end);
		const len = dir.length();
		const para = dir.clone().divideScalar(len);

		const rng = tile.rng(ctx);
		const perp = new float3(-para.y, para.x);

		const animDur = Anims.BaseDur * 0.25;
		ctx.startCombinedAnim();

		if (len < 0.1) {
			// Segment of path is relatively short
			const size = rng.nextF(0.4, 0.6);
			ctx.growMeshOnTile(
				path.models,
				tile,
				ctx.assets.model_RoadStone,
				Colors3.tileRoad1,
				new float3()
					.addScaledVector(para, 0.5 * len)
					.add(start),
				new float3(size, size, size),
				Utils3.rotZDeg(rng.nextF(-180, 180)),
				animDur,
			);
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

				ctx.growMeshOnTile(
					path.models,
					tile,
					ctx.assets.model_RoadStone,
					Colors3.tileRoad1,
					pos,
					new float3(size, size, size),
					Utils3.rotZDeg(rng.nextF(-180, 180)),
					animDur,
				);
			}
		}

		return ctx.endCombinedAnim();
	}

	public static canConnect(ctx: CTX, from: Tile, to: Tile, isDiagonal: boolean) {
		if (to.type.pathing?.isSource) {
			// Optimization: connecting to a source
			if (!isDiagonal) return true;

			// Check if the other adjacent tiles prevent the connection
			if (ctx.grid.get(from.pos.x, to.pos.y).type.pathing?.preventsDiagonals) return false;
			if (ctx.grid.get(to.pos.x, from.pos.y).type.pathing?.preventsDiagonals) return false;

			return true;
		}
		if (!from.type.pathing?.isSource) return false; // Neither the to/from tile is a source

		// Check if the destination allows the connection of the desired type
		const toConnRule = to.type.pathing?.connections ?? PathRules.None;
		if (toConnRule == PathRules.ConnectAll_Adj8) {
			// console.log(`[${from.name}] to [${to.name}] true, adj8 all`);
			return true;
		}
		if (toConnRule == PathRules.ConnectAll_Adj4) {
			// console.log(`[${from.name}] to [${to.name}] ${!isDiagonal}, adj4 all`);
			return !isDiagonal;
		}

		const toPaths = ctx.paths.getPaths(to.pos);
		const toConnectCount = toPaths.length;
		if (toConnectCount == 1 && toPaths[0]!.connects(from.pos, to.pos)) {
			// console.log(`[${from.name}] to [${to.name}] true, already connected`);
			return true; // This is the path that already exists
		}
		if (toConnectCount > 0) {
			// console.log(`[${from.name}] to [${to.name}] false, has other connection`);
			return false; // Already connected to another tile
		}

		if (toConnRule == PathRules.ConnectAny_Adj8) {
			// console.log(`[${from.name}] to [${to.name}] true, adj8 any`);
			return true;
		}
		if (toConnRule == PathRules.ConnectAny_Adj4) {
			// console.log(`[${from.name}] to [${to.name}] ${!isDiagonal}, adj4 any`);
			return !isDiagonal;
		}

		// console.log(`[${from.name}] to [${to.name}] false`);
		return false;
	}
}
