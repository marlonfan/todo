import { Muya } from '../../../muya';
import { IDiagramMeta, IDiagramState, TState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class DiagramContainer extends Parent {
    meta: IDiagramMeta;
    static blockName: string;
    static create(muya: Muya, state: IDiagramState): DiagramContainer;
    get lang(): string;
    get path(): (string | number)[];
    constructor(muya: Muya, { meta }: IDiagramState);
    getState(): TState;
}
export default DiagramContainer;
