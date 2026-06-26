import { Muya } from '../muya';
import { IMatch } from './types';
export declare class Search {
    muya: Muya;
    value: string;
    matches: IMatch[];
    index: number;
    get scrollPage(): import('../types').Nullable<import('../block/scrollPage').ScrollPage>;
    constructor(muya: Muya);
    private _updateMatches;
    private _innerReplace;
    replace(replaceValue: string, opt?: {
        isSingle: boolean;
        isRegexp: boolean;
    }): this;
    /**
     * Find preview or next value, and highlight it.
     * @param {string} action : previous or next.
     */
    find(action: 'previous' | 'next'): this;
    /**
     * Search value in current document.
     * @param {string} value
     * @param {object} opts
     */
    search(value: string, opts?: {}): this;
}
