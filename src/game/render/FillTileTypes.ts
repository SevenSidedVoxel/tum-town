import { CTX } from "../GameState";
import { Tile } from "../Tile";

export enum FillTileTypes {
	Isolated,
	End,
	I,
	L,
	L_Fill,
	T,
	T_FillL,
	T_FillR,
	T_Fill,
	X,
	X_Fill_1,
	X_Fill_Half,
	X_Fill_Oppo,
	X_Fill_3,
	Full
}

export function calcFillTileType(ctx: CTX, tile: Tile, canConnect: (tile: Tile) => boolean): [fill: FillTileTypes, rot: number] {
	const adj = ctx.game.grid.getAdj8(tile.pos);
	return calcFillType(
		canConnect(adj.u),
		canConnect(adj.d),
		canConnect(adj.l),
		canConnect(adj.r),
		canConnect(adj.ul),
		canConnect(adj.ur),
		canConnect(adj.dl),
		canConnect(adj.dr),
	);
}
export function calcFillType(
	isU: boolean,
	isD: boolean,
	isL: boolean,
	isR: boolean,
	isUL: boolean,
	isUR: boolean,
	isDL: boolean,
	isDR: boolean,
): [type: FillTileTypes, rot: number] {
	const count4 = 0
		+ (isU ? 1 : 0)
		+ (isD ? 1 : 0)
		+ (isL ? 1 : 0)
		+ (isR ? 1 : 0);

	// Isolated
	if (count4 == 0) return [FillTileTypes.Isolated, 0];

	// Ends
	if (count4 == 1) {
		if (isR) return [FillTileTypes.End, 0];
		if (isU) return [FillTileTypes.End, 1];
		if (isL) return [FillTileTypes.End, 2];
		return [FillTileTypes.End, 3]; // R
	}

	// I's and L's
	if (count4 == 2) {
		// Check for straight segments
		if (isL && isR) return [FillTileTypes.I, 0];
		if (isU && isD) return [FillTileTypes.I, 1];

		// Water must be an L-bend
		let fill = FillTileTypes.L;
		let rot = 0;

		if (isR) {
			if (isU) {
				rot = 1;
				if (isUR) fill = FillTileTypes.L_Fill;
			}
			else {
				rot = 0;
				if (isDR) fill = FillTileTypes.L_Fill;
			}
		}
		else {
			// water must be on the left here
			if (isU) {
				rot = 2;
				if (isUL) fill = FillTileTypes.L_Fill;
			}
			else {
				rot = 3;
				if (isDL) fill = FillTileTypes.L_Fill;
			}
		}

		return [fill, rot];
	}

	// T's
	if (count4 == 3) {
		let fill = FillTileTypes.T;
		let rot = 0;

		if (!isU) {
			rot = 0;
			if (isDL && isDR) fill = FillTileTypes.T_Fill;
			else if (isDL) fill = FillTileTypes.T_FillL;
			else if (isDR) fill = FillTileTypes.T_FillR;
		}
		else if (!isL) {
			rot = 1;
			if (isDR && isUR) fill = FillTileTypes.T_Fill;
			else if (isDR) fill = FillTileTypes.T_FillL;
			else if (isUR) fill = FillTileTypes.T_FillR;
		}
		else if (!isR) {
			rot = 3;
			if (isUL && isDL) fill = FillTileTypes.T_Fill;
			else if (isUL) fill = FillTileTypes.T_FillL;
			else if (isDL) fill = FillTileTypes.T_FillR;
		}
		else {
			rot = 2;
			if (isUR && isUL) fill = FillTileTypes.T_Fill;
			else if (isUR) fill = FillTileTypes.T_FillL;
			else if (isUL) fill = FillTileTypes.T_FillR;
		}

		return [fill, rot];
	}

	const count4Corner = 0
		+ (isUL ? 1 : 0)
		+ (isUR ? 1 : 0)
		+ (isDL ? 1 : 0)
		+ (isDR ? 1 : 0);

	// Full
	if (count4Corner == 4) return [FillTileTypes.Full, 0];

	// X's
	{
		if (count4Corner == 0)
			return [FillTileTypes.X, 0];

		if (count4Corner == 1) {
			if (isDR) return [FillTileTypes.X_Fill_1, 0];
			if (isUR) return [FillTileTypes.X_Fill_1, 1];
			if (isUL) return [FillTileTypes.X_Fill_1, 2];
			return [FillTileTypes.X_Fill_1, 3];
		}

		if (count4Corner == 2) {
			// Opposites
			if (isDL && isUR) return [FillTileTypes.X_Fill_Oppo, 0];
			if (isDR && isUL) return [FillTileTypes.X_Fill_Oppo, 1];

			// Adjacents
			if (isDL && isDR) return [FillTileTypes.X_Fill_Half, 0];
			if (isDR && isUR) return [FillTileTypes.X_Fill_Half, 1];
			if (isUR && isUL) return [FillTileTypes.X_Fill_Half, 2];
			return [FillTileTypes.X_Fill_Half, 3];
		}

		// count4Corner == 3
		{
			if (!isDR) return [FillTileTypes.X_Fill_3, 0];
			if (!isUR) return [FillTileTypes.X_Fill_3, 1];
			if (!isUL) return [FillTileTypes.X_Fill_3, 2];
			return [FillTileTypes.X_Fill_3, 3];
		}
	}
}