import { Muya } from '../../../muya';
import { IAtxHeadingState } from '../../../state/types';
import { TBlockPath } from '../../types';
import { default as Parent } from '../../base/parent';
declare class AtxHeading extends Parent {
    meta: IAtxHeadingState['meta'];
    static blockName: string;
    static create(muya: Muya, state: IAtxHeadingState): AtxHeading;
    get path(): TBlockPath;
    constructor(muya: Muya, { meta }: IAtxHeadingState);
    getState(): IAtxHeadingState;
}
export default AtxHeading;
