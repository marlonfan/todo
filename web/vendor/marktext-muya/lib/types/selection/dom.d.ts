export declare function isContentDOM(element: HTMLElement): boolean;
export declare function findContentDOM(node: Node | null | undefined): HTMLElement | null;
export declare function compareParagraphsOrder(paragraph1: HTMLElement, paragraph2: HTMLElement): number;
export declare function getTextContent(node: Node, blackList?: string[]): string;
export declare function getOffsetOfParagraph(node: Node, paragraph: HTMLElement): number;
export declare function getNodeAndOffset(node: Node, offset: number): {
    node: Node;
    offset: number;
};
