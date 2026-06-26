import { VNode } from 'snabbdom';
import { default as CellBlock } from '../../block/gfm/table/cell';
import { Muya } from '../../index';
import { TableColumnToolIcon } from './config';
import { default as BaseFloat } from '../baseFloat';
export declare class TableColumnToolbar extends BaseFloat {
    oldVNode: VNode | null;
    block: CellBlock | null;
    icons: TableColumnToolIcon[];
    toolsContainer: HTMLDivElement;
    static pluginName: string;
    constructor(muya: Muya, options?: {});
    listen(): void;
    render(): void;
    selectItem(event: Event, item: TableColumnToolIcon): void;
}
