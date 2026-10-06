import { GameState } from "./GameState";
import { Tile, Tiles, TileType } from "./Tile";

export function isTile(pattern: TileType, type: TileType): boolean {
	return pattern === Tiles.Any || pattern === type;
}

export class Match3x3 {
	public ul: TileType = Tiles.Any;
	public uc: TileType = Tiles.Any;
	public ur: TileType = Tiles.Any;
	public cl: TileType = Tiles.Any;
	public cc: TileType = Tiles.Empty;
	public cr: TileType = Tiles.Any;
	public dl: TileType = Tiles.Any;
	public dc: TileType = Tiles.Any;
	public dr: TileType = Tiles.Any;

	constructor(init?: Partial<Match3x3>) {
		Object.assign(this, init);
	}

	public isMatch(area: Area3x3): boolean {
		// The center should be checked already
		return isTile(this.uc, area.uc.type)
			&& isTile(this.cr, area.cr.type)
			&& isTile(this.dc, area.dc.type)
			&& isTile(this.cl, area.cl.type)
			&& isTile(this.ul, area.ul.type)
			&& isTile(this.ur, area.ur.type)
			&& isTile(this.dr, area.dr.type)
			&& isTile(this.dl, area.dl.type);
	}
}

type TileArray3x3 = [Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile, Tile];

export class Area3x3 {
	constructor(
		public ul: Tile, public uc: Tile, public ur: Tile,
		public cl: Tile, public cc: Tile, public cr: Tile,
		public dl: Tile, public dc: Tile, public dr: Tile
	) { }

	public static create(tiles: TileArray3x3) {
		return new Area3x3(...tiles);
	}
}

export class Adj4 {
	constructor(
		public uc: Tile,
		public dc: Tile,
		public cl: Tile,
		public cr: Tile,
	) { }
}

export class Adj8 {
	constructor(
		public ul: Tile, public uc: Tile, public ur: Tile,
		public cl: Tile, public cr: Tile,
		public dl: Tile, public dc: Tile, public dr: Tile
	) { }
}

export enum MatchFlags {
	None = 0x0,

	/** Check against the 0° and 90° rotations */
	Rotate1 = 0x1,

	/** Check against the 0°, 90°, 180° and 270° rotations */
	Rotate4 = 0x2 | Rotate1,
}

export class Rule {
	public name: string;
	public match: Match3x3;
	public matchFlags: MatchFlags;
	public apply: (game: GameState, area: Area3x3) => void;

	constructor(
		name: string,
		match: Partial<Match3x3>,
		apply: (game: GameState, area: Area3x3) => void,
		matchFlags?: MatchFlags
	) {
		this.name = name;
		this.match = new Match3x3(match);
		this.matchFlags = matchFlags ?? MatchFlags.Rotate1;
		this.apply = apply;
	}
}
