import { Muya } from '../../../muya';
import { CodeContentState, TState } from '../../../state/types';
import { Nullable } from '../../../types';
import { default as CodeBlock } from './index';
import { default as Parent } from '../../base/parent';
declare class Code extends Parent {
    parent: Nullable<CodeBlock>;
    private readonly _withLineNumbers;
    lineNumbersWrapper: HTMLElement | null;
    static blockName: string;
    static create(muya: Muya, state: CodeContentState): Code;
    get path(): (string | number)[];
    constructor(muya: Muya, withLineNumbers?: boolean);
    getState(): TState;
    createCopyNode(): void;
    listen(): void;
}
export default Code;
