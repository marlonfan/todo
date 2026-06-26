import { VNode } from 'snabbdom';
import { Muya } from '../../index';
import { IQuickInsertMenuItem } from '../paragraphQuickInsertMenu/config';
import { default as BaseFloat } from '../baseFloat';
export declare class ParagraphFrontMenu extends BaseFloat {
    static pluginName: string;
    reference: HTMLDivElement | null;
    private _oldVNode;
    private _block;
    private _frontMenuContainer;
    constructor(muya: Muya, options?: {});
    listen(): void;
    renderSubMenu(subMenu: IQuickInsertMenuItem['children']): VNode;
    render(): void;
    selectItem(event: Event, { label }: {
        label: string;
    }): void;
}
