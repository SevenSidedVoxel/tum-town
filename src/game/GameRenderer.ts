import * as THREE from 'three';
import { GLTF, GLTFLoader } from "three/examples/jsm/Addons.js";
import { P2 } from "./P2";

import glbModelsUrl from '../data/models.glb';

import { Frame as Frame } from './Frame';
import { GameState } from './GameState';

import '../utils/domUtils';
import '../utils/threeUtils';
import { Tile, TileDraw } from './Tile';
import { BatchedMesh } from 'three';
import { Colors, Colors3 } from '../styles/colors';
import { color3, float2, float3, float4, mat4x4, quat4 } from "../utils/threeUtils";
import { Anims, GameAnim } from './GameAnims';

class RenderAssets {
	public texPalette: THREE.Texture | undefined;

	public matDefault: THREE.Material | undefined;

	public model_Missing!: number;
	public model_TileBG!: number;
	public model_Hover!: number;
	public model_HoverActive!: number;
	public model_House1!: number;
	public model_House2!: number;
	public model_House3!: number;

	public model_RoadSegment!: number;
	public model_RoadJoin!: number;
	public model_PathStone!: number;
	public model_Intersection1!: number;

	public model_Tree1!: number;
	public model_Tree2!: number;

	loadModels(gltf: GLTF, batch: BatchedMesh) {
		this.model_Missing = batch.addGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5));
		this.model_TileBG = addGeom(this, 'tile_bg');
		this.model_Hover = addGeom(this, 'hover');
		this.model_HoverActive = addGeom(this, 'hover_active');
		this.model_House1 = addGeom(this, 'house.001');
		this.model_House2 = addGeom(this, 'house.002');
		this.model_House3 = addGeom(this, 'house.003');

		this.model_Intersection1 = addGeom(this, 'road.001');
		this.model_RoadSegment = addGeom(this, 'road_segment');
		this.model_RoadJoin = addGeom(this, 'road_join');
		this.model_PathStone = addGeom(this, 'road_stone');

		this.model_Tree1 = addGeom(this, 'tree.001');
		this.model_Tree2 = addGeom(this, 'tree.002');

		function addGeom(self: RenderAssets, name: string) {
			let geom = gltf.scene.getGeometryByName(name);
			if (!geom) {
				console.warn(`Could not find model '${name}'`);
				return self.model_Missing;
			}
			return batch.addGeometry(geom);
		}
	}
}

export class GameRenderer {
	public isReady: boolean = false;

	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(
		10, 1 / 1, 0.1, 1000);
	private camRaycaster = new THREE.Raycaster();
	private renderer = new THREE.WebGLRenderer({
		antialias: true
	});

	private resizeObserver: ResizeObserver | null = null

	public async setupAsync(ctr: HTMLElement, game: GameState) {
		// Set initial size
		const style = window.getComputedStyle(ctr);
		const width = ctr.clientWidth
			- parseFloat(style.paddingLeft)
			- parseFloat(style.paddingRight);
		const height = ctr.clientHeight
			- parseFloat(style.paddingTop)
			- parseFloat(style.paddingBottom);
		this.resize(width, height);

		// Attach resizer and canvas
		this.resizeObserver = new ResizeObserver(entries => {
			const { width, height } = entries[0]!.contentRect;
			this.resize(width, height);
		});
		this.resizeObserver.observe(ctr);
		this.renderer.domElement.style.touchAction = 'none';
		ctr.appendChild(this.renderer.domElement);

		// Load Resources
		await this.loadResourcesAsync();

		// Setup game
		await this.setupForGame(game);

		this.isReady = true;
	}

	public cleanup() {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
	}

	public resize(width: number, height: number) {
		this.renderer.setSize(width, height);
		this.camera.aspect = width / height;
	}

	public assets: RenderAssets = new RenderAssets();
	public drawBatch!: BatchedMesh;

	private async loadResourcesAsync() {
		// Load GLTF Data
		const loader = new GLTFLoader();
		const glbFetch = await fetch(glbModelsUrl);
		const glbBuffer = await glbFetch.arrayBuffer();
		const gltf = await loader.parseAsync(glbBuffer, '');

		// Color Palette
		this.assets.texPalette = await gltf.parser.getDependency('texture', 0);

		// Material
		this.assets.matDefault = new THREE.MeshStandardMaterial({
			map: this.assets.texPalette, // color palette
			// color: 0xFFFFFF, // tint
			roughness: 0.5,
			metalness: 0.1,
		});
		this.assets.matDefault.onBeforeCompile = (shader) => {
			// Add varying: vInstanceColor
			const varyings = /*glsl*/`
varying vec3 vInstanceColor;
varying vec2 vUv;
`;
			shader.vertexShader = varyings + shader.vertexShader;
			shader.fragmentShader = varyings + shader.fragmentShader;

			// Add varying vInstanceColor to vertex shader
			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				/*glsl*/`
#include <begin_vertex>

vUv = uv;
vInstanceColor = vec3(1, 1, 1);
#ifdef USE_INSTANCING_COLOR
	vInstanceColor = instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vInstanceColor = getBatchingColor(getIndirectIndex(gl_DrawID)).rgb;
#endif
`
			);

			// Add varying vInstanceColor to vertex shader
			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <color_fragment>',
				/*glsl*/`
const float InstUVSizeX = 1.0 / 16.0;
const float InstUVSizeY = 15.0 / 16.0; // note the y-axis is flipped
if (vUv.x < InstUVSizeX && vUv.y > InstUVSizeY) {
	// override coloring with instance color
	diffuseColor.rgb = vInstanceColor.rgb;
}
else
{
	// get default coloring
	vec4 sampledDiffuseColor = texture2D(map, vUv);
	diffuseColor = sampledDiffuseColor;
}
`
			);
		};

		// Batched Mesh
		const maxInstances = 1024;
		const maxVertexCount = 10000;
		const maxIndexCount = 20000;

		this.drawBatch = new BatchedMesh(
			maxInstances, maxVertexCount, maxIndexCount,
			this.assets.matDefault);
		this.drawBatch.castShadow = true;
		this.drawBatch.receiveShadow = true;
		this.drawBatch.matrixWorldAutoUpdate = true;

		// Models
		this.assets.loadModels(gltf, this.drawBatch);
	}

	private game: GameState | undefined;

	private gridSize: number = 0;
	private hoverModel!: BatchedInstance;

	public async setupForGame(game: GameState) {
		this.game = game;

		this.gridSize = game.grid.size - 2;

		// Background
		this.scene.background = new color3('#151618');

		// Camera
		{
			const viewCenterX = this.gridSize / 2 + 0.5;
			const viewCenterY = this.gridSize / 2 + 0.5;
			this.camera.position.set(viewCenterX, viewCenterY - this.gridSize, 47);
			this.camera.lookAt(viewCenterX, viewCenterY, 0);
		}

		// Lighting
		{
			this.scene.add(new THREE.AmbientLight(0xFFFFFF, 1));

			const sun = new THREE.DirectionalLight(0xFFFFFF, 1);
			sun.castShadow = true;
			sun.position.set(10, 20, 20);
			sun.shadow.mapSize.width = 2048;
			sun.shadow.mapSize.height = 2048;
			sun.shadow.bias = -0.00001;
			sun.shadow.camera.near = 0.1;
			sun.shadow.camera.far = 100;
			sun.shadow.camera.left = -10;
			sun.shadow.camera.right = 10;
			sun.shadow.camera.top = 10;
			sun.shadow.camera.bottom = -10;

			// enable shadows
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFShadowMap;

			this.scene.add(sun);
		}

		// Grid
		const mat = new THREE.MeshStandardMaterial({
			color: 0xFFFFFF,
			roughness: 0.5,
			metalness: 0.1,
		});
		{
			const matrix = new mat4x4();
			const position = new float3();
			for (let y = 0; y < this.gridSize; ++y) {
				for (let x = 0; x < this.gridSize; ++x) {
					// Initialize the tile
					const tile = game.grid.getTile(x + 1, y + 1);
					const tileInst = this.drawBatch.addInstance(this.assets.model_TileBG);

					const rng = this.game.rng.slice(y * this.gridSize * 13 + x * 7);
					tile.draw = new TileDraw(x, y, tileInst, rng);
					position.copy(tile.draw.centerPos);
					position.z = -0.01;
					matrix.makeTranslation(position);

					this.drawBatch.setMatrixAt(tileInst, matrix);
					this.drawBatch.setColorAt(tileInst, tile.draw.baseColor);

				}
			}
		}

		// Hover Model
		{
			this.hoverModel = this.addModel(
				this.assets.model_Hover,
				new float3(0, 0, 0),
				1,
				Colors3.bad)
				.setName('hover tile');
			this.hoverModel.setVisible(false);
		}

		this.scene.add(this.drawBatch);
	}

	public hoverTile(tile: Tile | null, canInteract: boolean) {
		if (!this.hoverModel)
			return;

		if (!tile?.draw) {
			this.hoverModel.setVisible(false);
			return;
		}

		const pos = tile.pos;
		this.hoverModel.setMesh(canInteract ? this.assets.model_HoverActive : this.assets.model_Hover);
		this.hoverModel.setColor(canInteract ? Colors3.good : Colors3.bad);
		this.hoverModel.setPosition(pos.x, pos.y, 0);
		this.hoverModel.setVisible(true);
	}

	public draw(frame: Frame) {
		if (!this.isReady) return;

		// Trigger ThreeJS rendering
		this.renderer.render(this.scene, this.camera);
	}

	public uiToWorld(uiPos: P2 | null): P2 | null {
		if (uiPos === null)
			return null;

		const canvasRect = this.renderer.domElement.getBoundingClientRect();
		if (!canvasRect.containsP2(uiPos))
			return null;

		this.camRaycaster.setFromCamera(
			new THREE.Vector2(
				((uiPos.x - canvasRect.left) / canvasRect.width) * 2 - 1,
				-((uiPos.y - canvasRect.bottom) / canvasRect.height) * 2 - 1),
			this.camera);

		const p0 = this.camRaycaster.ray.origin;
		const d0 = this.camRaycaster.ray.direction;

		// Solve for t where the ray intersects the XY plane (z == 0)
		//   p0.z + t * d0.z = 0
		const t = -p0.z / d0.z;

		// Calculate the intersection point on the XY plane
		const x = p0.x + t * d0.x;
		const y = p0.y + t * d0.y;
		return new P2(x, y);
	}

	public addFloatingDebugText(message, position, color, duration = 1000) {
		// 1. Create an HTML5 Canvas and draw the text
		const canvas = document.createElement('canvas');
		canvas.width = 256;
		canvas.height = 128;
		const ctx = canvas.getContext('2d')!;

		ctx.fillStyle = color;
		ctx.font = 'bold 32px Arial';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(message, canvas.width / 2, canvas.height / 2);

		// 2. Create a CanvasTexture and a Sprite (automatically faces the camera)
		const texture = new THREE.CanvasTexture(canvas);
		const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
		const sprite = new THREE.Sprite(material);

		sprite.position.copy(position);
		sprite.position.setZ(1);
		sprite.scale.set(1, 0.5, 1); // Adjust world size
		this.scene.add(sprite);

		// 3. Animate upward until cleanup
		const startTime = performance.now();
		const startY = position.y;
		const floatDistance = 0.1; // How far up it floats
		const scene = this.scene;

		function animate() {
			const elapsed = performance.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);

			// Move up and fade
			sprite.position.y = startY + (floatDistance * progress);
			material.opacity = 1 - progress;

			if (progress < 1) {
				requestAnimationFrame(animate);
			} else {
				// Cleanup
				scene.remove(sprite);
				material.dispose();
				texture.dispose();
			}
		}
		animate();
	}

	public addModel(
		modelID: number,
		pos: float3,
		size: number,
		color: color3) {
		const rotation = new quat4();
		const scale = new float3(size, size, size);
		const matrix = new mat4x4()
			.compose(pos, rotation, scale);
		return this.addModel_Mat(modelID, pos, rotation, scale, matrix, color);
	}

	public addModel_Mat(
		modelID: number,
		pos: float3,
		rotation: quat4,
		scale: float3,
		matrix: mat4x4,
		color: color3) {
		const inst = this.drawBatch.addInstance(modelID);
		this.drawBatch.setMatrixAt(inst, matrix);
		this.drawBatch.setColorAt(inst, color);
		return new BatchedInstance(this.drawBatch, inst, pos, rotation, scale);
	}

	public addMeshToTile(
		modelID: number,
		tile: Tile,
		pos: float3,
		color: color3,
	) {
		const position = pos;
		const scale = 0;
		const model = this.addModel(modelID,
			position,
			scale,
			color);

		tile.draw?.models.push(model);
		return model;
	}

	public growMeshOnTile(
		modelID: number,
		tile: Tile,
		color: color3,
		duration: number,
		pos: float3,
		size: number,
	): BatchedInstance;
	public growMeshOnTile(
		modelID: number,
		tile: Tile,
		color: color3,
		duration: number,
		pos: float3,
		scale: float3,
		rot: quat4,
	): BatchedInstance;
	public growMeshOnTile(
		modelID: number,
		tile: Tile,
		color: color3,
		duration: number,
		pos: float3,
		scale: number | float3,
		rot?: quat4,
	): BatchedInstance {
		// Create initial model
		const model = this.addModel(modelID,
			new float3(tile.pos.x, tile.pos.y, 0),
			0,
			color);
		tile.draw?.models.push(model);

		// Animate to target transform
		if (rot !== undefined) {
			// Extract target transform
			this.game!.addAnim(Anims.growModelTRS(
				model, pos, rot, scale as float3, duration
			));
		}
		else {
			this.game?.addAnim(Anims.growModel(
				model, scale as number, duration
			));
		}

		return model;
	}

	public debugPrintShaders() {
		const materialProperties: any = this.renderer.properties.get(this.assets.matDefault);

		if (materialProperties.currentProgram) {
			const gl = this.renderer.getContext();
			const program = materialProperties.currentProgram.program;

			// Get the array of attached shaders (vertex and fragment)
			const attachedShaders: any = gl.getAttachedShaders(program);

			attachedShaders.forEach((shader, index) => {
				const source = gl.getShaderSource(shader);
				const type = gl.getShaderParameter(shader, gl.SHADER_TYPE);

				if (type === gl.VERTEX_SHADER) {
					console.log("--- EXPANDED VERTEX SHADER ---", source);
				} else if (type === gl.FRAGMENT_SHADER) {
					console.log("--- EXPANDED FRAGMENT SHADER ---", source);
				}
			});
		}
	}
}

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

