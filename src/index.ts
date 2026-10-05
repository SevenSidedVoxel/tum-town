import { AppCtx } from "./AppCtx";
import { GameView } from "./views/GameView";
// import { MainMenuView } from "./views/MainMenuView";

export const BuildTimestamp = __BUILD_TIMESTAMP__;
export const BuildID = "bread";

document.addEventListener("DOMContentLoaded", () => {
	// Setup root & view
	const root = document.getElementById("content-root");
	var ctx = new AppCtx(root);
	// ctx.changeView(new MainMenuView(ctx));
	ctx.changeView(new GameView(ctx));
});