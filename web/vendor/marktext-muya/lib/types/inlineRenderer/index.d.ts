import { default as Format } from '../block/base/format';
import { default as ParagraphContent } from '../block/content/paragraphContent';
import { Muya } from '../muya';
import { ICursor } from '../selection/types';
import { IParagraphState } from '../state/types';
import { IHighlight, Labels } from './types';
import { default as Renderer } from './renderer';
declare class InlineRenderer {
    muya: Muya;
    labels: Labels;
    renderer: Renderer;
    constructor(muya: Muya);
    tokenizer(block: Format, highlights: IHighlight[]): import('./types').Token[];
    patch(block: Format, cursor?: ICursor, highlights?: IHighlight[]): void;
    collectReferenceDefinitions(): void;
    getLabelInfo(blockOrState: ParagraphContent | IParagraphState): {
        label: string | null;
        info: {
            href: string;
            title: string;
        } | null;
    };
}
export default InlineRenderer;
