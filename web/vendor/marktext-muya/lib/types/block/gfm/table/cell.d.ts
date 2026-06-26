import { default as Table } from '.';
import { Muya } from '../../../muya';
import { ITableCellMeta, ITableCellState } from '../../../state/types';
import { default as TableCellContent } from '../../content/tableCell';
import { default as Row } from './row';
import { LinkedList } from '../../base/linkedList/linkedList';
import { default as Parent } from '../../base/parent';
declare class TableBodyCell extends Parent {
    children: LinkedList<TableCellContent>;
    meta: ITableCellMeta;
    static blockName: string;
    static create(muya: Muya, state: ITableCellState): TableBodyCell;
    get path(): (string | number)[];
    get table(): Table;
    get row(): Row;
    get rowOffset(): number;
    get columnOffset(): number;
    get align(): string;
    set align(value: string);
    constructor(muya: Muya, { meta }: ITableCellState);
    getState(): ITableCellState;
}
export default TableBodyCell;
