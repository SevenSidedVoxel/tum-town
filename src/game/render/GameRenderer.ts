import * as THREE from 'three';
import { GLTF, GLTFLoader } from "three/examples/jsm/Addons.js";
import { P2 } from "../P2";

import glbModelsUrl from '../../data/models.glb';

import { Frame as Frame } from '../Frame';
import { GameState } from '../GameState';

import '../../utils/domUtils';
import '../../utils/threeUtils';
import { Tile, TileIcon as IconInfo, TileType } from '../Tile';
import { ModelCollection } from "../ModelCollection";
import { BatchedMesh } from 'three';
import { Colors, Colors3 } from '../../styles/colors';
import { color3, float2, float3, float4, mat4x4, quat4, Utils3, ZAxis } from "../../utils/threeUtils";
import { BatchedInstance } from './BatchedInstance';
import { degToRad } from 'three/src/math/MathUtils.js';

export const dev_ShouldAddVisualDevModels = false;

export const Z_PathDepth = -0.01;
export const Z_TileBG = -0.02;

export class RenderAssets {
	public texPalette: THREE.Texture | undefined;

	public matDefault: THREE.Material | undefined;

	public model_Missing!: number;
	public model_TileBG!: number;
	public model_Hover!: number;
	public model_HoverActive!: number;
	public model_House1!: number;
	public model_House2!: number;
	public model_House3!: number;

	public model_Factory1!: number;
	public model_Sawmill!: number;

	public model_LineSeg!: number;
	public model_LineCap!: number;

	public model_PathGround_Small!: number;
	public model_PathGround_Large!: number;

	public model_RoadStone!: number;
	public model_Fountain!: number;

	public model_Tree1!: number;
	public model_SingleTrees!: number[];

	loadModels(gltf: GLTF, batch: BatchedMesh) {
		this.model_Missing = batch.addGeometry(new THREE.BoxGeometry(0.5, 0.5, 0.5));
		this.model_LineSeg = addGeom(this, 'line_seg');
		this.model_LineCap = addGeom(this, 'line_cap');

		this.model_TileBG = addGeom(this, 'tile_bg');
		this.model_Hover = addGeom(this, 'hover');
		this.model_HoverActive = addGeom(this, 'hover_active');
		this.model_House1 = addGeom(this, 'house.001');
		this.model_House2 = addGeom(this, 'house.002');
		this.model_House3 = addGeom(this, 'house.003');
		this.model_Factory1 = addGeom(this, 'building.002');
		this.model_Sawmill = addGeom(this, 'sawmill');

		this.model_RoadStone = addGeom(this, 'road_stone');
		this.model_PathGround_Small = addGeom(this, 'ground_s');
		this.model_PathGround_Large = addGeom(this, 'ground_l');

		this.model_Fountain = addGeom(this, 'fountain');

		this.model_SingleTrees = [
			addGeom(this, 'tree.001'),
			addGeom(this, 'tree.002'),
			// addGeom(this, 'tree.003'),
		];
		this.model_Tree1 = this.model_SingleTrees[0]!;
		this.model_SingleTrees.push(this.model_Tree1); // make Tree1 more likely

		function addGeom(self: RenderAssets, name: string) {
			let geom = gltf.scene.getGeometryByName(name);
			if (!geom) {
				console.warn(`Could not find model '${name}'`);
				return self.model_Missing;
			}
			return batch.addGeometry(geom);
		}
	}

	public getModel(model: ((assets: RenderAssets) => number) | undefined): number {
		if (!model) return this.model_Missing;
		return model(this) ?? this.model_Missing;
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
		gltf.scene.traverse(child => {
			if (child instanceof THREE.Mesh) {
				child.geometry.scale(0.25, 0.25, 0.25);
				child.geometry.rotateX(degToRad(90));
			}
		})

		// Color Palette
		this.assets.texPalette = await gltf.parser.getDependency('texture', 0);

		// Material
		this.assets.matDefault = new THREE.MeshStandardMaterial({
			map: this.assets.texPalette, // color palette
			// color: 0xFFFFFF, // tint
			roughness: 0.8,
			metalness: 0.01,
		});
		this.assets.matDefault.onBeforeCompile = (shader) => {
			// Add varying: vInstanceColor
			const varyings = /*glsl*/`
varying vec3 vInstanceColor;
varying vec2 vUv;
varying float vWorldPositionZ;
varying float vShouldDepthShade;
`;
			shader.vertexShader = varyings + shader.vertexShader;
			shader.fragmentShader = varyings + shader.fragmentShader;

			// Add varying vInstanceColor to vertex shader
			shader.vertexShader = shader.vertexShader.replace(
				'#include <begin_vertex>',
				`
#include <begin_vertex>

// UV
vUv = uv;

// Instance Color
vInstanceColor = vec3(1, 1, 1);
#ifdef USE_INSTANCING_COLOR
	vInstanceColor = instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vInstanceColor = getBatchingColor(getIndirectIndex(gl_DrawID)).rgb;
#endif
`
			);

			shader.vertexShader = shader.vertexShader.replace(
				`#include <project_vertex>`,
				`
vec4 mvPosition = vec4(transformed, 1.0);
mvPosition.xy *= (vec2(1, 1) + 1.25 * mvPosition.z);

// Apply instancing transforms
#ifdef USE_BATCHING
mvPosition = batchingMatrix * mvPosition;
vShouldDepthShade = batchingMatrix[3][2] >= 0.0 ? 1.0 : 0.0; // This line here?
#endif
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif

mvPosition = modelMatrix * mvPosition;
mvPosition.y += 0.5 * mvPosition.z;
vWorldPositionZ = mvPosition.z;

mvPosition = viewMatrix * mvPosition;

gl_Position = projectionMatrix * mvPosition;
  `
			);

			// Add varying vInstanceColor to vertex shader
			shader.fragmentShader = shader.fragmentShader.replace(
				'#include <color_fragment>',
				`
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

// Darken color near ground
if(vShouldDepthShade > 0.0)
{
	float darken01 = clamp(0.6 + 2.0 * vWorldPositionZ, 0.0, 1.0);
	diffuseColor.rgb *= darken01;
}
`
			);
		};

		// Batched Mesh
		const maxInstances = 2048;
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

		// Icon Rendering
		await this.setupIconRendering();
	}

	//#region Icon Rendering

	private icons = {
		XOffset: -1000,
		FullRenderSize: 1024,
		IconRenderSize: 128,
		IconCount: 8,

		canvas: null! as HTMLCanvasElement,
		ctx: null as CanvasRenderingContext2D | null,

		tmpCanvas: null! as HTMLCanvasElement,
		tmpCtx: null as CanvasRenderingContext2D | null,

		renderTarget: null! as THREE.WebGLRenderTarget,
		scene: null! as THREE.Scene,
		camera: null! as THREE.Camera,
		icons: [] as ModelIcon[],
		freeIcons: [] as P2[],
		modelIcon: null! as BatchedInstance,
		loadingIcon: null! as ModelIcon,

		pixelBuffer: null! as Uint8Array,
		imageData: null! as ImageData,
		imgDataURL: null! as string,
		styleTag: null! as HTMLStyleElement,
	};

	private async setupIconRendering() {
		const size = this.icons.FullRenderSize;
		const iconSize = this.icons.IconRenderSize;

		// Create the canvas
		const canvas = this.icons.canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		this.icons.tmpCanvas = document.createElement('canvas');
		this.icons.tmpCanvas.width = iconSize;
		this.icons.tmpCanvas.height = iconSize;

		// Create the context
		const ctx = this.icons.ctx = canvas.getContext('2d', { alpha: true });
		this.icons.tmpCtx = this.icons.tmpCanvas.getContext('2d', { alpha: true });
		if (ctx == null) return;

		// Create the style tag to hold the resulting image data URL
		this.icons.styleTag = document.createElement('style');
		document.head.appendChild(this.icons.styleTag);

		// Preallocate an image from the context
		// The render target will be copied to this image each frame
		this.icons.pixelBuffer = new Uint8Array(iconSize * iconSize * 4);
		this.icons.imageData = ctx.createImageData(iconSize, iconSize);

		// Create the render target
		const renderTarget = this.icons.renderTarget = new THREE.WebGLRenderTarget(iconSize, iconSize, {
			format: THREE.RGBAFormat,
			type: THREE.UnsignedByteType,
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			colorSpace: THREE.SRGBColorSpace,
		});

		// Camera
		const camera = this.icons.camera = new THREE.PerspectiveCamera(45, 1 / 1, 0.1, 100);
		const offsetX = this.icons.XOffset;
		const centerX = offsetX;
		const centerY = 0;
		camera.position.set(centerX, centerY - 1, 1);
		camera.lookAt(centerX, centerY, 0.25);

		// Create the icon model
		this.icons.modelIcon = this.addModel(
			this.assets.model_Missing,
			new float3(centerX, centerY, 0),
			1,
			Colors3.white);

		// Create the icon reserve
		this.icons.freeIcons.length = 0;
		for (let y = 0; y < 8; ++y) {
			for (let x = 0; x < 8; ++x) {
				this.icons.freeIcons.push(new P2(x, y));
			}
		}

		this.icons.loadingIcon = this.addModelIcon(this.assets.model_Missing, Colors3.white);
	}

	private updateIcons(frame: Frame) { }

	private drawIcons(frame: Frame) {
		const draw = this.renderer;
		const icons = this.icons;
		if (!icons.ctx) return;

		this.updateIcons(frame);

		const iconSize = icons.IconRenderSize;
		const iconRenderCount = icons.IconCount;

		// Render to the offscreen target
		draw.setRenderTarget(icons.renderTarget);
		const prevBack = this.scene.background;
		this.scene.background = null;

		for (const icon of this.icons.icons) {
			if (!icon.updateIcon) continue;
			icon.updateIcon = false;

			const iconCanvasX = this.icons.FullRenderSize * (icon.iconPos.x / iconRenderCount);
			const iconCanvasY = this.icons.FullRenderSize * (icon.iconPos.y / iconRenderCount);

			// Update model
			icons.modelIcon.setMesh(icon.modelID);
			icons.modelIcon.setColor(icon.color);
			icons.modelIcon.rotation.setFromAxisAngle(ZAxis, degToRad(icon.iconInfo?.baseDegZ ?? 0));
			icons.modelIcon.scale.setScalar(icon.iconInfo?.baseSize ?? 1);
			icons.modelIcon.updateMatrix();
			icons.modelIcon.setVisible(true);

			// Clear
			draw.setClearColor(0x000000, 0);
			draw.clear(true, true, true);

			// Render
			icons.camera.updateMatrix();
			draw.render(this.scene, icons.camera);

			// Read the render target into a temp pixel buffer
			draw.readRenderTargetPixels(icons.renderTarget, 0, 0, iconSize, iconSize, icons.pixelBuffer);

			// Draw the imageData to the temp canvas
			icons.imageData.data.set(icons.pixelBuffer);
			icons.tmpCtx!.putImageData(icons.imageData, 0, 0);

			// Draw the temp canvas to the canvas (flipping the y-axis)
			const ctx = icons.ctx;
			ctx.clearRect(iconCanvasX, iconCanvasY, iconSize, iconSize);
			ctx.save();
			ctx.translate(iconCanvasX, iconCanvasY + iconSize);
			ctx.scale(1, -1);
			ctx.drawImage(icons.tmpCanvas, 0, 0);
			ctx.restore();
		}

		// Restore render
		draw.setRenderTarget(null); // Reset back to main canvas/screen
		this.scene.background = prevBack;
		icons.modelIcon.setVisible(false);

		// Convert the canvas into a data URL
		const dataUrl = icons.canvas.toDataURL('image/png');
		this.icons.styleTag.textContent = `:root { --img-game-icons: url(${dataUrl}); --img-game-icons-full-scale: ${iconRenderCount * 100}%; }`;
	}

	public addModelIcon(modelID: number, color: color3, iconInfo: IconInfo | undefined = undefined) {
		if (this.icons.freeIcons.length < 1)
			return this.icons.loadingIcon; // no more free icons

		const iconPos = this.icons.freeIcons.pop()!;
		const icon = new ModelIcon(iconPos, modelID, color, iconInfo);
		this.icons.icons.push(icon);

		return icon;
	}

	public freeIcon(icon: ModelIcon) {
		this.icons.freeIcons.push(icon.iconPos);
	}

	//#endregion Icon Rendering

	private game: GameState | undefined;

	private gridSize: number = 0;
	private hoverSelectorModel!: BatchedInstance;
	private hoverPreviewModel!: BatchedInstance;

	private ambientLight!: THREE.AmbientLight;

	public async setupForGame(game: GameState) {
		this.game = game;

		this.gridSize = game.grid.size - 2;

		// Camera
		{
			const viewCenterX = this.gridSize / 2 + 0.5;
			const viewCenterY = this.gridSize / 2 + 0.5;
			this.camera.position.set(viewCenterX, viewCenterY - this.gridSize, 47);
			this.camera.lookAt(viewCenterX, viewCenterY, 0);
		}

		// Lighting
		{
			this.ambientLight = new THREE.AmbientLight(0xFFFFFF, 2);
			this.scene.add(this.ambientLight);

			const sun = new THREE.DirectionalLight(0xefcdc7, 2);
			sun.castShadow = true;
			sun.position.set(10, 20, 20);
			sun.target.position.set(0, 0, 0);
			sun.shadow.mapSize.width = 2048;
			sun.shadow.mapSize.height = 2048;
			sun.shadow.bias = 0.00013;
			sun.shadow.camera.near = 1;
			sun.shadow.camera.far = 100;
			sun.shadow.camera.left = -10;
			sun.shadow.camera.right = 10;
			sun.shadow.camera.top = 10;
			sun.shadow.camera.bottom = -10;
			sun.shadow.radius = 2;

			// enable shadows
			this.renderer.shadowMap.enabled = true;
			this.renderer.shadowMap.type = THREE.PCFShadowMap;

			this.scene.add(sun);
		}

		// Grid
		{
			// Initialize tile backgrounds
			for (let y = 0; y < this.gridSize; ++y) {
				for (let x = 0; x < this.gridSize; ++x) {
					const tile = game.grid.get(x + 1, y + 1);
					tile.tileBGInst = this.addModel(
						this.assets.model_TileBG,
						new float3(tile.pos.x, tile.pos.y, Z_TileBG),
						1,
						Tile.getTileBaseColor(tile.pos)
					);

					tile.shouldDraw = true;
				}
			}
		}

		// Hover Model
		{
			this.hoverSelectorModel = this.addModel(
				this.assets.model_Hover,
				new float3(0, 0, 0),
				1,
				Colors3.bad)
				.setName('hover selector');
			this.hoverSelectorModel.setVisible(false);

			this.hoverPreviewModel = this.addModel(
				this.assets.model_Hover,
				new float3(0, 0, 0),
				1,
				Colors3.white)
				.setName('hover preview');
			this.hoverPreviewModel.setVisible(false);
		}

		this.scene.add(this.drawBatch);
	}

	public hoverTile(tile: Tile | null,
		canInteract: boolean,
		potentialTile: TileType | null) {
		if (!this.hoverSelectorModel)
			return;

		if (!tile || !tile.shouldDraw) {
			this.hoverSelectorModel.setVisible(false);
			this.hoverPreviewModel?.setVisible(false);
			return;
		}

		const pos = tile.pos;
		this.hoverSelectorModel.setMesh(canInteract ? this.assets.model_HoverActive : this.assets.model_Hover);
		this.hoverSelectorModel.setColor(canInteract ? Colors3.good : Colors3.bad);
		this.hoverSelectorModel.setPosition(pos.x, pos.y, 0);
		this.hoverSelectorModel.setVisible(true);

		if (canInteract
			&& potentialTile?.model
			&& this.hoverPreviewModel) {
			this.hoverPreviewModel.setMesh(this.assets.getModel(potentialTile.model));
			this.hoverPreviewModel.setColor(Colors3.tilePreview);
			this.hoverPreviewModel.setPosition(pos.x, pos.y, 0);
			this.hoverPreviewModel.setScale(0.5, 0.5, 0.5);
			this.hoverPreviewModel.setVisible(true);
		}
		else {
			this.hoverPreviewModel?.setVisible(false);
		}
	}

	public draw(frame: Frame) {
		if (!this.isReady) return;

		const draw = this.renderer;

		// Draw Game
		draw.setRenderTarget(null);
		draw.setClearColor(0x151618, 1);
		draw.render(this.scene, this.camera);

		// Draw Icons
		this.drawIcons(frame);
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
		color: color3,
		collection: ModelCollection | null = null) {
		const rotation = new quat4();
		const scale = new float3(size, size, size);
		const matrix = new mat4x4()
			.compose(pos, rotation, scale);
		return this.addModel_Mat(modelID, pos, rotation, scale, matrix, color, collection);
	}

	public addModel_Mat(
		modelID: number,
		pos: float3,
		rotation: quat4,
		scale: float3,
		matrix: mat4x4,
		color: color3,
		collection: ModelCollection | null = null) {
		const inst = this.drawBatch.addInstance(modelID);
		this.drawBatch.setMatrixAt(inst, matrix);
		this.drawBatch.setColorAt(inst, color);
		const model = new BatchedInstance(this.drawBatch, inst, pos, rotation, scale);
		collection?.addModel(model);
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

export class ModelIcon {
	public iconPos: P2;
	public modelID: number;
	public color: color3;
	public iconInfo: IconInfo | undefined;
	public updateIcon: boolean = true;

	constructor(iconPos: P2, modelID: number, color: color3, iconInfo: IconInfo | undefined) {
		this.iconPos = iconPos;
		this.modelID = modelID;
		this.color = color;
		this.iconInfo = iconInfo;
	}
}