import { Muya } from '../../../muya';
import { IFrontmatterMeta, IFrontmatterState } from '../../../state/types';
import { TBlockPath } from '../../types';
import { default as Parent } from '../../base/parent';
declare class Frontmatter extends Parent {
    meta: IFrontmatterMeta;
    static blockName: string;
    static create(muya: Muya, state: IFrontmatterState): Frontmatter;
    get lang(): string;
    set lang(value: string);
    get path(): (string | number)[];
    constructor(muya: Muya, { meta }: IFrontmatterState);
    queryBlock(path: TBlockPath): import('../../base/content').default | this | null;
    getState(): IFrontmatterState;
}
export default Frontmatter;
