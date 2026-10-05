import { Colors, Colors3 } from "../styles/colors";
import { color3, float3, quat4 } from "../utils/threeUtils";
import { BatchedInstance } from "./GameRenderer";
import { GameState } from "./GameState";
import { lerp, P2 } from "./P2";

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

	export function combined(anims: (GameAnim | undefined)[]) {
		// Get the maximum duration
		let duration = 0;
		for (const anim of anims) {
			if (!anim) continue;
			duration = Math.max(duration, anim.delay + anim.duration);
		}

		return new GameAnim({
			name: combined.name,
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
				model.setScale(lerp(initialSize, targetSize, t));
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
				model.scale.copy(initScale);
				model.scale.lerp(targetScale, l);

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
		duration: number = Anims.BaseDur): GameAnim {
		let initPos = new float3();
		let initRot = new quat4();
		let initScale = new float3();

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
				model.scale.copy(initScale);
				model.scale.lerp(targetScale, l);

				// Flush
				model.updateMatrix();
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
			game.assets.model_RoadJoin,
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