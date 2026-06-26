import { Muya } from '../../../muya';
import { IThematicBreakState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class ThematicBreak extends Parent {
    static blockName: string;
    static create(muya: Muya, state: IThematicBreakState): ThematicBreak;
    get path(): (string | number)[];
    constructor(muya: Muya);
    getState(): IThematicBreakState;
}
export default ThematicBreak;
