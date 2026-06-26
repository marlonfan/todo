import { ReferenceElement } from '@floating-ui/dom';
import { Muya } from '../../muya';
import { default as BaseFloat } from '../baseFloat';
declare abstract class BaseScrollFloat extends BaseFloat {
    scrollElement: HTMLElement | null;
    reference: Element | ReferenceElement | null;
    activeItem: unknown | null;
    renderArray: unknown[];
    constructor(muya: Muya, name: string, options?: {});
    createScrollElement(): void;
    activeEleScrollIntoView(ele: HTMLElement): void;
    listen(): void;
    hide(): void;
    show(reference: Element | ReferenceElement, cb?: (...args: unknown[]) => void): void;
    step(direction: 'previous' | 'next'): void;
    selectItem(item: unknown): void;
    abstract render(): void;
    abstract getItemElement(item: unknown): HTMLElement;
}
export default BaseScrollFloat;
