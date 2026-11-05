import * as THREE from 'three';
import { degToRad } from 'three/src/math/MathUtils.js';
import { P2 } from '../game/P2';

export const color3 = THREE.Color;
export type color3 = THREE.Color;

export const float2 = THREE.Vector2;
export type float2 = THREE.Vector2;
export const float3 = THREE.Vector3;
export type float3 = THREE.Vector3;
export const float4 = THREE.Vector4;
export type float4 = THREE.Vector4;

export const mat4x4 = THREE.Matrix4;
export type mat4x4 = THREE.Matrix4;

export const quat4 = THREE.Quaternion;
export type quat4 = THREE.Quaternion;

export const ZAxis = new float3(0, 0, 1);

declare module 'three' {
	interface Object3D {
		getGeometryByName(name: string): THREE.BufferGeometry | undefined;
	}
}

THREE.Object3D.prototype.getGeometryByName = function (name: string): THREE.BufferGeometry | undefined {
	// Blender removes dots in names before export
	name = name.replaceAll('.', '');

	const target = this.getObjectByName(name);
	if (!target) return undefined;

	if (target instanceof THREE.Mesh)
		return target.geometry;

	// If it's a Group/Object3D, find the first mesh inside it
	target.traverse((child) => {
		if (child instanceof THREE.Mesh) {
			return child.geometry;
		}
	});

	return undefined;
}

export class Utils3 {
	public static rotZDeg(angle: number) { return this.rotZRad(angle * Math.PI / 180); }
	public static rotZRad(angle: number) {
		return new quat4().setFromAxisAngle(ZAxis, angle);
	}

	public static degToDirs(angle: number): [xDir: P2, yDir: P2] {
		const rad = degToRad(angle);
		const s = Math.sin(rad);
		const c = Math.cos(rad);
		return [new P2(c, s), new P2(-s, c)];
	}
}