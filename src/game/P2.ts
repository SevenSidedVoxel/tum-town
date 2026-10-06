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

	public addXY(x: number, y: number) {
		this.x += x;
		this.y += y;
	}

	public mulS(s: number) {
		this.x *= s;
		this.y *= s;
	}
	public mulXY(x: number, y: number) {
		this.x *= x;
		this.y *= y;
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

	public clampXY(
		xMin: number, xMax: number,
		yMin: number, yMax: number
	) {
		this.x = Math.min(xMax, Math.max(xMin, this.x));
		this.y = Math.min(yMax, Math.max(yMin, this.y));
	}
}

export function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

