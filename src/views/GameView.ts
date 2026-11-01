import { IView, AppCtx } from "../AppCtx";
import { P2 } from "../game/P2";
import { Frame } from "../game/Frame";
import { GameAnim } from "../game/GameAnims";
import { BuildID, BuildTimestamp, CTX, GameState, dev_ShouldAddDevVisualModels } from "../game/GameState";
import { GameRenderer } from "../game/render/GameRenderer";
import { Tile, TileType } from "../game/Tile";

export class GameView implements IView {
	private ctx: AppCtx;
	private boardElem!: HTMLElement;
	private gameActionsElem!: HTMLElement;
	private gameActionsOptsElem!: HTMLElement;
	private scoreElem!: HTMLElement;
	private nextItemButton!: HTMLElement;

	private game: GameState = new GameState();
	private currItem: TileType | null = null;
	private renderer: GameRenderer = this.game.renderer;

	public constructor(ctx: AppCtx) {
		this.ctx = ctx;
	}

	async enter(ctx: AppCtx): Promise<void> {
		ctx.root.innerHTML = /*html*/`
<div class="game-ctr">
	<div class="game">
		<section id="gameInfo" class="game-panel game-info">
			<span>
				<h2>Tum Town</h2>
				<p class="credit">by SevenSidedVoxel</p>
			</span>
			<span class="game-info-donate">
				<a class="kofi-link" href='https://ko-fi.com/C5L027OU2F' target='_blank'>
					<img style='height:2em;'
						src='https://storage.ko-fi.com/cdn/kofi3.png?v=6'
						alt='Buy Me a Coffee at ko-fi.com' />
				</a>
				<p class="version">${BuildID} - ${BuildTimestamp}</p>
			</span>
		</section>
		
		<section id="gameBoard" class="game-panel game-board">
		</section>
		
		<section id="gameActions" class="game-panel game-actions">
			<div class="game-actions-row">
				<button id="resetGameButton" class="button-icon icon-reset icon-20s"></button>
				<div class="game-actions-spacer"></div>
				<div id="scoreMeter" class="meter-bar"></div>
				<div class="game-actions-spacer"></div>
				<div class="button-icon icon-20s"></div>
				<!--<button id="undoGameButton" class="button-icon icon-reset icon-20s"></button>-->
			</div>
			<div id="gameActionOptions" class="game-actions-row"></div>
			<button id="nextItemButton"></button>
			<div class="game-icons-full-preview"></div>
		</section>
	</div>
</div>
		`;

		this.boardElem = this.getElementOrThrow("#gameBoard");

		// Setup renderer
		await this.renderer.setupAsync(this.boardElem, this.game);
		await this.game.setupRendering();

		// Get required elements
		this.gameActionsElem = this.getElementOrThrow("#gameActions");
		this.gameActionsOptsElem = this.getElementOrThrow("#gameActionOptions");
		this.nextItemButton = this.getElementOrThrow("#nextItemButton");
		this.game.score.meterElem = this.getElementOrThrow("#scoreMeter");

		// Setup Game State
		this.game.setupGame();
		this.selectNextItem();

		// Dev: Add Design Models
		if (dev_ShouldAddDevVisualModels) {
			let ctx = new CTX(this.game);
			ctx.addDevVisualModels();
			ctx.finalize();

			this.playNextAnim();
		}

		// Connect Game Listeners
		this.game.score.updateVisuals();

		// Add button click handlers
		window.addEventListener('pointermove', this.handlePointerMove);
		window.addEventListener('pointerdown', this.handlePointerDown);
		window.addEventListener('pointerup', this.handlePointerUp);
		window.addEventListener('pointercancel', this.handlePointerCancel);
		window.addEventListener('keydown', this.handleKeyPress);

		addClick("#resetGameButton", this.resetGame);
		this.nextItemButton.addEventListener('click', this.selectNextItem);

		// Start Game Loop
		this.loop(0);
		return;

		function addClick(
			query: string,
			handler: EventListenerOrEventListenerObject
		) {
			ctx.root.querySelectorAll(query)
				.forEach(elem => elem.addEventListener('click', handler));
		}
	}

	async exit(ctx): Promise<void> { }

	private prevTimestamp: DOMHighResTimeStamp = 0;
	loop(timestamp: DOMHighResTimeStamp) {
		const rawDelta = timestamp - this.prevTimestamp;
		const safeDelta = Math.min(rawDelta, 0.1);
		this.prevTimestamp = timestamp;
		let frame = new Frame(timestamp, safeDelta);

		try {
			this.updateAnims(safeDelta);
			this.renderer.draw(frame);
		} catch (err) {
			console.error(err);
		}

		requestAnimationFrame(timestamp => this.loop(timestamp));
	}

	resetGame = () => {
		const ctx = new CTX(this.game);
		ctx.resetGame();
		ctx.finalize();
		this.playNextAnim();
	}

	clickTile(pos: P2) {
		// console.log(`clicked ${pos.name()}`);
		const ctx = new CTX(this.game);
		const tile = ctx.game.grid.get(pos);
		if (this.currItem
			&& ctx.canPlaceItem(tile, this.currItem)) {
			ctx.placeItem(tile, this.currItem);
			ctx.finalize();

			this.playNextAnim();
			this.hoverTileEnd();
			return;
		}

		if (ctx.tryInteractTile(tile)) {
			ctx.finalize();
			this.playNextAnim();
			this.hoverTileEnd();
			return;
		}

		// Anims.showInvalidAct(tile.Elem);
	}
	dragTiles(start: P2, end: P2, positions: P2[]) {
		// Try place objects on all dragged
		if (!this.currItem) return; // no item to place

		const ctx = new CTX(this.game);
		const item = this.currItem;

		const tiles: Tile[] = [];
		for (const pos of positions) {
			const tile = ctx.game.grid.get(pos);
			tiles.push(tile);
		}

		ctx.tryPlaceItems(tiles, item);
		ctx.clearPlacementPreview();
		ctx.finalize();
		this.playNextAnim();
		this.hoverTileEnd();
	}
	dragOverTile(pos: P2) {
		if (this.interactTiles.find(p => p.equals(pos)))
			return; // already in set

		const ctx = new CTX(this.game);
		const tile = ctx.grid.get(pos);
		if (ctx.canPlaceItem(tile, this.currItem)) {
			this.interactTiles.push(pos);
			ctx.updatePlacementPreview(this.currItem, this.interactTiles);
		}
		ctx.finalize();
	}

	private hoverPos: P2 | null = null;
	hoverTileStart(pos: P2) {
		this.hoverPos = pos;

		const ctx = new CTX(this.game);
		ctx.updatePlacementPreview(this.currItem, this.hoverPos);
		ctx.finalize();
	}
	hoverTileEnd() {
		this.hoverPos = null;

		const ctx = new CTX(this.game);
		ctx.clearHoverPlacement();
		ctx.finalize();
	}

	selectNextItem = () => {
		if (!this.currItem) {
			// Select the first item
			this.currItem = this.game.items[0]?.type ?? null;
			this.updateItemDisplay();
			return;
		}

		for (let i = 0; i < this.game.items.length; ++i) {
			const item = this.game.items[i];
			if (item!.type == this.currItem) {
				// Currently selecting this item. Move selection to next item
				const nextIndex = (i + 1) % this.game.items.length;
				this.currItem = this.game.items[nextIndex]!.type;
				this.updateItemDisplay();
				return;
			}
		}
	}
	selectItem = (index: number) => {
		const item = this.game.items[index]?.type ?? null;
		if (this.currItem == item)
			this.currItem = null; // deselect item
		else
			this.currItem = item;
		this.updateItemDisplay();
	}

	private updateItemDisplay() {
		// Retrigger hovering to update preview model
		if (this.hoverPos)
			this.hoverTileStart(this.hoverPos);

		this.nextItemButton.textContent = `${this.currItem?.name ?? '---'}`;

		let itemsHtml = /*html*/`<div class="game-act-icons">`;

		const iconCount = 4 - 1;
		for (let i = 0; i < this.game.items.length; ++i) {
			const item = this.game.items[i]!;
			const iconPos = item.icon.iconPos;
			const imgPosX = 100 * (iconPos.x / iconCount);
			const imgPosY = 100 * (iconPos.y / iconCount);

			const selectedClass = item.type == this.currItem ? " game-act-icon-selected" : "";
			itemsHtml += /*html*/`
	<div id="gameAct_${i}" class="game-act-icon${selectedClass}" style="--icon-x-pos: ${imgPosX}%; --icon-y-pos: ${imgPosY}%;"></div>
`;
		}

		itemsHtml +=/*html*/`</div>`;
		this.gameActionsOptsElem.innerHTML = itemsHtml;

		for (let i = 0; i < this.game.items.length; ++i) {
			const elem = this.getElementOrThrow(`#gameAct_${i}`, this.gameActionsOptsElem);
			const index = i;
			elem.addEventListener('pointerdown', () => this.selectItem(index));
		}
	}

	//#region Visual State

	private _applyingAnims = false;
	private _fastApplyAnims = false;
	speedUpAnims() {
		if (this._applyingAnims) {
			this._fastApplyAnims = true;
		}
	}

	private anims: GameAnim[] = [];
	updateAnims(deltaTime: number) {
		if (!this._applyingAnims)
			return;

		if (this._fastApplyAnims)
			deltaTime *= 2;

		for (const anim of this.anims)
			anim.tick(deltaTime);

		for (let i = this.anims.length - 1; i >= 0; --i) {
			const anim = this.anims[i];
			if (!anim?.isDone()) continue;
			if (anim.end) anim.end();
			this.anims.splice(i, 1);
		}
		this.anims = this.anims.filter(anim => !anim.isDone());

		if (this.anims.length < 1)
			this.playNextAnim();
	}
	private playNextAnim() {
		if (this.game.anims.length < 1) {
			// Animations are over
			this._applyingAnims = false;
			this._fastApplyAnims = false;
			return;
		}

		this._applyingAnims = true;
		const anim = this.game.anims.shift()!;
		if (anim.start) anim.start();
		this.anims.push(anim);
	}

	updateScore() {
		this.scoreElem!.innerHTML = `${this.game.score} `;
	}

	//#endregion Visual State

	//#region Input Handlers

	private uiPos: P2 | null = null;
	private worldPos: P2 | null = null;
	private gridPos: P2 | null = null;

	private firstInteractTile: P2 | null = null;
	private interactTiles: P2[] = [];

	private stateDebugAnim: number | undefined;

	handleKeyPress = (e: KeyboardEvent) => {
		switch (e.code) {
			case 'KeyQ':
				this.selectNextItem();
				break;

			case 'KeyT':
				this.game.renderer.debugPrintShaders();
				break;

			case 'Comma':
				if (this.stateDebugAnim) {
					cancelAnimationFrame(this.stateDebugAnim);
					this.stateDebugAnim = undefined;
				}
				else {
					const debugFrame = () => {
						for (const tile of this.game.grid.cells) {
							const centerPos = Tile.calcVisualCenterPos(tile.pos);

							if (tile.shouldCheck)
								this.game.renderer.addFloatingDebugText(
									'*', centerPos.setX(centerPos.x + 0.1), '#086820');

							if (tile.shouldRegen)
								this.game.renderer.addFloatingDebugText(
									'*', centerPos.setX(centerPos.x + 0.1), '#88a01f');
						}

						// Request next frame (if not been cancelled)
						if (this.stateDebugAnim)
							this.stateDebugAnim = requestAnimationFrame(debugFrame);
					};

					this.stateDebugAnim = requestAnimationFrame(debugFrame);
				}
				break;

			default:
				break;
		}
	};

	handlePointerMove = (e) => {
		this.uiPos = new P2(e.clientX, e.clientY);
		this.worldPos = this.renderer.uiToWorld(this.uiPos);
		this.gridPos = this.worldPos?.rounded() ?? null;

		if (this.hoverPos !== this.gridPos) {
			this.hoverTileEnd();
			if (this.gridPos) {
				this.hoverTileStart(this.gridPos);

				if (this.firstInteractTile != null) {
					// Drag in process
					// Ensure the drag is close enough to the middle of the tile to trigger the dragOverTile handler
					const delta = this.worldPos!.subV(this.gridPos);
					const dist = delta.len2();
					const MaxDist = 0.45;
					if (dist <= MaxDist * MaxDist) {
						this.dragOverTile(this.gridPos);
					}
				}
			}
		}
	}

	handlePointerDown = (e) => {
		this.handlePointerMove(e);
		if (!this.gridPos) return;
		this.startPressTile(this.gridPos);
	}

	handlePointerUp = (e) => {
		if (this.gridPos)
			this.endPressTile(this.gridPos);
		else
			this.endInteraction();
	}

	handlePointerCancel = (e) => {
		this.endInteraction();

	}

	startPressTile(coord: P2) {
		this.firstInteractTile = coord;
		this.interactTiles.push(this.firstInteractTile);
	}
	endPressTile(pos: P2) {
		if (this.firstInteractTile === null)
			return; // press was cancelled or moved off tile

		if (!this.firstInteractTile.equals(pos)
			&& this.interactTiles.length == 1) {
			// Dragged off a tile, but didn't drag far enough to add another tile to the group
			this.endInteraction();
			return;
		}
		if (this.interactTiles.length > 1) {
			// this is a drag
			this.dragTiles(this.firstInteractTile, pos, this.interactTiles);
		}
		else
			this.clickTile(pos);

		this.endInteraction();
	}

	endInteraction() {
		this.firstInteractTile = null;
		this.interactTiles.length = 0;
	}

	//#endregion Input Handlers

	private getElementOrThrow(selector: string, root?: HTMLElement): HTMLElement {
		if (!root) root = this.ctx.root;
		const elem = root.querySelector<HTMLElement>(selector);
		if (!elem) throw `Could not find element '${selector}' on '${root.localName}#${root.id}.${root.className}'`;
		return elem;
	}
}
