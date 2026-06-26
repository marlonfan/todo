import { VNode } from 'snabbdom';
import { Muya } from '../../index';
import { IQuickInsertMenuItem } from './config';
import { default as ParagraphContent } from '../../block/content/paragraphContent';
import { default as BaseScrollFloat } from '../baseScrollFloat';
export declare class ParagraphQuickInsertMenu extends BaseScrollFloat {
    static pluginName: string;
    oldVNode: VNode | null;
    block: ParagraphContent | null;
    activeItem: IQuickInsertMenuItem['children'][number] | null;
    private _renderData;
    constructor(muya: Muya);
    get renderData(): IQuickInsertMenuItem[];
    set renderData(data: IQuickInsertMenuItem[]);
    listen(): void;
    render(): void;
    search(text: string): void;
    selectItem({ label }: IQuickInsertMenuItem['children'][number]): void;
    getItemElement(item: IQuickInsertMenuItem['children'][number]): HTMLElement;
}
