export interface IView {
	enter(ctx: AppCtx): Promise<void>;
	exit(ctx: AppCtx): Promise<void>;
}

export class AppCtx {
	public root: HTMLElement;
	public currView: IView | null = null;

	constructor(root) {
		this.root = root;
	}

	public async changeView(view: IView | null) {
		await this.currView?.exit(this);
		this.currView = view;
		await this.currView?.enter(this);
	}

	public addClickHandler(id: string, handler: EventListenerOrEventListenerObject) {
		this.root.querySelector(`#${id}`)?.addEventListener('click', handler);
	}
}
