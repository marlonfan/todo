import { Muya } from '../../../muya';
import { IParagraphState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class Paragraph extends Parent {
    static blockName: string;
    static create(muya: Muya, state: IParagraphState): Paragraph;
    get path(): (string | number)[];
    constructor(muya: Muya);
    getState(): IParagraphState;
}
export default Paragraph;
