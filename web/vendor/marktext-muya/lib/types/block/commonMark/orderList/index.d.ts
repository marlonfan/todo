import { Muya } from '../../../muya';
import { IOrderListState } from '../../../state/types';
import { LinkedList } from '../../base/linkedList/linkedList';
import { default as Parent } from '../../base/parent';
declare class OrderList extends Parent {
    children: LinkedList<Parent>;
    meta: IOrderListState['meta'];
    static blockName: string;
    static create(muya: Muya, state: IOrderListState): OrderList;
    get path(): (string | number)[];
    constructor(muya: Muya, { meta }: IOrderListState);
    getState(): IOrderListState;
}
export default OrderList;
