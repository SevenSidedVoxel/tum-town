import { Tiles } from "./_tiles_";
import { P2 } from "./P2";
import { Adj4, Adj8 } from "./Rule";
import { Tile, TileType } from "./Tile";

export class Grid {
	public size: number = 10;
	public tiles: Tile[];

	private _emptyTile: Tile = new Tile(new P2(-1, -1), Tiles.Empty);

	constructor() {
		this.tiles = Array(this.size * this.size);
		for (let y = 0; y < this.size; ++y) {
			for (let x = 0; x < this.size; ++x) {
				this.tiles[y * this.size + x] = new Tile(
					new P2(x, y), Tiles.Empty);
			}
		}
	}

	public getTileOffset(pos: P2, x: number, y: number): Tile {
		return this.getTile(pos.x + x, pos.y + y);
	}

	public getAdj4(pos: P2): Adj4 {
		const uc = this.getTileOffset(pos, +0, +1);
		const dc = this.getTileOffset(pos, +0, -1);
		const cl = this.getTileOffset(pos, -1, +0);
		const cr = this.getTileOffset(pos, +1, +0);
		return { uc, dc, cl, cr };
	}

	public getAdj8(pos: P2): Adj8 {
		const ul = this.getTileOffset(pos, -1, +1);
		const uc = this.getTileOffset(pos, +0, +1);
		const ur = this.getTileOffset(pos, +1, +1);
		const cl = this.getTileOffset(pos, -1, +0);
		const cr = this.getTileOffset(pos, +1, +0);
		const dl = this.getTileOffset(pos, -1, -1);
		const dc = this.getTileOffset(pos, +0, -1);
		const dr = this.getTileOffset(pos, +1, -1);
		return { ul, uc, ur, cl, cr, dl, dc, dr };
	}

	public getTile(pos: P2): Tile;
	public getTile(x: number, y: number): Tile;
	public getTile(xOrPos: number | P2, y?: number): Tile {
		if (typeof xOrPos === 'object')
			return this.getTileInternal(xOrPos.x, xOrPos.y);
		return this.getTileInternal(xOrPos, y!);
	}
	private getTileInternal(x: number, y: number): Tile {
		if (x < 0 || x >= this.size || y < 0 || y >= this.size)
			return this._emptyTile;
		return this.tiles[y * this.size + x]!;
	}

	public getTileType(pos: P2): TileType;
	public getTileType(x: number, y: number): TileType;
	public getTileType(xOrPos: number | P2, y?: number): TileType {
		if (typeof xOrPos === 'object')
			return this.getTileInternal(xOrPos.x, xOrPos.y).type;
		return this.getTileInternal(xOrPos, y!).type;
	}

	public isTileEmpty(pos: P2) {
		return this.getTileType(pos) === Tiles.Empty;
	}
}
