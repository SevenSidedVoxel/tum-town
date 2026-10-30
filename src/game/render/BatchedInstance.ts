import { BatchedMesh } from "three";
import { color3, float3, mat4x4, quat4 } from "../../utils/threeUtils";

export class BatchedInstance {
	private static _nextID = 0;
	public debugId: number = BatchedInstance._nextID++;
	private static _matrix = new mat4x4();

	constructor(
		public batch: BatchedMesh,
		public instId: number,
		public position = new float3(),
		public rotation = new quat4(),
		public scale = new float3(1, 1, 1)) {
	}

	public name: string | undefined;
	setName(name: string): BatchedInstance {
		this.name = name;
		return this;
	}

	setMesh(meshId: number) {
		this.batch.setGeometryIdAt(this.instId, meshId);
		return this;
	}

	setMatrix(matrix: mat4x4) {
		this.batch.setMatrixAt(this.instId, matrix);
		return this;
	}

	setPosition(x: number, y: number);
	setPosition(x: number, y: number, z: number);
	setPosition(x: number, y: number, z?: number) {
		this.position.set(x, y, z ?? 0);
		return this.updateMatrix();
	}

	setRotation(rotRad: number) {
		this.rotation.setFromAxisAngle(new float3(0, 0, 1), rotRad);
		return this.updateMatrix();
	}

	setScale(x: number);
	setScale(x: number, y: number, z: number);
	setScale(x: number, y?: number, z?: number) {
		this.scale.set(x, y ?? x, z ?? x);
		return this.updateMatrix();
	}

	setTRS(
		pos: float3,
		rotRad: number,
		scale: float3
	) {
		this.position.copy(pos);
		this.rotation.setFromAxisAngle(new float3(0, 0, 1), rotRad);
		this.scale.copy(scale);
		return this.updateMatrix();
	}

	updateMatrix() {
		BatchedInstance._matrix.compose(this.position, this.rotation, this.scale);
		this.batch.setMatrixAt(this.instId, BatchedInstance._matrix);
		return this;
	}

	public get color() { return this.batch.getColorAt(this.instId, new color3()); }
	setColor(color: color3) {
		this.batch.setColorAt(this.instId, color);
		return this;
	}

	getMatrix(target = new mat4x4()) {
		return this.batch.getMatrixAt(this.instId, target);
	}

	setVisible(visible: boolean) {
		this.batch.setVisibleAt(this.instId, visible);
		return this;
	}

	destroy() {
		this.batch.deleteInstance(this.instId);
		this.instId = -1;
	}
}

