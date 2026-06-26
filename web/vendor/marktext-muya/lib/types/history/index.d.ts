import { JSONOpList } from 'ot-json1';
import { Muya } from '../muya';
import { ISelection } from '../selection/types';
import { Nullable } from '../types';
interface IOptions {
    delay: number;
    maxStack: number;
    userOnly: boolean;
}
declare class History {
    muya: Muya;
    private options;
    private _lastRecorded;
    private _ignoreChange;
    private _selectionStack;
    private _stack;
    get selection(): import('../selection').default;
    constructor(muya: Muya, options?: IOptions);
    private _listen;
    private _change;
    clear(): void;
    cutoff(): void;
    getLastSelection(): Nullable<ISelection>;
    private _record;
    canRedo(): boolean;
    redo(): void;
    transform(op: JSONOpList): void;
    canUndo(): boolean;
    undo(): void;
}
export default History;
