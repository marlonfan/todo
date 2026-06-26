import { Muya } from '../../index';
export declare class ImageResizeBar {
    muya: Muya;
    static pluginName: string;
    private _reference;
    private _block;
    private _imageInfo;
    private _movingAnchor;
    private _status;
    private _width;
    private _eventId;
    private _lastScrollTop;
    private _resizing;
    private _container;
    constructor(muya: Muya);
    listen(): void;
    render(): void;
    createElements(): void;
    update(): void;
    mouseDown: (event: Event) => void;
    mouseMove: (event: Event) => void;
    mouseUp: (event: Event) => void;
    hide(): void;
}
