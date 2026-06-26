import { Muya } from '../../../muya';
import { IMathBlockState, IMathMeta } from '../../../state/types';
import { TBlockPath } from '../../types';
import { default as Parent } from '../../base/parent';
declare class MathBlock extends Parent {
    meta: IMathMeta;
    static blockName: string;
    static create(muya: Muya, state: IMathBlockState): MathBlock;
    get path(): (string | number)[];
    constructor(muya: Muya, { meta }: IMathBlockState);
    queryBlock(path: TBlockPath): import('../../base/content').default | this | null;
    getState(): IMathBlockState;
}
export default MathBlock;
