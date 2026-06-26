import { ReferenceElement } from '@floating-ui/dom';
import { Muya } from '../../index';
import { IBaseOptions } from '../types';
import { noop } from '../../utils';
declare abstract class BaseFloat {
    muya: Muya;
    name: string;
    options: IBaseOptions;
    status: boolean;
    floatBox: HTMLElement | null;
    container: HTMLElement | null;
    lastScrollTop: number | null;
    cb: (...args: unknown[]) => void;
    private _cleanup;
    private _resizeObserver;
    constructor(muya: Muya, name: string, options?: {});
    init(): void;
    listen(): void;
    hide(): void;
    show(reference: ReferenceElement, cb?: typeof noop): void;
    destroy(): void;
}
export default BaseFloat;
