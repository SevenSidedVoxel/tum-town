import { Rule, MatchFlags } from "./Rule";
import { pickLastActIndex } from "./Tile";
import { Tiles } from "./_tiles_";


export function makeRules(): Rule[] {
	let rules: Rule[] = [];

	rules.push(new Rule("Make Big-House",
		{
			c: Tiles.House2,
			u: Tiles.House1,
			d: Tiles.House1,
			l: Tiles.House1,
			r: Tiles.House1,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.u, area.d, area.l, area.r],
				Tiles.House3,
				area.c.rot);
			ctx.addScore(area.c, 4);
			ctx.addPop(area.c, 4);
		},
		MatchFlags.None));
	rules.push(new Rule("Make L-House",
		{
			c: Tiles.House1,
			u: Tiles.House1,
			l: Tiles.House1,
			d: Tiles.House1,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.u, area.d, area.l],
				Tiles.House2,
				rot);
			ctx.addScore(area.c, 3);
		},
		MatchFlags.Rotate4));
	rules.push(new Rule("Make Square-House",
		{
			c: Tiles.House1,
			u: Tiles.House1,
			l: Tiles.House1,
			ul: Tiles.House1,
		},
		(ctx, area, rot) => {
			const tiles = [area.c, area.u, area.ul, area.l];
			const lastTile = pickLastActIndex(tiles);

			ctx.mergeTilesInto(
				lastTile,
				tiles.filter(t => t != lastTile),
				Tiles.Factory1,
				rot);
			ctx.addScore(area.c, 3);
		},
		MatchFlags.None));

	makeForestRules(rules);
	makeSawmillRules(rules);

	rules.push(new Rule("Make Fountain",
		{
			c: Tiles.Water,
			u: Tiles.Path,
			d: Tiles.Path,
			l: Tiles.Path,
			r: Tiles.Path,
		},
		(ctx, area, rot) => {
			// Choose the newest tile to become the forest
			const tiles = [area.c, area.u, area.ul, area.l];
			const lastTile = pickLastActIndex(tiles);

			ctx.replaceTile(area.c, Tiles.Fountain);

			ctx.addScore(lastTile, 4);
			ctx.addNat(lastTile, 1);
		},
		MatchFlags.None));

	rules.push(new Rule("Make Bridge",
		{
			c: Tiles.Water,
			u: Tiles.Water,
			d: Tiles.Water,
			l: Tiles.Path,
			r: Tiles.Path,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Bridge);
			ctx.addScore(area.c, 2);
		},
		MatchFlags.Rotate1));
	rules.push(new Rule("Make Bridge",
		{
			c: Tiles.Path,
			u: Tiles.Water,
			d: Tiles.Water,
			l: Tiles.Path,
			r: Tiles.Path,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Bridge);
			ctx.addScore(area.c, 2);
		},
		MatchFlags.Rotate1));

	return rules;
}

function makeForestRules(rules: Rule[]) {
	rules.push(new Rule("Make Big Tree",
		{
			c: Tiles.Tree,
			ul: Tiles.Tree,
			u: Tiles.Tree,
			ur: Tiles.Tree,
			l: Tiles.Tree,
			r: Tiles.Tree,
			dl: Tiles.Tree,
			d: Tiles.Tree,
			dr: Tiles.Tree,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[
					area.ul, area.u, area.ur,
					area.l, area.r,
					area.dl, area.d, area.dr
				],
				Tiles.BigTree
			);

			ctx.addScore(area.c, 16);
			ctx.addNat(area.c, 8);
		},
		MatchFlags.None));
	rules.push(new Rule("Make Big Tree in Forest",
		{
			c: Tiles.Forest,
			ul: Tiles.Forest,
			u: Tiles.Forest,
			ur: Tiles.Forest,
			l: Tiles.Forest,
			r: Tiles.Forest,
			dl: Tiles.Forest,
			d: Tiles.Forest,
			dr: Tiles.Forest,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.BigTree);
			ctx.addScore(area.c, 16);
			ctx.addNat(area.c, 8);
		},
		MatchFlags.None));

	rules.push(new Rule("Make Forest",
		{
			c: Tiles.Tree,
			u: Tiles.Tree,
			ul: Tiles.Tree,
			l: Tiles.Tree,
		},
		(ctx, area, rot) => {
			// Choose the newest tile to become the forest
			const tiles = [area.c, area.u, area.ul, area.l];
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

	rules.push(new Rule("Forest Growth L",
		{
			c: Tiles.Tree,
			u: Tiles.Forest,
			ul: Tiles.Forest,
			l: Tiles.Forest,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Forest);
			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 2);
		},
		MatchFlags.Rotate4));

	rules.push(new Rule("Forest Growth T",
		{
			c: Tiles.Tree,
			u: Tiles.Forest,
			r: Tiles.Forest,
			l: Tiles.Forest,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Forest);
			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 2);
		},
		MatchFlags.Rotate4));
}

function makeSawmillRules(rules: Rule[]) {
	rules.push(new Rule("Make Sawmill",
		{
			c: Tiles.Factory1,
			u: Tiles.Forest,
			l: Tiles.Forest,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Sawmill, rot);
			ctx.addScore(area.c, 4);
		},
		MatchFlags.Rotate4));
}