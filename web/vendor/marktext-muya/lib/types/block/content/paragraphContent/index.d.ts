import { Muya } from '../../../index';
import { ICursor } from '../../../selection/types';
import { Nullable } from '../../../types';
import { default as Paragraph } from '../../commonMark/paragraph';
import { default as Format } from '../../base/format';
/**
 * ParagraphContent
 */
declare class ParagraphContent extends Format {
    parent: Nullable<Paragraph>;
    static blockName: string;
    static create(muya: Muya, text: string): ParagraphContent;
    constructor(muya: Muya, text: string);
    getAnchor(): Nullable<Paragraph>;
    update(cursor?: ICursor, highlights?: never[]): void;
    backspaceHandler(event: Event): void;
    inputHandler(event: Event): void;
    private _enterConvert;
    private _enterInBlockQuote;
    private _enterInListItem;
    enterHandler(event: Event): void;
    private _paragraphParentType;
    private _handleBackspaceInParagraph;
    private _handleBackspaceInBlockQuote;
    private _handleBackspaceInList;
    private _getUnindentType;
    private _canIndentListItem;
    private _unindentListItem;
    private _indentListItem;
    insertTab(): void;
    private _checkCursorAtEndFormat;
    tabHandler(event: Event): void;
}
export default ParagraphContent;
