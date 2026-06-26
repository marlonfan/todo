import { Muya } from '../../../muya';
import { IDiagramMeta, IDiagramState } from '../../../state/types';
import { TBlockPath } from '../../types';
import { default as Parent } from '../../base/parent';
declare class DiagramBlock extends Parent {
    meta: IDiagramMeta;
    static blockName: string;
    static create(muya: Muya, state: IDiagramState): DiagramBlock;
    get path(): (string | number)[];
    constructor(muya: Muya, { meta }: IDiagramState);
    queryBlock(path: TBlockPath): import('../../base/content').default | this | null;
    getState(): IDiagramState;
}
export default DiagramBlock;
