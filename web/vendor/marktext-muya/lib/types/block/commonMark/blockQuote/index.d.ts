import { Muya } from '../../../muya';
import { IBlockQuoteState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class BlockQuote extends Parent {
    static blockName: string;
    static create(muya: Muya, state: IBlockQuoteState): BlockQuote;
    get path(): (string | number)[];
    constructor(muya: Muya);
    getState(): IBlockQuoteState;
}
export default BlockQuote;
