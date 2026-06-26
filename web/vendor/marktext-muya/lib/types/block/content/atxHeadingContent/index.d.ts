import { Muya } from '../../../muya';
import { ICursor } from '../../../selection/types';
import { default as AtxHeading } from '../../commonMark/atxHeading';
import { default as Format } from '../../base/format';
declare class AtxHeadingContent extends Format {
    parent: AtxHeading | null;
    static blockName: string;
    static create(muya: Muya, text: string): AtxHeadingContent;
    constructor(muya: Muya, text: string);
    getAnchor(): AtxHeading | null;
    update(cursor: ICursor, highlights?: never[]): void;
    enterHandler(event: Event): void;
    backspaceHandler(event: Event): void;
}
export default AtxHeadingContent;
