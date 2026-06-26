import { Muya } from '../../../muya';
import { IMathBlockState, TState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class MathContainer extends Parent {
    static blockName: string;
    static create(muya: Muya, state: IMathBlockState): MathContainer;
    get lang(): string;
    get path(): (string | number)[];
    constructor(muya: Muya);
    getState(): TState;
}
export default MathContainer;
