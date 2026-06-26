import { Muya } from '../../../muya';
import { ITableRowState } from '../../../state/types';
import { default as TableBodyCell } from './cell';
import { LinkedList } from '../../base/linkedList/linkedList';
import { default as Parent } from '../../base/parent';
declare class TableRow extends Parent {
    children: LinkedList<TableBodyCell>;
    static blockName: string;
    static create(muya: Muya, state: ITableRowState): TableRow;
    get path(): (string | number)[];
    constructor(muya: Muya);
    getState(): ITableRowState;
}
export default TableRow;
