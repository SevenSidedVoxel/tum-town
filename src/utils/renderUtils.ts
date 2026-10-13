import { float3, mat4x4, quat4, Utils3 } from './threeUtils';

export function getLineMatrix(
	p0: float3,
	p1: float3,
	width: number = 0.1,
	result = new mat4x4()): mat4x4 {
	const dir = new float3().subVectors(p1, p0);
	const dirNorm = dir.clone().normalize();

	// The line model is oriented along the y-dir
	const refVec = Math.abs(dirNorm.y) > 0.99
		? new float3(1, 0, 0) // line is along y-axis, so use x-axis as reference
		: new float3(0, 1, 0);
	const right = new float3()
		.crossVectors(dirNorm, refVec)
		.normalize()
		.multiplyScalar(width);
	const forward = new float3()
		.crossVectors(right, dirNorm);

	return result.set(
		right.x, dir.x * 4, forward.x, p0.x,
		right.y, dir.y * 4, forward.y, p0.y,
		right.z, dir.z * 4, forward.z, p0.z,
		0, 0, 0, 1
	);
}

export class trs3D {
	public pos: float3;
	public rot: quat4;
	public scale: float3;

	constructor(pos?: float3, rot?: quat4, scale?: float3) {
		this.pos = pos ?? new float3();
		this.rot = rot ?? new quat4();
		this.scale = scale ?? new float3(1, 1, 1);
	}
};
export function getLineTransform(
	p0: float3,
	p1: float3,
	width: number = 0.1,
	result: trs3D = new trs3D()): trs3D {
	const dir = new float3().subVectors(p1, p0);
	const len = dir.length();
	const dirNorm = dir.clone().normalize();

	const angleRad = Math.atan2(dirNorm.y, dirNorm.x);

	result.pos.copy(p0);
	result.rot = Utils3.rotZRad(angleRad - Math.PI * 0.5);
	result.scale.set(width, len, 1);
	return result;
}
