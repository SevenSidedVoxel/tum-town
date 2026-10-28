import { Colors3 } from "../styles/colors";
import { getLineTransform } from "../utils/renderUtils";
import { float3, Utils3 } from "../utils/threeUtils";
import { Tiles } from "./_tiles_";
import { Anims, GameAnim } from "./GameAnims";
import { CTX, GameState } from "./GameState";
import { Grid } from "./Grid";
import { P2 } from "./P2";
import { Tile } from "./Tile";
import { ModelCollection } from "./ModelCollection";

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

export class PathSystem {
	private grid: Grid<Path[]>;
	private pathsToRebuild: Path[] = [];

	constructor() {
		this.grid = new Grid<Path[]>(10, null, pos => []);
	}

	public reset(game: GameState) {
		this.grid.cells.forEach(paths => {
			paths.forEach(p => {
				game.addAnim(p.models.destroyAll_anim());
			});
			paths.length = 0;
		});
	}

	public getPaths(pos: P2) {
		return this.grid.get(pos);
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

		if (path != null)
			console.log(`Remove path from ${from.name()} to ${to.name()}`);
		return path ?? null;
	}

	public connectTiles(ctx: CTX, from: P2, to: P2): Path | null {
		let [_, path] = this.findPath(from, to);

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

		if (path) {
			// Reuse old path (after destroying old models)
			// TODO: Consider morphing the path
			ctx.addAnim(path.models
				.destroyAll_anim(0)
				.delayed(Anims.BaseDur * 0.5));
		}
		else {
			// Create a new path
			path = this.addPath(from, to);
		}

		// Update path visuals
		path.startPos.copy(start);
		path.endPos.copy(end);
		path.isUsed = true;
		this.pathsToRebuild.push(path);
		return path;
	}
	public disconnectTiles(ctx: CTX, from: P2, to: P2) {
		let path = this.removePath(from, to);
		if (!path) return;

		path.isUsed = false;
		this.pathsToRebuild.push(path);
	}

	public connectToAll_Adj4(
		ctx: CTX,
		tile: Tile,
		canConnect: (tile: Tile) => boolean = PathSystem.isPathLike
	) {
		tryConnect(+0, -1); // down
		tryConnect(+1, +0); // right
		tryConnect(-1, +0); // left
		tryConnect(+0, +1); // up

		function tryConnect(xOffset, yOffset) {
			const otherTile = ctx.grid.getOffset(tile.pos, xOffset, yOffset);
			if (canConnect(otherTile)) {
				ctx.paths.connectTiles(ctx, tile.pos, otherTile.pos);
			}
			else {
				ctx.paths.disconnectTiles(ctx, tile.pos, otherTile.pos);
			}
		}
	}

	public connectToAny_Adj4(
		ctx: CTX,
		tile: Tile,
		canConnect: (tile: Tile) => boolean = PathSystem.isPathLike
	) {
		const paths = this.getPaths(tile.pos);
		if (paths?.length > 0)
			return; // already connected

		// Check other tiles for potential connections
		if (tryConnect(+0, -1)) return; // down
		if (tryConnect(+1, +0)) return; // right
		if (tryConnect(-1, +0)) return; // left
		if (tryConnect(+0, +1)) return; // up

		function tryConnect(xOffset, yOffset) {
			const otherTile = ctx.grid.getOffset(tile.pos, xOffset, yOffset);
			if (canConnect(otherTile)) {
				ctx.paths.connectTiles(ctx, tile.pos, otherTile.pos);
				return true;
			}

			return false;
		}
	}

	public rotatePath(
		ctx: CTX,
		tile: Tile,
		canConnect: (tile: Tile) => boolean = PathSystem.isPathLike
	) {
		const paths = this.getPaths(tile.pos);
		if (paths?.length != 1)
			return; // can only rotate when there is exactly one path connected

		const path = paths[0]!;

		const oldConnPos = path.getOtherPos(tile.pos);
		const connDir = oldConnPos.clone().subV(tile.pos);
		for (let i = 0; i < 3; ++i) {
			// Rotate the direction
			const { x, y } = connDir;
			connDir.x = y;
			connDir.y = -x;

			// Check if can connect
			const newTile = ctx.grid.getOffset(tile.pos, connDir.x, connDir.y);
			if (canConnect(newTile)) {
				// TODO: Consider morphing the path instead of recreating it
				this.disconnectTiles(ctx, tile.pos, oldConnPos);
				this.connectTiles(ctx, tile.pos, newTile.pos);
				return;
			}
		}
	}


	public disconnectFromAll(ctx: CTX, pos: P2) {
		ctx.addAnim(this.disconnectFromAll_anim(pos));
	}
	public disconnectFromAll_anim(pos: P2, duration: number = Anims.BaseDur) {
		const paths = this.getPaths(pos);
		if (paths.length < 1)
			return null;

		let anims: GameAnim[] = [];
		for (const path of paths) {
			anims.push(path.models.destroyAll_anim(duration));
		}
		paths.length = 0;

		return Anims.combined(anims);
	}

	public removeUnusedPathsAfterRegen(ctx: CTX, pos: P2) {
		const paths = ctx.paths.getPaths(pos);
		for (const path of paths) {
			path.isUsed = false;
		}

		ctx.afterRegenHandlers.push(afterRegen);

		function afterRegen() {
			for (let i = paths.length; i >= 0; --i) {
				const path = paths[i]!;
				if (path.isUsed) continue;

				ctx.game.addAnim(path.models.destroyAll_anim());
				paths.splice(i, 1);
			}
		}
	}

	public regen(ctx: CTX) {
		for (const path of this.pathsToRebuild) {
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

		this.pathsToRebuild.length = 0;
	}

	public getTotalCount(): any {
		let totalpaths = 0;
		for (const cell of this.grid.cells) {
			if (cell)
				totalpaths += cell.length;
		}
		return totalpaths;
	}

	public static addPathLines_anim(
		ctx: CTX,
		tile: Tile,
		path: Path) {
		const start = path.startPos;
		const end = path.endPos;
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
			pathPositions.push([new float3()
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

	public static isPath(tile: Tile) {
		return tile.type == Tiles.Path;
	}

	public static isPathLike(tile: Tile) {
		return tile.type == Tiles.Path
			|| tile.type == Tiles.Fountain;
	}
}
