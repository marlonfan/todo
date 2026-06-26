import { Doc, JSONOpList, Path } from 'ot-json1';
import { Muya } from '../muya';
import { TDiff } from '../utils';
import { TState } from './types';
import * as json1 from 'ot-json1';
declare class JSONState {
    muya: Muya;
    static invert(op: JSONOpList): json1.JSONOp;
    static compose(op1: JSONOpList, op2: JSONOpList): json1.JSONOp;
    static transform(op: JSONOpList, otherOp: JSONOpList, type: 'left' | 'right'): JSONOpList | null | undefined;
    private _operationCache;
    private _isGoing;
    private _state;
    constructor(muya: Muya, stateOrMarkdown: TState[] | string);
    apply(op: JSONOpList): void;
    setContent(content: TState[] | string): void;
    setState(state: TState[]): void;
    setMarkdown(markdown: string): void;
    insertOperation(path: Path, state: TState): void;
    removeOperation(path: Path): void;
    editOperation(path: Path, diff: TDiff[]): void;
    replaceOperation(path: Path, oldValue: Doc, newValue: Doc): void;
    dispatch(op: JSONOpList, source?: string): void;
    getState(): TState[];
    getMarkdown(): string;
    private _emitStateChange;
}
export default JSONState;
