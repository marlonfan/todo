import { Diff } from 'fast-diff';
import { default as Content } from '../block/base/content';
import { Config } from './dompurify';
interface IUnion {
    start: number;
    end: number;
    active?: boolean;
}
type Constructor = new (...args: any[]) => object;
interface IDefer<T> {
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
    promise: Promise<T>;
}
export declare function uniqueIdGenerator(): Generator<number, void, unknown>;
export declare const getUniqueId: () => string;
export declare function getLongUniqueId(): string;
export declare function noop(): void;
export declare const identity: <T>(i: T) => T;
export declare const isOdd: (n: number) => boolean;
export declare const isEven: (n: number) => boolean;
export declare const isLengthEven: (str?: string) => boolean;
export declare function snakeToCamel(name: string): string;
/**
 *  Are two arrays have intersection
 */
export declare function conflict(arr1: [number, number], arr2: [number, number]): boolean;
export declare function union({ start: tStart, end: tEnd }: IUnion, { start: lStart, end: lEnd, active }: IUnion): {
    start: number;
    end: number;
    active: boolean | undefined;
} | null;
export declare function throttle(func: any, wait?: number): (this: any) => any;
export declare function deepClone<T>(value: T): T;
export declare function escapeHTML(str: string): string;
export declare function unescapeHTML(str: string): string;
export declare function escapeInBlockHtml(html: string): string;
export declare function wordCount(markdown: string): {
    word: number;
    paragraph: number;
    character: number;
    all: number;
};
export declare function sanitize(html: string, purifyOptions: Config, disableHtml: boolean): string;
/**
 * TODO: @jocs remove in the future, because it's not used.
 * @param ele
 * @param id
 * @returns A floating-ui-compatible virtual reference positioned at the element's bounding rect.
 */
export declare function getParagraphReference(ele: HTMLElement, id: string): {
    getBoundingClientRect(): {
        x: number;
        y: number;
        left: number;
        top: number;
        bottom: number;
        height: number;
        width: number;
        right: number;
    };
    clientWidth: number;
    clientHeight: number;
    id: string;
};
export type TDiff = (string | number | {
    d: string;
});
/**
 * transform diff to text-unicode op
 * @param {Array} diffs
 */
export declare function diffToTextOp(diffs: Diff[]): TDiff[];
export declare function adjustOffset<T extends Content>(offset: number, block: T, event: KeyboardEvent): number;
export declare function verticalPositionInRect(event: MouseEvent, rect: DOMRect): "down" | "up";
export declare const hasPick: (c: any) => any;
export declare function getDefer<T>(): IDefer<T>;
export declare function methodMixins(...objects: Record<string, (...args: any[]) => any>[]): (constructor: Constructor) => void;
export declare function mixins(...constructors: Constructor[]): (derivedCtor: Constructor) => void;
export declare function isKeyboardEvent(event: Event): event is KeyboardEvent;
export declare function isMouseEvent(event: Event): event is MouseEvent;
export declare function isInputEvent(event: Event): event is InputEvent;
export declare function isElement(node: Node): node is Element;
export {};
