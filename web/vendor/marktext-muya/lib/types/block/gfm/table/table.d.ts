import { Muya } from '../../../muya';
import { ITableState } from '../../../state/types';
import { default as TableRow } from './row';
import { LinkedList } from '../../base/linkedList/linkedList';
import { default as Parent } from '../../base/parent';
declare class TableInner extends Parent {
    children: LinkedList<TableRow>;
    static blockName: string;
    static create(muya: Muya, state: ITableState): TableInner;
    get path(): (string | number)[];
    constructor(muya: Muya, _state: ITableState);
    getState(): ITableState;
}
export default TableInner;
