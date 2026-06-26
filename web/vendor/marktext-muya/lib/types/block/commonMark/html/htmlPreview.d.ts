import { Muya } from '../../../muya';
import { IHtmlBlockState, TState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class HTMLPreview extends Parent {
    html: string;
    static blockName: string;
    static create(muya: Muya, state: IHtmlBlockState): HTMLPreview;
    get path(): never[];
    constructor(muya: Muya, { text }: IHtmlBlockState);
    update(html?: string): void;
    getState(): TState;
}
export default HTMLPreview;
