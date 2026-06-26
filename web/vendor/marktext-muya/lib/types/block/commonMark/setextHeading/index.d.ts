import { Muya } from '../../../muya';
import { ISetextHeadingState } from '../../../state/types';
import { default as Parent } from '../../base/parent';
declare class SetextHeading extends Parent {
    meta: ISetextHeadingState['meta'];
    static blockName: string;
    static create(muya: Muya, state: ISetextHeadingState): SetextHeading;
    get path(): (string | number)[];
    constructor(muya: Muya, { meta }: ISetextHeadingState);
    getState(): ISetextHeadingState;
}
export default SetextHeading;
