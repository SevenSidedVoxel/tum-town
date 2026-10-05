import { BuildID, BuildTimestamp } from "..";
import { IView, AppCtx } from "../AppCtx";
import { P2 } from "../game/P2";
import { Frame } from "../game/Frame";
import { GameAnim } from "../game/GameAnims";
import { GameState } from "../game/GameState";
import { GameRenderer } from "../game/GameRenderer";
import { TileType } from "../game/Tile";

export class GameView implements IView {
	private ctx: AppCtx;
	private boardElem: HTMLElement | null | undefined;
	private actionsElem: HTMLElement | null | undefined;
	private scoreElem: HTMLElement | null | undefined;
	private nextItemButton: HTMLElement | null | undefined;

	private game: GameState = new GameState();
	private selectedItem: TileType | null = null;
	private renderer: GameRenderer = this.game.renderer;

	public constructor(ctx: AppCtx) {
		this.ctx = ctx;
	}

	enter(ctx: AppCtx): void {
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
			<p id="score">Score: <span>0</span></p>
			<button id="nextItemButton"></button>
		</section>
	</div>
</div>
		`;

		this.boardElem = ctx.root.querySelector("#gameBoard");
		if (this.boardElem == null) return;

		// Setup renderer
		this.renderer.setupAsync(this.boardElem, this.game);

		this.actionsElem = ctx.root.querySelector("#gameActions");
		if (this.actionsElem == null) return;

		this.scoreElem = this.actionsElem.querySelector("#score>span");
		if (this.scoreElem == null) return;

		window.addEventListener('pointermove', this.handlePointerMove);
		window.addEventListener('pointerdown', this.handlePointerDown);
		window.addEventListener('pointerup', this.handlePointerUp);
		window.addEventListener('pointercancel', this.handlePointerCancel);
		window.addEventListener('keydown', this.handleKeyPress);

		this.nextItemButton = this.actionsElem.querySelector("#nextItemButton");
		this.nextItemButton?.addEventListener('click', this.selectNextItem);

		this.game.onScoreUpdate = () => this.updateScore();
		this.game.setup();
		this.selectNextItem();

		this.loop(0);
	}

	exit(ctx): void { }

	private prevTimestamp: DOMHighResTimeStamp = 0;
	loop(timestamp: DOMHighResTimeStamp) {
		const rawDelta = timestamp - this.prevTimestamp;
		const safeDelta = Math.min(rawDelta, 0.1);
		this.prevTimestamp = timestamp;
		let frame = new Frame(timestamp, safeDelta);

		this.updateAnims(safeDelta);
		this.renderer.draw(frame);

		requestAnimationFrame(timestamp => this.loop(timestamp));
	}

	clickTile(pos: P2) {
		// console.log(`clicked ${pos.name()}`);
		const tile = this.game.grid.getTile(pos);
		if (!this.selectedItem
			|| !this.game.canPlaceTile(tile, this.selectedItem)) {
			// Anims.showInvalidAct(tile.Elem);
			return;
		}

		this.game.placeTile(tile, this.selectedItem);
		this.playNextAnim();

		this.hoverTileStart(pos);
	}
	dragTile(start: P2, end: P2) {
		// console.log(`drag ${start.name()} to ${end.name()}`);
	}

	private hoverPos: P2 | null = null;
	hoverTileStart(pos: P2) {
		this.hoverPos = pos;
		const tile = this.game.grid.getTile(this.hoverPos);
		const canInteract = this.selectedItem != null
			&& this.game.canPlaceTile(tile, this.selectedItem);
		this.renderer.hoverTile(tile, canInteract);
	}
	hoverTileEnd() {
		this.hoverPos = null;
		this.renderer.hoverTile(null, false);
	}

	selectNextItem = () => {
		if (!this.selectedItem) {
			// Select the first item
			this.selectedItem = this.game.items[0]?.type ?? null;
			this.updateItemDisplay();
			return;
		}

		for (let i = 0; i < this.game.items.length; ++i) {
			const item = this.game.items[i];
			if (item!.type == this.selectedItem) {
				// Currently selecting this item. Move selection to next item
				const nextIndex = (i + 1) % this.game.items.length;
				this.selectedItem = this.game.items[nextIndex]!.type;
				this.updateItemDisplay();
				return;
			}
		}
	}
	private updateItemDisplay() {
		if (!this.nextItemButton) return;
		this.nextItemButton.textContent = `${this.selectedItem?.name ?? 'None'}`;
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
		this.scoreElem!.innerHTML = `${this.game.score}`;
	}

	//#endregion Visual State

	//#region Input Handlers

	private uiPos: P2 | null = null;
	private worldPos: P2 | null = null;
	private gridPos: P2 | null = null;

	private startPressedTile: P2 | null = null;

	private stateDebugAnim: number | undefined;

	handleKeyPress = (e: KeyboardEvent) => {
		switch (e.code) {
			case 'KeyQ':
				this.selectNextItem();
				break;

			case 'Comma':
				if (this.stateDebugAnim) {
					cancelAnimationFrame(this.stateDebugAnim);
					this.stateDebugAnim = undefined;
				}
				else {
					const debugFrame = () => {
						for (const tile of this.game.grid.tiles) {
							const centerPos = tile.getCenterPos();

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
			if (this.gridPos)
				this.hoverTileStart(this.gridPos);
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
			this.startPressedTile = null;
	}

	handlePointerCancel = (e) => {
		this.startPressedTile = null;
	}

	startPressTile(coord: P2) {
		this.startPressedTile = coord;
	}
	endPressTile(pos: P2) {
		if (this.startPressedTile === null)
			return; // press was cancelled or moved off tile

		if (this.startPressedTile.x !== pos.x
			|| this.startPressedTile.y !== pos.y) {
			// this is a drag
			this.dragTile(this.startPressedTile, pos);
		}
		else
			this.clickTile(pos);

		this.startPressedTile = null;
	}

	//#endregion Input Handlers
}