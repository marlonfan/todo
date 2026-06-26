import { Muya } from '../../../muya';
import { ICursor } from '../../../selection/types';
import { default as Format } from '../../base/format';
declare class SetextHeadingContent extends Format {
    static blockName: string;
    static create(muya: Muya, text: string): SetextHeadingContent;
    constructor(muya: Muya, text: string);
    getAnchor(): import('../../../types').Nullable<import('../../base/parent').default>;
    update(cursor: ICursor, highlights?: never[]): void;
    enterHandler(event: Event): void;
    backspaceHandler(event: Event): void;
}
export default SetextHeadingContent;
