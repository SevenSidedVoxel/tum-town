export class ProgressionMeter {
	public id: number = 0;
	public startValue: number;
	public endValue: number;
	public value: number = 0;

	public meterElem: HTMLElement | null = null;

	constructor(id: number, startValue: number, endValue: number) {
		this.id = id;
		this.startValue = startValue;
		this.endValue = endValue;
	}

	public updateVisuals() {
		if (!this.meterElem)
			return;

		const percent = (this.value - this.startValue) / (this.endValue - this.startValue);
		this.meterElem.innerText = `${this.value} / ${this.endValue}`;
		this.meterElem.style.setProperty('--meter-min', `${this.startValue}`);
		this.meterElem.style.setProperty('--meter-max', `${this.endValue}`);
		this.meterElem.style.setProperty('--meter-percent', `${percent * 100}%`);
	}
}
