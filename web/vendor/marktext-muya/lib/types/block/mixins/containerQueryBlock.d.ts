import { default as Content } from '../base/content';
import { default as Parent } from '../base/parent';
import { TBlockPath } from '../types';
interface IContainerQueryBlock {
    find: (p: number) => Parent | Content;
}
declare class IContainerQueryBlock {
    queryBlock(path: TBlockPath): any;
}
export default IContainerQueryBlock;
