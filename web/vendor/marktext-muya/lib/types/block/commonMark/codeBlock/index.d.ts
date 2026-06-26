import { Muya } from '../../../muya';
import { ICodeBlockState } from '../../../state/types';
import { TBlockPath } from '../../types';
import { default as Parent } from '../../base/parent';
declare class CodeBlock extends Parent {
    meta: ICodeBlockState['meta'];
    static blockName: string;
    static create(muya: Muya, state: ICodeBlockState): CodeBlock;
    get lang(): string;
    set lang(value: string);
    get path(): TBlockPath;
    constructor(muya: Muya, { meta }: ICodeBlockState);
    queryBlock(path: TBlockPath): import('../../base/content').default | this | null;
    getState(): ICodeBlockState;
}
export default CodeBlock;
