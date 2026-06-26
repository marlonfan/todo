import { Nullable } from '../../../types';
export interface ILinkedNode {
    prev: Nullable<ILinkedNode>;
    next: Nullable<ILinkedNode>;
}
