import { Muya } from '../../../muya';
import { IHtmlBlockState, TState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class HTMLContainer extends Parent {
    static blockName: string;
    static create(muya: Muya, state: IHtmlBlockState): HTMLContainer;
    get lang(): string;
    get path(): (string | number)[];
    constructor(muya: Muya);
    getState(): TState;
}
export default HTMLContainer;
