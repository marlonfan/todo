import { Muya } from '../../../muya';
import { IMathBlockState, TState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class MathPreview extends Parent {
    math: string;
    static blockName: string;
    static create(muya: Muya, state: IMathBlockState): MathPreview;
    get path(): never[];
    constructor(muya: Muya, { text }: IMathBlockState);
    getState(): TState;
    attachDOMEvents(): void;
    clickHandler(event: Event): void;
    update(math?: string): void;
}
export default MathPreview;
