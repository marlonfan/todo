import { IHighlight } from '../../inlineRenderer/types';
import { Muya } from '../../muya';
import { ICursor, INodeOffset } from '../../selection/types';
import { Nullable } from '../../types';
import { TBlockPath } from '../types';
import { default as Parent } from './parent';
import { default as TreeNode } from '../../block/base/treeNode';
import { default as Selection } from '../../selection';
declare class Content extends TreeNode {
    _text: string;
    isComposed: boolean;
    static blockName: string;
    get hasSelection(): boolean;
    get selection(): Selection;
    get inlineRenderer(): import('../../inlineRenderer').default;
    get path(): TBlockPath;
    get text(): string;
    set text(text: string);
    get isCollapsed(): boolean | undefined;
    get isContainerBlock(): boolean;
    constructor(muya: Muya, text: string);
    getAnchor(): Nullable<Parent>;
    clickHandler(_event: Event): void;
    tabHandler(_event: Event): void;
    keyupHandler(_event: Event): void;
    inputHandler(_event: Event): void;
    backspaceHandler(_event: Event): void;
    enterHandler(_event: Event): void;
    deleteHandler(event: Event): void;
    arrowHandler(event: Event): void;
    createDomNode(): void;
    /**
     * Get cursor if selection is in this block.
     */
    getCursor(): {
        start: {
            offset: number;
        };
        end: {
            offset: number;
        };
        anchor: INodeOffset;
        focus: INodeOffset;
        isCollapsed: boolean;
        isSelectionInSameBlock: boolean;
        direction: string;
        type: string;
    } | null;
    /**
     * Set cursor at the special position
     * @param {number} begin
     * @param {number} end
     * @param {boolean} needUpdate
     */
    setCursor(begin: number, end: number, needUpdate?: boolean): void;
    update(_cursor?: ICursor, _highlights?: IHighlight[]): void;
    composeHandler(event: Event): void;
    /**
     * used in input handler
     * @param {input event} event
     */
    autoPair(event: Event, text: string, start: INodeOffset, end: INodeOffset, isInInlineMath?: boolean, isInInlineCode?: boolean, type?: string): {
        text: string;
        needRender: boolean;
    };
    insertTab(): void;
    keydownHandler: (event: Event) => void;
    blurHandler(): void;
    focusHandler(): void;
    getAncestors(): Parent[];
    getCommonAncestors(block: Content): Parent[];
    remove(source?: string): this;
}
export default Content;
