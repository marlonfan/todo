import { Muya } from '../../index';
import { default as BaseFloat } from '../baseFloat';
import { default as ICONS } from './config';
export declare class PreviewToolBar extends BaseFloat {
    static pluginName: string;
    private _oldVNode;
    private _block;
    private _iconContainer;
    constructor(muya: Muya, options?: {});
    listen(): void;
    render(): void;
    selectItem(event: Event, i: typeof ICONS[number]): void;
}
