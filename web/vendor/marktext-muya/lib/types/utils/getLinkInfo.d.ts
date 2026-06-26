export interface IExtractedLinkInfo {
    href: string | null;
    raw: string;
    text: string;
    range: {
        start: number;
        end: number;
    } | null;
}
export declare function getLinkInfo(el: HTMLElement): IExtractedLinkInfo | null;
