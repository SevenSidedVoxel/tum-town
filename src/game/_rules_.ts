import { makeRule, makeRule_Match, Rule, RuleRotations } from "./Rule";
import { pickLastActIndex, Tile } from "./Tile";
import { Tiles } from "./_tiles_";


export function makeRules(): Rule[] {
	let rules: Rule[] = [];

	makeHouseRules(rules);
	makeTownRules(rules);
	makeForestRules(rules);
	makeFarmRules(rules);
	makeIndustrialRules(rules);

	rules.push(makeRule_Match("Make Bridge",
		RuleRotations.Rotate1,
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
		}));
	rules.push(makeRule_Match("Make Bridge",
		RuleRotations.Rotate1,
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
		}));

	return rules;
}

function makeForestRules(rules: Rule[]) {
	rules.push(makeRule_Match("Make Xmas Tree",
		RuleRotations.None,
		{
			c: Tiles.BigTree,
			u: Tiles.House1,
			l: Tiles.House1,
			r: Tiles.House1,
			d: Tiles.House1,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.u, area.l, area.r, area.d,],
				Tiles.XmasTree
			);

			ctx.addScore(area.c, 20);
		}));
	rules.push(makeRule_Match("Make Big Tree",
		RuleRotations.None,
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
		}));
	rules.push(makeRule_Match("Make Big Tree in Forest",
		RuleRotations.None,
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
		}));

	rules.push(makeRule_Match("Make Forest",
		RuleRotations.None,
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
		}));

	rules.push(makeRule_Match("Forest Growth L",
		RuleRotations.Rotate4,
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
		}));

	rules.push(makeRule_Match("Forest Growth T",
		RuleRotations.Rotate4,
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
		}));
}

function makeHouseRules(rules: Rule[]) {
	rules.push(makeRule_Match("Make Church",
		RuleRotations.None,
		{
			c: Tiles.House1,
			u: Tiles.House1,
			l: Tiles.House1,
			r: Tiles.House1,
			d: Tiles.House1,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.u, area.l, area.r, area.d],
				Tiles.Church);
			ctx.addScore(area.c, 8);
		}));
	rules.push(makeRule("Make Graveyard",
		RuleRotations.None,
		Tiles.Church,
		(ctx, area, rot) => {
			let stoneCount = 0;
			for (const tile of area)
				stoneCount += tile.type == Tiles.Stone ? 1 : 0;
			return stoneCount >= 3;
		},
		(ctx, area, rot) => {
			// Choose the youngest tile to become the graveyard
			let stoneTiles = [area.ul, area.u, area.ur, area.l, area.r, area.dl, area.d, area.dr]
				.filter(t => t.type == Tiles.Stone);
			const targetTile = pickLastActIndex(stoneTiles);
			if (stoneTiles.length > 3)
				stoneTiles = stoneTiles.sort(t => t.actIndex).slice(0, 3); // Only merge the youngest 3 stones

			ctx.mergeTilesInto(
				targetTile,
				stoneTiles,
				Tiles.Graveyard);

			ctx.addScore(targetTile, 4);
			ctx.addNat(targetTile, 1);
		}));

	rules.push(makeRule_Match("Make Big-House",
		RuleRotations.None,
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
		}));
	rules.push(makeRule_Match("Make L-House",
		RuleRotations.Rotate4,
		{
			c: Tiles.House1,
			u: Tiles.House1,
			r: Tiles.House1,
			d: Tiles.House1,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.u, area.d, area.r],
				Tiles.House2,
				rot);
			ctx.addScore(area.c, 3);
		}));
	rules.push(makeRule_Match("Make Square-House",
		RuleRotations.None,
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
				Tiles.Building,
				rot);
			ctx.addScore(area.c, 3);
		}));
}

function makeTownRules(rules: Rule[]) {
	rules.push(makeRule_Match("Make Town Bell",
		RuleRotations.None,
		{
			c: Tiles.Building,
			u: Tiles.House1,
			l: Tiles.House1,
			r: Tiles.House1,
			d: Tiles.House1,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(area.c,
				[area.u, area.l, area.r, area.d,],
				Tiles.TownBell);
			ctx.addScore(area.c, 4);
		}));

	rules.push(makeRule_Match("Make Fountain",
		RuleRotations.None,
		{
			c: Tiles.Water,
			u: Tiles.Path,
			d: Tiles.Path,
			l: Tiles.Path,
			r: Tiles.Path,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(area.c,
				[area.u, area.l, area.r, area.d,],
				Tiles.Fountain);

			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 1);
		}));
}

function makeIndustrialRules(rules: Rule[]) {
	rules.push(makeRule_Match("Make Sawmill",
		RuleRotations.Rotate4,
		{
			c: Tiles.Building,
			u: Tiles.Forest,
			l: Tiles.Forest,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Sawmill, rot);
			ctx.addScore(area.c, 4);
		}));

	rules.push(makeRule_Match("Make Mine",
		RuleRotations.Rotate4,
		{
			c: Tiles.Building,
			u: Tiles.Stone,
			l: Tiles.Stone,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(area.c,
				[area.u, area.l],
				Tiles.Mine, rot);
			ctx.addScore(area.c, 4);
		}));
}

function makeFarmRules(rules: Rule[]) {
	rules.push(makeRule_Match("Make Barn",
		RuleRotations.Rotate4,
		{
			c: Tiles.Building,
			u: Tiles.Field,
			l: Tiles.Field,
			ul: Tiles.Field,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Barn, rot);
			ctx.addScore(area.c, 8);
		}));
	rules.push(makeRule_Match("Pasturize Field",
		RuleRotations.Rotate4,
		{
			c: Tiles.Field,
			u: Tiles.Barn,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Pasture);
			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 4);
		}));
	rules.push(makeRule_Match("Pasturize Field",
		RuleRotations.Rotate4,
		{
			c: Tiles.Field,
			u: Tiles.Pasture,
		},
		(ctx, area, rot) => {
			ctx.replaceTile(area.c, Tiles.Pasture);
			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 4);
		}));

	rules.push(makeRule_Match("Make Field",
		RuleRotations.None,
		{
			c: Tiles.Empty,
			u: Tiles.Stone,
			l: Tiles.Stone,
			r: Tiles.Stone,
			d: Tiles.Stone,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.u, area.l, area.r, area.d,],
				Tiles.Field
			);

			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 4);
		}));
	rules.push(makeRule_Match("Expand Field",
		RuleRotations.Rotate4,
		{
			c: Tiles.Empty,
			u: Tiles.Stone,
			l: Tiles.Field,
			r: Tiles.Stone,
			d: Tiles.Stone,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.u, area.r, area.d,],
				Tiles.Field
			);

			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 4);
		}));
	rules.push(makeRule_Match("Make Field Corner",
		RuleRotations.Rotate4,
		{
			c: Tiles.Empty,
			u: Tiles.Stone,
			l: Tiles.Field,
			r: Tiles.Stone,
			d: Tiles.Field,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.u, area.r,],
				Tiles.Field
			);

			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 4);
		}));
	rules.push(makeRule_Match("Make Field Inset",
		RuleRotations.Rotate4,
		{
			c: Tiles.Empty,
			u: Tiles.Field,
			l: Tiles.Field,
			r: Tiles.Field,
			d: Tiles.Stone,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.d,],
				Tiles.Field
			);

			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 4);
		}));
	rules.push(makeRule_Match("Join Fields",
		RuleRotations.Rotate1,
		{
			c: Tiles.Empty,
			u: Tiles.Field,
			l: Tiles.Stone,
			r: Tiles.Stone,
			d: Tiles.Field,
		},
		(ctx, area, rot) => {
			ctx.mergeTilesInto(
				area.c,
				[area.l, area.r,],
				Tiles.Field
			);

			ctx.addScore(area.c, 4);
			ctx.addNat(area.c, 4);
		}));
}