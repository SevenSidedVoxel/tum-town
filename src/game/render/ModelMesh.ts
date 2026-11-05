
export class ModelMesh {
	public geometryId: number;
	public flags: ModelMeshFlags;

	constructor(geometryId: number, flags: ModelMeshFlags = ModelMeshFlags.Default) {
		this.geometryId = geometryId;
		this.flags = flags;
	}

	public withFlags(flags: ModelMeshFlags) {
		this.flags = flags;
		return this;
	}
}

export enum ModelMeshFlags {
	None = 0x0,
	HeightWarping = 0x1,
	HeightShading = 0x2,

	Default = HeightWarping | HeightShading,
	NoHeightWarping = HeightShading,
	NoHeightShading = HeightWarping,
}