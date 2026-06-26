import { IAttributes, IDatasets } from './types';
interface ICreateDomOptions {
    classList: string[];
    attributes: IAttributes;
    datasets: IDatasets;
}
export declare function createDomNode(tagName: string, { classList, attributes, datasets }?: ICreateDomOptions): HTMLElement;
/**
 * [description `add` or `remove` className of element
 */
export declare function operateClassName(element: HTMLElement, ctrl: 'add' | 'remove', className: string): void;
export declare function insertBefore(newNode: HTMLElement, originNode: HTMLElement): void;
export declare function insertAfter(newNode: HTMLElement, originNode: HTMLElement): void;
export {};
