import { Muya } from '../../../muya';
import { IListItemState } from '../../../state/types';
import { LinkedList } from '../../base/linkedList/linkedList';
import { default as Parent } from '../../base/parent';
declare class ListItem extends Parent {
    children: LinkedList<Parent>;
    static blockName: string;
    static create(muya: Muya, state: IListItemState): ListItem;
    get path(): (string | number)[];
    constructor(muya: Muya);
    getState(): IListItemState;
}
export default ListItem;
