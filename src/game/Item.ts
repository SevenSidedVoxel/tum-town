import { P2 } from "./P2";
import { ModelIcon } from "./render/GameRenderer";
import { TileType } from "./Tile";


export class Item {
	public type: TileType;
	public count: number;

	public icon: ModelIcon;

	constructor(type: TileType, count: number, icon: ModelIcon) {
		this.type = type;
		this.count = count;
		this.icon = icon;
	}
}
