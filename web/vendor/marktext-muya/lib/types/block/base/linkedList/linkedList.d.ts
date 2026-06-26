import { Nullable } from '../../../types';
import { ILinkedNode } from './linkedNode';
export declare class LinkedList<T extends ILinkedNode> {
    head: Nullable<T>;
    tail: Nullable<T>;
    length: number;
    iterator(curNode?: Nullable<T>, length?: number): Generator<T, void, unknown>;
    append(...nodes: T[]): void;
    contains(node: T): boolean;
    insertBefore(node: T, refNode?: T | null): void;
    offset(node: T): number;
    remove(node: T): void;
    find(index: number): T | null;
    forEach(callback: (cur: T, i: number) => void): void;
    forEachAt(index: number, length: number | undefined, callback: (cur: T, i: number) => void): void;
    map<M>(callback: (cur: T, i: number) => M): M[];
    reduce<M>(callback: (memo: M, cur: T, i: number) => M, memo: M): M;
}
