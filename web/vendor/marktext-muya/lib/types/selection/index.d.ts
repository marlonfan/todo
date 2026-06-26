import { default as Content } from '../block/base/content';
import { default as Format } from '../block/base/format';
import { ImageToken } from '../inlineRenderer/types';
import { Muya } from '../muya';
import { ICursor, INodeOffset, ISelection } from './types';
declare class Selection {
    muya: Muya;
    /**
     * topOffset is the line counts above cursor, and bottomOffset is line counts bellow cursor.
     * @param {*} paragraph
     */
    static getCursorYOffset(paragraph: HTMLElement): {
        topOffset: number;
        bottomOffset: number;
    };
    static getCursorCoords(): DOMRect | null;
    static getSelectionStart(): Node | null;
    get scrollPage(): import('../types').Nullable<import('../block/scrollPage').ScrollPage>;
    get isCollapsed(): boolean;
    get isSelectionInSameBlock(): boolean;
    get direction(): "none" | "forward" | "backward";
    get type(): "None" | "Caret" | "Range";
    doc: Document;
    anchorPath: (string | number)[];
    anchorBlock: Content | null;
    focusPath: (string | number)[];
    focusBlock: Content | null;
    anchor: INodeOffset | null;
    focus: INodeOffset | null;
    selectedImage: {
        token: ImageToken;
        imageId: string;
        block: Format;
    } | null;
    private _selectInfo;
    constructor(muya: Muya);
    selectAll(): void;
    /**
     * Return the current selection of doc or null if has no selection.
     * @returns The resolved selection mapped to anchor/focus blocks, or null when no selection exists.
     */
    getSelection(): ISelection | null;
    setSelection({ anchor, focus, block, path, anchorBlock, anchorPath, focusBlock, focusPath, }: ICursor): void;
    private _listenSelectActions;
    private _handleClickInlineImage;
    private _selectRange;
    private _select;
    private _setFocus;
    private _setCursor;
}
export declare function getCursorReference(): {
    getBoundingClientRect(): DOMRect;
    clientWidth: number;
    clientHeight: number;
} | null;
export default Selection;
