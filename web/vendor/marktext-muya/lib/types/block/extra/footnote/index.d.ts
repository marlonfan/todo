import { Muya } from '../../../muya';
import { IFootnoteBlockMeta, IFootnoteBlockState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class Footnote extends Parent {
    meta: IFootnoteBlockMeta;
    static blockName: string;
    static create(muya: Muya, state: IFootnoteBlockState): Footnote;
    get path(): (string | number)[];
    get isContainerBlock(): boolean;
    constructor(muya: Muya, { meta }: IFootnoteBlockState);
    getState(): IFootnoteBlockState;
}
export default Footnote;
