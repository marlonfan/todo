import { CodeEmojiMathToken, TextToken, Token } from '../../inlineRenderer/types';
import { ICursor } from '../../selection/types';
import { IImageInfo } from '../../utils/image';
import { default as Content } from '../../block/base/content';
declare class Format extends Content {
    static blockName: string;
    private _checkCursorInTokenType;
    private _checkNotSameToken;
    checkNeedRender(cursor?: ICursor): boolean;
    blurHandler(): void;
    /**
     * Update emoji text if cursor is in emoji syntax.
     * @param {string} text emoji text
     */
    setEmoji(text: string): void;
    replaceImage({ token }: IImageInfo, { alt, src, title }: {
        alt?: string | undefined;
        src?: string | undefined;
        title?: string | undefined;
    }): void;
    updateImage({ imageId, token }: IImageInfo, attrName: string, attrValue: string): void;
    unlink({ range, text }: {
        range: {
            start: number;
            end: number;
        } | null;
        text: string;
    }): void;
    deleteImage({ token }: IImageInfo): void;
    clickHandler(event: Event): void;
    keyupHandler(): void;
    inputHandler(event: Event): void;
    private _convertIfNeeded;
    private _convertToThematicBreak;
    private _convertToList;
    convertToTaskList(): void;
    private _convertToAtxHeading;
    private _convertToSetextHeading;
    private _convertToBlockQuote;
    private _convertToIndentedCodeBlock;
    convertToParagraph(force?: boolean): void;
    backspaceHandler(event: Event): void;
    deleteHandler(event: KeyboardEvent): void;
    shiftEnterHandler(event: Event): void;
    enterHandler(event: KeyboardEvent): void;
    getFormatsInRange(cursor?: {
        start: {
            offset: number;
        };
        end: {
            offset: number;
        };
        anchor: import('../../selection/types').INodeOffset;
        focus: import('../../selection/types').INodeOffset;
        isCollapsed: boolean;
        isSelectionInSameBlock: boolean;
        direction: string;
        type: string;
    } | null): {
        formats: (import('../../inlineRenderer/types').BeginRuleToken | import('../../inlineRenderer/types').ReferenceDefinitionToken | TextToken | import('../../inlineRenderer/types').BacklashToken | import('../../inlineRenderer/types').StrongEmToken | CodeEmojiMathToken | import('../../inlineRenderer/types').DelToken | import('../../inlineRenderer/types').SuperSubScriptToken | import('../../inlineRenderer/types').FootnoteIdentifierToken | import('../../inlineRenderer/types').ImageToken | import('../../inlineRenderer/types').LinkToken | import('../../inlineRenderer/types').ReferenceLinkToken | import('../../inlineRenderer/types').ReferenceImageToken | import('../../inlineRenderer/types').HTMLEscapeToken | import('../../inlineRenderer/types').AutoLinkExtensionToken | import('../../inlineRenderer/types').AutoLinkToken | import('../../inlineRenderer/types').HTMLTagToken | import('../../inlineRenderer/types').SoftLineBreakToken | import('../../inlineRenderer/types').HardLineBreakToken | import('../../inlineRenderer/types').TailHeaderToken)[];
        tokens: Token[];
        neighbors: (import('../../inlineRenderer/types').BeginRuleToken | import('../../inlineRenderer/types').ReferenceDefinitionToken | TextToken | import('../../inlineRenderer/types').BacklashToken | import('../../inlineRenderer/types').StrongEmToken | CodeEmojiMathToken | import('../../inlineRenderer/types').DelToken | import('../../inlineRenderer/types').SuperSubScriptToken | import('../../inlineRenderer/types').FootnoteIdentifierToken | import('../../inlineRenderer/types').ImageToken | import('../../inlineRenderer/types').LinkToken | import('../../inlineRenderer/types').ReferenceLinkToken | import('../../inlineRenderer/types').ReferenceImageToken | import('../../inlineRenderer/types').HTMLEscapeToken | import('../../inlineRenderer/types').AutoLinkExtensionToken | import('../../inlineRenderer/types').AutoLinkToken | import('../../inlineRenderer/types').HTMLTagToken | import('../../inlineRenderer/types').SoftLineBreakToken | import('../../inlineRenderer/types').HardLineBreakToken | import('../../inlineRenderer/types').TailHeaderToken)[];
    };
    format(type: string): void;
    private _addFormat;
    private _handleClickInlineRuleRender;
    private _emitFootnoteToolEvent;
}
export default Format;
