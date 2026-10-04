import { float2, float3, float4 } from "../utils/threeUtils";
import { P2 } from "./P2";

export class RandomSlice {
	public values: number[];
	private _start = 0;
	private _index = 0;
	private _step = 1;

	constructor(seed: number, length: number) {
		let rand = mulberry32(seed);

		this.values = Array(length);
		for (let i = 0; i < length; ++i)
			this.values[i] = rand();

		function mulberry32(a) {
			return function () {
				let t = a += 0x6D2B79F5;
				t = Math.imul(t ^ t >>> 15, t | 1);
				t ^= t + Math.imul(t ^ t >>> 7, t | 61);
				return ((t ^ t >>> 14) >>> 0) / 4294967296;
			}
		}
	}

	public reset() { this._index = this._start; }

	public next01(): number {
		let value = this.values[this._index]!;

		this._index += this._step;
		if (this._index >= this.values.length)
			this._index %= this.values.length;

		return value;
	}

	public nextF(min: number = 0, max: number = 1): number {
		return min + (max - min) * this.next01();
	}
	public nextRadians(): number {
		return this.next01() * 2 * Math.PI;
	}

	public nextP2() { return new P2(this.next01(), this.next01()); }
	public nextF2() { return new float2(this.next01(), this.next01()); }
	public nextF3() { return new float3(this.next01(), this.next01(), this.next01()); }
	public nextF4() { return new float4(this.next01(), this.next01(), this.next01(), this.next01()); }

	public slice(seed: number);
	public slice(next: number, step: number);
	public slice(next: number, step?: number) {
		const obj = Object.create(RandomSlice.prototype) as RandomSlice;
		obj.values = this.values;
		obj._start = next % this.values.length;
		obj._index = obj._start;
		obj._step = step ?? next;
		if (obj._step == 0)
			obj._step = 1;
		return obj;
	}
}
