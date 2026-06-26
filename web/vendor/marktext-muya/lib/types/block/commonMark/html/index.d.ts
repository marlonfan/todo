import { Muya } from '../../../muya';
import { IHtmlBlockState } from '../../../state/types';
import { TBlockPath } from '../../types';
import { default as Parent } from '../../base/parent';
declare class HTMLBlock extends Parent {
    static blockName: string;
    static create(muya: Muya, state: IHtmlBlockState): HTMLBlock;
    get path(): (string | number)[];
    constructor(muya: Muya);
    queryBlock(path: TBlockPath): import('../../base/content').default | this | null;
    getState(): IHtmlBlockState;
}
export default HTMLBlock;
