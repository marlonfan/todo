import { TBlockPath } from '../types';
declare class LeafQueryBlock {
    firstChild: unknown;
    queryBlock(path: TBlockPath): unknown;
}
export default LeafQueryBlock;
