import { Colors3 } from "../styles/colors";
import { color3, float3, quat4 } from "../utils/threeUtils";
import { GameState } from "./GameState";
import { clamp01, lerp, P2 } from "./P2";
import { BatchedInstance } from "./render/BatchedInstance";

export class Ease {
	public static popIn(t: number) { return 2.5 * t - 1.5 * t * t; }
	public static popOut(t: number) { return 1.6 * t * t - 0.6 * t; }
	public static popInOut(t: number) {
		const l = 1 - clamp01(2 * t - 0.5);
		const a = 3 * t - 2 * t * t;
		const b = 4 * (t * t - t);
		return a + b * l;
	}
}

export class GameAnim {
	private static _nextID = 0;

	public id = GameAnim._nextID++;
	public name: string | undefined;
	public delay: number = 0;
	public time: number = 0;
	public duration: number = Anims.BaseDur;
	public constructor(args: {
		name?: string,
		start?: (this: GameAnim) => void,
		end?: (this: GameAnim) => void,
		update?: (this: GameAnim, deltaTime: number) => void,
		duration: number
	}) {
		this.name = args.name;
		this.start = args.start;
		this.update = args.update;
		this.end = args.end;
		this.duration = args.duration;
	}

	public isDone() { return this.time >= this.duration; }
	public t01() { return Math.max(0, Math.min(1, this.time / this.duration)); }
	public lil(): [l: number, il: number] { const l = this.t01(); return [l, 1 - l]; }

	public delayed(delay: number) {
		this.delay = Math.max(0, this.delay + delay);
		return this;
	}

	public start: (() => void) | undefined;
	public update: ((deltaTime: number) => void) | undefined;
	public end: (() => void) | undefined;

	public skip(): void {
		this.delay = 0;
		this.time = this.duration;
		this.start?.call(this);
		this.end?.call(this);
	}

	public tick(deltaTime: number) {
		if (this.delay > 0) {
			const used = Math.min(this.delay, deltaTime);
			this.delay -= used;
			deltaTime -= used;
			if (this.delay > 0 || deltaTime == 0)
				return;
		}

		this.time += deltaTime;
		this.update?.call(this, deltaTime);
	}
}


export namespace Anims {
	export const BaseDur = 1;

	export function combined(anims: (GameAnim | undefined)[]): GameAnim | undefined {
		anims = anims.filter(a => a);
		if (anims.length < 1)
			return;
		if (anims.length == 1)
			return anims[0];

		// Get the maximum duration
		let duration = 0;
		for (const anim of anims) {
			duration = Math.max(duration, anim!.delay + anim!.duration);
		}

		// Create a useful name
		let name = "[";
		for (let i = 0; i < anims.length; i++) {
			if (i != 0) name += "+";
			name += anims[i]?.name;
		}
		name += "]";

		return new GameAnim({
			name: name,
			duration: duration,
			start: function () {
				anims.forEach(anim => anim?.start?.());
			},
			update: function (dt) {
				for (let i = 0; i < anims.length; ++i) {
					const anim = anims[i];
					if (!anim) continue;

					anim.tick(dt)

					if (anim.isDone()) {
						anims[i] = null!;
					}
				}
			},
			end: function () {
				anims.forEach(anim => anim?.end?.());
			}
		});
	}

	export function growModel(
		model: BatchedInstance,
		targetSize: number,
		duration: number = Anims.BaseDur): GameAnim {
		const initialSize = 0;
		return new GameAnim({
			name: growModel.name,
			duration: duration,
			update: function (dt) {
				const [t, s] = this.lil();
				const p = Ease.popIn(t);
				model.setScale(lerp(initialSize, targetSize, p));
			},
		});
	}
	export function growModelTowards(
		model: BatchedInstance,
		targetPos: float3,
		targetSize: number,
		duration: number = Anims.BaseDur): GameAnim {
		let initPos = new float3();
		let initScale = new float3();
		const targetScale = new float3(targetSize, targetSize, targetSize);

		return new GameAnim({
			name: growModelTowards.name,
			duration: duration,
			start: function () {
				initPos.copy(model.position);
				initScale.copy(model.scale);
			},
			update: function (dt) {
				const [t, s] = this.lil();
				const l = t;

				// Move
				model.position.copy(initPos);
				model.position.lerp(targetPos, l);

				// Grow
				const p = Ease.popIn(t);
				model.scale.copy(initScale);
				model.scale.lerp(targetScale, p);

				// Flush
				model.updateMatrix();
			},
		});
	}
	export function growModelTRS(
		model: BatchedInstance,
		targetPos: float3,
		targetRot: quat4,
		targetScale: float3,
		duration: number = Anims.BaseDur,
		init: {
			pos?: float3,
			rot?: quat4,
			scale?: float3,
		} = {}): GameAnim {
		let initPos = init?.pos ?? new float3();
		let initRot = init?.rot ?? new quat4();
		let initScale = init?.scale ?? new float3();

		return new GameAnim({
			name: growModelTRS.name,
			duration: duration,
			start: function () {
				initPos.copy(model.position);
				initRot.copy(model.rotation);
				initScale.copy(model.scale);
			},
			update: function (dt) {
				const [t, s] = this.lil();
				const l = t;

				model.position.copy(initPos);
				model.position.lerp(targetPos, l);
				model.rotation.copy(initRot);
				model.rotation.slerp(targetRot, l);

				const p = Ease.popIn(t);
				model.scale.copy(initScale);
				model.scale.lerp(targetScale, p);

				// Flush
				model.updateMatrix();
			},
		});
	}

	export function moveModel(
		model: BatchedInstance,
		position: float3,
		duration: number = Anims.BaseDur): GameAnim {
		let initPos = new float3();
		const targetPos = position.clone();
		return new GameAnim({
			name: moveModel.name,
			duration: duration,
			start: function () {
				initPos.copy(model.position);
			},
			update: function (dt) {
				const [t, s] = this.lil();
				const l = Ease.popOut(t);
				model.position.copy(initPos);
				model.position.lerp(targetPos, l);
				model.updateMatrix();
			},
		});
	}

	export function changeColor(
		model: BatchedInstance,
		color: color3,
		duration: number = Anims.BaseDur): GameAnim {
		let initCol = new color3();
		let col = new color3();
		return new GameAnim({
			name: changeColor.name,
			duration: duration,
			start: function () {
				initCol.copy(model.color);
			},
			update: function (dt) {
				const [t, s] = this.lil();
				const l = Ease.popOut(t);
				col.copy(initCol);
				col.lerp(color, l);
				model.setColor(col);
			},
		});
	}

	export function destroyModel(
		model: BatchedInstance,
		duration: number = Anims.BaseDur): GameAnim {
		let initScale = model.scale.clone();
		const targetScale = new float3(0, 0, 0);

		return new GameAnim({
			name: destroyModel.name,
			duration: duration,
			start: function () {
				initScale.copy(model.scale);
			},
			update: function (dt) {
				const [t, s] = this.lil();

				model.scale.copy(initScale);
				model.scale.lerp(targetScale, t);
				model.updateMatrix();
			},
			end: function () {
				model.destroy();
			},
		});
	}
	export function destroyModels(
		models: BatchedInstance[],
		duration: number = Anims.BaseDur
	) {
		if (models.length < 1)
			return null;
		return Anims.combined(models.map(
			m => Anims.destroyModel(m, duration)
		));
	}

	export function mergeModel(
		model: BatchedInstance,
		mergePos: float3,
		duration: number = Anims.BaseDur): GameAnim {
		let initPos = new float3();
		let initScale = new float3();
		const targetPos = mergePos.clone();
		const targetScale = new float3(0, 0, 0);

		return new GameAnim({
			name: mergeModel.name,
			duration: duration,
			start: function () {
				initPos.copy(model.position);
				initScale.copy(model.scale);
			},
			update: function (dt) {
				const [t, s] = this.lil();

				// First 75% of animation merges
				const p = Math.min(1, t * 4.0 / 3.0);
				model.position.copy(initPos);
				model.position.lerp(targetPos, p);

				// Decrease size to zero over duration
				model.scale.copy(initScale);
				model.scale.lerp(targetScale, t);

				// Flush changes
				model.updateMatrix();
			},
			end: function () {
				model.destroy();
			},
		});
	}

	export function addCount(
		game: GameState,
		pos: P2,
		value: number,
		duration: number = 2 * Anims.BaseDur): GameAnim {
		const initialPos = new float3(pos.x, pos.y, 1);
		const model = game.renderer.addModel(
			game.assets.model_LineCap,
			new float3(pos.x, pos.y, 1),
			0,
			Colors3.white);

		return new GameAnim({
			name: addCount.name,
			duration: duration,
			update: function (dt) {
				const [t, s] = this.lil();
				const size = 0.4 * (3 * s * t + t * t);

				model.position.set(
					initialPos.x,
					initialPos.y + 0.5 * t,
					initialPos.z);
				model.scale.set(size, size, size);
				model.updateMatrix();
			},
			end: function () {
				model.destroy();
			},
		});
	}
}