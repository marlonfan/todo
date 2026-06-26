import { Muya } from '../../../muya';
import { ICursor } from '../../../selection/types';
import { default as Format } from '../../base/format';
declare class ThematicBreakContent extends Format {
    static blockName: string;
    static create(muya: Muya, text: string): ThematicBreakContent;
    constructor(muya: Muya, text: string);
    getAnchor(): import('../../../types').Nullable<import('../../base/parent').default>;
    update(cursor: ICursor, highlights?: never[]): void;
    /**
     * Create an empty paragraph bellow.
     * @param {*} event
     */
    enterHandler(event: Event): void;
    backspaceHandler(event: Event): void;
}
export default ThematicBreakContent;
