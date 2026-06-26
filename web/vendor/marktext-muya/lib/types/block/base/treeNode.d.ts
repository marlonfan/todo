import { Muya } from '../../muya';
import { Nullable } from '../../types';
import { IAttributes, IDatasets } from '../../utils/types';
import { IConstructor } from '../types';
import { default as Content } from './content';
import { ILinkedNode } from './linkedList/linkedNode';
import { default as Parent } from './parent';
declare class TreeNode implements ILinkedNode {
    muya: Muya;
    prev: Nullable<TreeNode>;
    next: Nullable<TreeNode>;
    parent: Nullable<Parent>;
    domNode: Nullable<HTMLElement>;
    tagName: string;
    classList: string[];
    attributes: IAttributes;
    datasets: IDatasets;
    static blockName: string;
    get static(): IConstructor<TreeNode>;
    get blockName(): string;
    get jsonState(): import('../../state').default;
    get scrollPage(): Nullable<import('../scrollPage').ScrollPage>;
    get isScrollPage(): boolean;
    get isOutMostBlock(): boolean;
    get outMostBlock(): Nullable<Parent>;
    constructor(muya: Muya);
    /**
     * check this is a Content block?
     * @param this
     * @returns boolean
     */
    isContent(this: TreeNode): this is Content;
    /**
     * check this is a Parent block?
     * @param this
     * @returns boolean
     */
    isParent(this: TreeNode): this is Parent;
    /**
     * create domNode
     */
    createDomNode(): void;
    previousContentInContext(): Nullable<Content>;
    nextContentInContext(): Nullable<Content>;
    /**
     * Weather `this` is the only child of its parent.
     */
    isOnlyChild(): boolean;
    /**
     * Weather `this` is the first child of its parent.
     */
    isFirstChild(): boolean;
    /**
     * Weather `this` is the last child of its parent.
     */
    isLastChild(): boolean;
    /**
     * Weather `this` is descendant of `block`
     * @param {*} block
     */
    isInBlock(block: Parent): boolean;
    /**
     * Find the closest block which blockName is `blockName`. return `null` if not found.
     * @param {string} blockName
     */
    closestBlock(blockName: string): Nullable<TreeNode>;
    farthestBlock(blockName: string): Nullable<TreeNode>;
    insertInto(parent: Parent, refBlock?: Nullable<Parent>): void;
    /**
     * Remove the current block in the block tree.
     */
    remove(_source?: string): this | undefined;
}
export default TreeNode;
