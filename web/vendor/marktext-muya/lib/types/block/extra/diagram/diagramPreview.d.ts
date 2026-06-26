import { Muya } from '../../../muya';
import { IDiagramState, TState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class DiagramPreview extends Parent {
    code: string;
    type: string;
    static blockName: string;
    static create(muya: Muya, state: IDiagramState): DiagramPreview;
    get path(): never[];
    constructor(muya: Muya, { text, meta }: IDiagramState);
    getState(): TState;
    attachDOMEvents(): void;
    clickHandler(event: Event): void;
    update(code?: string): Promise<void>;
}
export default DiagramPreview;
