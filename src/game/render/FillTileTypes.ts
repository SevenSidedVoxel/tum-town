import { CTX } from "../GameState";
import { Tile } from "../Tile";
import { ModelMesh } from "./ModelMesh";

export enum ConnectTiles {
	Isolated,
	End,
	I,
	L,
	T,
	X,
	L_Fill,
	T_FillL,
	T_FillR,
	T_Fill,
	X_Fill_1,
	X_Fill_Half,
	X_Fill_Oppo,
	X_Fill_3,
	Full
}

export function pickConnectModel_Adj4(connect: ConnectTiles, models: ModelMesh[]) {
	switch (connect) {
		case ConnectTiles.Isolated: return models[0] ?? null;
		case ConnectTiles.End: return models[1] ?? null;
		case ConnectTiles.I: return models[2] ?? null;
		case ConnectTiles.L: return models[3] ?? null;
		case ConnectTiles.T: return models[4] ?? null;
		case ConnectTiles.X:
		default: return null;
	}
}

export function calcConnectTile_Adj4(ctx: CTX, tile: Tile, canConnect: (tile: Tile) => boolean): [fill: ConnectTiles, rot: number] {
	const adj = ctx.game.grid.getAdj4(tile.pos);
	return calcConnectTile(
		canConnect(adj.u),
		canConnect(adj.d),
		canConnect(adj.l),
		canConnect(adj.r),
		false,
		false,
		false,
		false,
	);
}

export function calcConnectTile_Adj8(ctx: CTX, tile: Tile, canConnect: (tile: Tile) => boolean): [fill: ConnectTiles, rot: number] {
	const adj = ctx.game.grid.getAdj8(tile.pos);
	return calcConnectTile(
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
export function calcConnectTile(
	isU: boolean,
	isD: boolean,
	isL: boolean,
	isR: boolean,
	isUL: boolean,
	isUR: boolean,
	isDL: boolean,
	isDR: boolean,
): [type: ConnectTiles, rot: number] {
	const count4 = 0
		+ (isU ? 1 : 0)
		+ (isD ? 1 : 0)
		+ (isL ? 1 : 0)
		+ (isR ? 1 : 0);

	// Isolated
	if (count4 == 0) return [ConnectTiles.Isolated, 0];

	// Ends
	if (count4 == 1) {
		if (isR) return [ConnectTiles.End, 0];
		if (isU) return [ConnectTiles.End, 1];
		if (isL) return [ConnectTiles.End, 2];
		return [ConnectTiles.End, 3]; // R
	}

	// I's and L's
	if (count4 == 2) {
		// Check for straight segments
		if (isL && isR) return [ConnectTiles.I, 0];
		if (isU && isD) return [ConnectTiles.I, 1];

		// Water must be an L-bend
		let fill = ConnectTiles.L;
		let rot = 0;

		if (isR) {
			if (isU) {
				rot = 1;
				if (isUR) fill = ConnectTiles.L_Fill;
			}
			else {
				rot = 0;
				if (isDR) fill = ConnectTiles.L_Fill;
			}
		}
		else {
			// water must be on the left here
			if (isU) {
				rot = 2;
				if (isUL) fill = ConnectTiles.L_Fill;
			}
			else {
				rot = 3;
				if (isDL) fill = ConnectTiles.L_Fill;
			}
		}

		return [fill, rot];
	}

	// T's
	if (count4 == 3) {
		let fill = ConnectTiles.T;
		let rot = 0;

		if (!isU) {
			rot = 0;
			if (isDL && isDR) fill = ConnectTiles.T_Fill;
			else if (isDL) fill = ConnectTiles.T_FillL;
			else if (isDR) fill = ConnectTiles.T_FillR;
		}
		else if (!isL) {
			rot = 1;
			if (isDR && isUR) fill = ConnectTiles.T_Fill;
			else if (isDR) fill = ConnectTiles.T_FillL;
			else if (isUR) fill = ConnectTiles.T_FillR;
		}
		else if (!isR) {
			rot = 3;
			if (isUL && isDL) fill = ConnectTiles.T_Fill;
			else if (isUL) fill = ConnectTiles.T_FillL;
			else if (isDL) fill = ConnectTiles.T_FillR;
		}
		else {
			rot = 2;
			if (isUR && isUL) fill = ConnectTiles.T_Fill;
			else if (isUR) fill = ConnectTiles.T_FillL;
			else if (isUL) fill = ConnectTiles.T_FillR;
		}

		return [fill, rot];
	}

	const count4Corner = 0
		+ (isUL ? 1 : 0)
		+ (isUR ? 1 : 0)
		+ (isDL ? 1 : 0)
		+ (isDR ? 1 : 0);

	// Full
	if (count4Corner == 4) return [ConnectTiles.Full, 0];

	// X's
	{
		if (count4Corner == 0)
			return [ConnectTiles.X, 0];

		if (count4Corner == 1) {
			if (isDR) return [ConnectTiles.X_Fill_1, 0];
			if (isUR) return [ConnectTiles.X_Fill_1, 1];
			if (isUL) return [ConnectTiles.X_Fill_1, 2];
			return [ConnectTiles.X_Fill_1, 3];
		}

		if (count4Corner == 2) {
			// Opposites
			if (isDL && isUR) return [ConnectTiles.X_Fill_Oppo, 0];
			if (isDR && isUL) return [ConnectTiles.X_Fill_Oppo, 1];

			// Adjacents
			if (isDL && isDR) return [ConnectTiles.X_Fill_Half, 0];
			if (isDR && isUR) return [ConnectTiles.X_Fill_Half, 1];
			if (isUR && isUL) return [ConnectTiles.X_Fill_Half, 2];
			return [ConnectTiles.X_Fill_Half, 3];
		}

		// count4Corner == 3
		{
			if (!isDR) return [ConnectTiles.X_Fill_3, 0];
			if (!isUR) return [ConnectTiles.X_Fill_3, 1];
			if (!isUL) return [ConnectTiles.X_Fill_3, 2];
			return [ConnectTiles.X_Fill_3, 3];
		}
	}
}