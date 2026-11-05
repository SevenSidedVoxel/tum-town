import { Vector2 } from "three";

function coordToLetter(n: number): string {
	return String.fromCharCode(64 + n);
}

export class P2 {
	public x: number = 0;
	public y: number = 0;

	constructor(x?: number, y?: number) {
		this.x = x ?? 0;
		this.y = y ?? x ?? 0;
	}

	public clone(): P2 { return new P2(this.x, this.y); }

	public rounded(): P2 { return this.clone().round(); }
	public round(): P2 {
		this.x = Math.round(this.x);
		this.y = Math.round(this.y);
		return this;
	}

	public toString() { return `(${this.x}, ${this.y})`; }
	public name() { return `${coordToLetter(this.x)}${this.y}`; }

	public equals(p: P2) { return p.x == this.x && p.y == this.y; }

	public addS(s: number) {
		this.x += s;
		this.y += s;
		return this;
	}
	public addXY(x: number, y: number) {
		this.x += x;
		this.y += y;
		return this;
	}
	public addV(v: P2) {
		this.x += v.x;
		this.y += v.y;
		return this;
	}
	public addVScaled(v: P2, s: number) {
		this.x += v.x * s;
		this.y += v.y * s;
		return this;
	}

	public subS(s: number) {
		this.x -= s;
		this.y -= s;
		return this;
	}
	public subXY(x: number, y: number) {
		this.x -= x;
		this.y -= y;
		return this;
	}
	public subV(v: P2) {
		this.x -= v.x;
		this.y -= v.y;
		return this;
	}
	public subVScaled(v: P2, s: number) {
		this.x -= v.x * s;
		this.y -= v.y * s;
		return this;
	}

	public mulS(s: number) {
		this.x *= s;
		this.y *= s;
		return this;
	}
	public mulXY(x: number, y: number) {
		this.x *= x;
		this.y *= y;
		return this;
	}
	public mulV(v: P2) {
		this.x *= v.x;
		this.y *= v.y;
		return this;
	}

	public remap(xDir: P2, yDir: P2) {
		let x = this.x;
		let y = this.y;
		this.x = 0;
		this.y = 0;
		this.addVScaled(xDir, x);
		this.addVScaled(yDir, y);
		return this;
	}

	public len2() { return this.x * this.x + this.y * this.y; }
	public len() { return Math.sqrt(this.len2()); }
	public normalize() {
		const len = this.len();
		if (len == 0)
			return;

		const inv = 1.0 / len;
		this.x *= inv;
		this.y *= inv;
	}

	public abs() {
		this.x = Math.abs(this.x);
		this.y = Math.abs(this.y);
		return this;
	}

	public clampXY(
		xMin: number, xMax: number,
		yMin: number, yMax: number
	) {
		this.x = Math.min(xMax, Math.max(xMin, this.x));
		this.y = Math.min(yMax, Math.max(yMin, this.y));
		return this;
	}
}

export function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

export function clamp01(x: number) { return clamp(x, 0, 1); }
export function clamp(x: number, min: number, max: number) {
	return Math.min(max, Math.max(min, x));
}

export const Directions4 = [
	new P2(+1, +0),
	new P2(+0, +1),
	new P2(-1, +0),
	new P2(+0, -1),
];
export const Directions8 = [
	new P2(+1, +0),
	new P2(+1, +1),
	new P2(+0, +1),
	new P2(-1, +1),
	new P2(-1, +0),
	new P2(-1, -1),
	new P2(+0, -1),
	new P2(+1, -1),
];