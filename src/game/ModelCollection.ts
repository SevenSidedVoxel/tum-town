import { Anims, GameAnim } from "./GameAnims";
import { BatchedInstance } from "./render/GameRenderer";


export class ModelCollection implements Iterable<BatchedInstance> {
	public models: BatchedInstance[] = [];

	public addModel(model: BatchedInstance) {
		this.models.push(model);
	}

	public reset() {
		this.models.length = 0;
	}

	public get length(): number { return this.models.length; }
	*[Symbol.iterator](): Generator<BatchedInstance, void, unknown> {
		for (const item of this.models) {
			yield item;
		}
	}

	destroyAll_anim(duration: number = Anims.BaseDur): GameAnim {
		const anim = Anims.destroyModels(this.models, duration);
		this.reset();
		return anim;
	}
}
