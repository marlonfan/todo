declare class Tooltip {
    private _muya;
    private _cache;
    constructor(muya: any);
    mouseOver(event: any): void;
    mouseLeave(event: any): void;
}
export default Tooltip;
