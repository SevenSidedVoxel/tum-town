import { Rule, MatchFlags } from "./Rule";
import { pickLastActIndex } from "./Tile";
import { Tiles } from "./_tiles_";


export function makeRules(): Rule[] {
	let rules: Rule[] = [];

	rules.push(new Rule("Make Big-House",
		{
			cc: Tiles.House2,
			uc: Tiles.House1,
			dc: Tiles.House1,
			cl: Tiles.House1,
			cr: Tiles.House1,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.cc,
				[area.uc, area.dc, area.cl, area.cr],
				Tiles.House3,
				area.cc.rot);
			ctx.addScore(area.cc, 4);
			ctx.addPop(area.cc, 4);
		},
		MatchFlags.None));
	rules.push(new Rule("Make L-House",
		{
			cc: Tiles.House1,
			uc: Tiles.House1,
			cl: Tiles.House1,
			dc: Tiles.House1,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.cc,
				[area.uc, area.dc, area.cl],
				Tiles.House2,
				rot);
			ctx.addScore(area.cc, 3);
		},
		MatchFlags.Rotate4));

	rules.push(new Rule("Make Forest X",
		{
			cc: Tiles.Tree,
			ul: Tiles.Tree,
			ur: Tiles.Tree,
			dl: Tiles.Tree,
			dr: Tiles.Tree,
		},
		(ctx, area, rot) => {
			// Choose the newest tile to become the forest
			ctx.mergeTilesInto(
				area.cc,
				[area.ul, area.ur, area.dl, area.dr],
				Tiles.Forest
			);

			ctx.addScore(area.cc, 4);
			ctx.addNat(area.cc, 2);
		},
		MatchFlags.None));
	rules.push(new Rule("Make Forest",
		{
			cc: Tiles.Tree,
			uc: Tiles.Tree,
			ul: Tiles.Tree,
			cl: Tiles.Tree,
		},
		(ctx, area, rot) => {
			// Choose the newest tile to become the forest
			const tiles = [area.cc, area.uc, area.ul, area.cl];
			const lastTile = pickLastActIndex(tiles);

			ctx.mergeTilesInto(
				lastTile,
				tiles.filter(t => t !== lastTile),
				Tiles.Forest
			);

			ctx.addScore(lastTile, 4);
			ctx.addNat(lastTile, 2);
		},
		MatchFlags.None));

	rules.push(new Rule("Make Fountain",
		{
			cc: Tiles.Empty,
			uc: Tiles.Path,
			dc: Tiles.Path,
			cl: Tiles.Path,
			cr: Tiles.Path,
		},
		(ctx, area, rot) => {
			// Choose the newest tile to become the forest
			const tiles = [area.cc, area.uc, area.ul, area.cl];
			const lastTile = pickLastActIndex(tiles);

			ctx.replaceTile(area.cc, Tiles.Fountain);

			ctx.addScore(lastTile, 4);
			ctx.addNat(lastTile, 1);
		},
		MatchFlags.None));

	return rules;
}
