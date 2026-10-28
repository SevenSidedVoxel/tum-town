import { P2 } from "./P2";
import { Adj4, Adj8 } from "./Rule";

export class Grid<T> {
	public size: number;
	public cells: T[];

	public defaultValue: T | null | undefined;

	constructor(
		size: number,
		defaultValue?: T | null | undefined,
		init?: (pos: P2) => T
	) {
		this.size = size;
		this.defaultValue = defaultValue;
		this.cells = Array(this.size * this.size);

		if (init)
			this.initCells(init);
	}

	public initCells(init: (pos: P2) => T) {
		for (let y = 0; y < this.size; ++y) {
			for (let x = 0; x < this.size; ++x) {
				this.cells[y * this.size + x] = init(new P2(x, y));
			}
		}

		return this;
	}

	public getOffset(pos: P2, x: number, y: number): T {
		return this.get(pos.x + x, pos.y + y);
	}

	public getAdj4(pos: P2): Adj4<T> {
		const uc = this.getOffset(pos, +0, +1);
		const dc = this.getOffset(pos, +0, -1);
		const cl = this.getOffset(pos, -1, +0);
		const cr = this.getOffset(pos, +1, +0);
		return { uc, dc, cl, cr };
	}

	public getAdj8(pos: P2): Adj8<T> {
		const ul = this.getOffset(pos, -1, +1);
		const uc = this.getOffset(pos, +0, +1);
		const ur = this.getOffset(pos, +1, +1);
		const cl = this.getOffset(pos, -1, +0);
		const cr = this.getOffset(pos, +1, +0);
		const dl = this.getOffset(pos, -1, -1);
		const dc = this.getOffset(pos, +0, -1);
		const dr = this.getOffset(pos, +1, -1);
		return { ul, uc, ur, cl, cr, dl, dc, dr };
	}

	public get(pos: P2): T;
	public get(x: number, y: number): T;
	public get(xOrPos: number | P2, y?: number): T {
		if (typeof xOrPos === 'object')
			return this.getInternal(xOrPos.x, xOrPos.y);
		return this.getInternal(xOrPos, y!);
	}
	private getInternal(x: number, y: number): T {
		if (x < 0 || x >= this.size || y < 0 || y >= this.size)
			return this.defaultValue!;
		return this.cells[y * this.size + x]!;
	}
}
