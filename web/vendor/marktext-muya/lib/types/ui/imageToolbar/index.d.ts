import { Muya } from '../../index';
import { Icon } from './config';
import { default as BaseFloat } from '../baseFloat';
export declare class ImageToolBar extends BaseFloat {
    static pluginName: string;
    private _oldVNode;
    private _imageInfo;
    private _icons;
    private _reference;
    private _block;
    private _toolbarContainer;
    constructor(muya: Muya, options?: {});
    listen(): void;
    render(): void;
    selectItem(event: Event, item: Icon): void;
}
