import { CTX } from "./GameState";
import { Tile, TileType } from "./Tile";
import { Tiles } from "./_tiles_";

export function isTile(pattern: TileType, type: TileType): boolean {
	return pattern === Tiles.Any || pattern === type;
}

export class Match3x3 {
	public ul: TileType = Tiles.Any;
	public u: TileType = Tiles.Any;
	public ur: TileType = Tiles.Any;
	public l: TileType = Tiles.Any;
	public c: TileType = Tiles.Empty;
	public r: TileType = Tiles.Any;
	public dl: TileType = Tiles.Any;
	public d: TileType = Tiles.Any;
	public dr: TileType = Tiles.Any;

	constructor(init?: Partial<Match3x3>) {
		Object.assign(this, init);
	}

	public isMatch(area: Area3x3): boolean {
		// The center should be checked already
		return isTile(this.u, area.u.type)
			&& isTile(this.r, area.r.type)
			&& isTile(this.d, area.d.type)
			&& isTile(this.l, area.l.type)
			&& isTile(this.ul, area.ul.type)
			&& isTile(this.ur, area.ur.type)
			&& isTile(this.dr, area.dr.type)
			&& isTile(this.dl, area.dl.type);
	}
}

type TileArray3x3 = [Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile];

export class Area3x3 {
	constructor(
		public ul: Tile, public u: Tile, public ur: Tile,
		public l: Tile, public c: Tile, public r: Tile,
		public dl: Tile, public d: Tile, public dr: Tile
	) { }

	public static create(tiles: TileArray3x3) {
		return new Area3x3(...tiles);
	}

	*[Symbol.iterator](): Generator<Tile, void, unknown> {
		yield this.ul;
		yield this.u;
		yield this.ur;
		yield this.l;
		yield this.c;
		yield this.r;
		yield this.dl;
		yield this.d;
		yield this.dr;
	}
}

export class Adj4<T> {
	constructor(
		public u: T,
		public d: T,
		public l: T,
		public r: T,
	) { }
}

export class Adj8<T> {
	constructor(
		public ul: T, public u: T, public ur: T,
		public l: T, public r: T,
		public dl: T, public d: T, public dr: T
	) { }
}

export enum RuleRotations {
	None = 0x0,

	/** Check against the 0° and 90° rotations */
	Rotate1 = 0x1,

	/** Check against the 0°, 90°, 180° and 270° rotations */
	Rotate4 = 0x2 | Rotate1,
}

export class Rule {
	public name: string;
	public priority: number = 1;
	public rotations: RuleRotations;
	public centerTile: TileType;
	public testMatch: (ctx: CTX, area: Area3x3, rot: number) => boolean;
	public apply: (ctx: CTX, area: Area3x3, rot: number) => void;

	constructor(
		name: string,
		rotations: RuleRotations = RuleRotations.None,
		centerTile: TileType,
		testMatch: (ctx: CTX, area: Area3x3, rot: number) => boolean,
		apply: (ctx: CTX, area: Area3x3, rot: number) => void) {
		this.name = name;
		this.rotations = rotations;
		this.centerTile = centerTile;
		this.testMatch = testMatch;
		this.apply = apply;
	}
}

export function makeRule(
	name: string,
	rotations: RuleRotations = RuleRotations.None,
	centerTile: TileType,
	testMatch: (ctx: CTX, area: Area3x3, rot: number) => boolean,
	apply: (ctx: CTX, area: Area3x3, rot: number) => void) {
	return new Rule(
		name,
		rotations,
		centerTile,
		testMatch,
		apply
	);
}

export function makeRule_Match(
	name: string,
	rotations: RuleRotations = RuleRotations.None,
	areaMatch: Partial<Match3x3>,
	apply: (ctx: CTX, area: Area3x3, rot: number) => void) {
	const match3 = new Match3x3(areaMatch);
	return new Rule(
		name,
		rotations,
		match3.c,
		(ctx, area, rot) => match3.isMatch(area),
		apply
	);
}
