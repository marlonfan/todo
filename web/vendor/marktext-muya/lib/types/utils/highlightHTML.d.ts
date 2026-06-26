import { IHighlight } from '../inlineRenderer/types';
export declare const MARKER_HASH: {
    '<': string;
    '>': string;
    '"': string;
    '\'': string;
};
export declare function getHighlightHtml(text: string, highlights: IHighlight[], escape?: boolean, handleLineEnding?: boolean): string;
