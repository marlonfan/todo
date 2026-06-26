import { Muya } from '../muya';
import { Nullable } from '../types';
import { ScrollPage } from '../block/scrollPage';
declare class Clipboard {
    muya: Muya;
    copyType: string;
    pasteType: string;
    copyInfo: string;
    get selection(): import('../selection').default;
    get scrollPage(): Nullable<ScrollPage>;
    static create(muya: Muya): Clipboard;
    constructor(muya: Muya);
    listen(): void;
    getClipboardData(): {
        html: string;
        text: string;
    };
    copyHandler(event: ClipboardEvent): void;
    cutHandler(): void;
    pasteHandler(event: ClipboardEvent): Promise<void>;
    copyAsMarkdown(): void;
    copyAsHtml(): void;
    pasteAsPlainText(): void;
    copy(type: string, info: string): void;
}
export default Clipboard;
