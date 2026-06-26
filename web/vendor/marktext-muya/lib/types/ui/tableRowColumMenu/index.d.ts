import { Muya } from '../../index';
import { MenuItem } from './config';
import { default as BaseFloat } from '../baseFloat';
export declare class TableRowColumMenu extends BaseFloat {
    static pluginName: string;
    private _oldVNode;
    private _tableInfo;
    private _block;
    private _tableBarContainer;
    constructor(muya: Muya, options?: {});
    listen(): void;
    render(): void;
    selectItem(event: Event, item: MenuItem): void;
}
