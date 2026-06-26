import { Muya } from '../muya';
export declare class MarkdownToHtml {
    markdown: string;
    muya?: Muya | undefined;
    private _exportContainer;
    constructor(markdown: string, muya?: Muya | undefined);
    renderMermaid(): Promise<void>;
    renderDiagram(): Promise<void>;
    renderHtml(): Promise<string>;
    /**
     * Get HTML with style
     *
     * @param {*} options Document options
     */
    generate(options?: {
        title?: string;
        extraCSS?: string;
    }): Promise<string>;
}
