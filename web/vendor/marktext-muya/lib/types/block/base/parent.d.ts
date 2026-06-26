import { TState } from '../../state/types';
import { Nullable } from '../../types';
import { TBlockPath } from '../types';
import { LinkedList } from '../../block/base/linkedList/linkedList';
import { default as TreeNode } from '../../block/base/treeNode';
declare class Parent extends TreeNode {
    attachments: LinkedList<Parent>;
    children: LinkedList<TreeNode>;
    prev: Nullable<Parent>;
    next: Nullable<Parent>;
    private _active;
    get active(): boolean;
    set active(value: boolean);
    get firstChild(): Nullable<TreeNode>;
    get lastChild(): Nullable<TreeNode>;
    get isContainerBlock(): boolean;
    get path(): TBlockPath;
    getJsonPath(): TBlockPath;
    getState(): TState;
    /**
     * Clone itself.
     */
    clone(): TreeNode;
    /**
     * Return the length of children.
     */
    length(): number;
    offset(node: TreeNode): number;
    find(offset: number): TreeNode | null;
    /**
     * Append node in linkedList, mounted it into the DOM tree, dispatch operation if necessary.
     * @param  {...any} args
     */
    append(...childrenAndSource: [...Parent[], string]): void;
    append(...children: Parent[]): void;
    /**
     * This method will only be used when initialization.
     * @param  {...any} nodes attachment blocks
     */
    appendAttachment(...nodes: Parent[]): void;
    forEachAt(index: number, length: number | undefined, callback: (cur: TreeNode, i: number) => void): void;
    forEach(callback: (cur: TreeNode, i: number) => void): void;
    map<M>(callback: (cur: TreeNode, i: number) => M): M[];
    reduce<M>(callback: (memo: M, cur: TreeNode, i: number) => M, initialValue: M): M;
    /**
     * Use the `block` to replace the current block(this)
     * @param {TreeNode} block
     */
    replaceWith(block: Parent, source?: string): Parent | undefined;
    insertBefore(newNode: Parent, refNode?: Nullable<Parent>, source?: string): Parent;
    insertAfter(newNode: Parent, refNode?: Nullable<Parent>, source?: string): Parent;
    remove(source?: string): this;
    empty(): void;
    removeChild(node: TreeNode, source?: string): TreeNode;
    /**
     * find the first content block, paragraph.content etc.
     */
    firstContentInDescendant(): import('./content').default | null;
    /**
     * find the last content block in container block.
     */
    lastContentInDescendant(): import('./content').default | null;
    breadthFirstTraverse(this: Parent, callback: (node: TreeNode) => void): void;
    depthFirstTraverse(this: Parent, callback: (node: TreeNode) => void): void;
}
export default Parent;
