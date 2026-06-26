import { Muya } from '../../index';
import { default as BaseFloat } from '../baseFloat';
interface ICheckerCount {
    row: number;
    column: number;
}
declare class TablePicker extends BaseFloat {
    static pluginName: string;
    private _checkerCount;
    private _oldVNode;
    private _current;
    private _select;
    private _tableContainer;
    constructor(muya: Muya);
    listen(): void;
    render(): void;
    keyupHandler(event: KeyboardEvent, type: 'row' | 'column'): void;
    showPicker(current: ICheckerCount, reference: any, cb: (...args: any[]) => void): void;
    selectItem(): void;
}
export default TablePicker;
