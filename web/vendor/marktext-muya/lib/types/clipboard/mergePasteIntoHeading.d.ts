import { default as Content } from '../block/base/content';
import { default as Parent } from '../block/base/parent';
import { TState } from '../state/types';
import { Nullable } from '../types';
interface IPasteCursor {
    startOffset: number;
    endOffset: number;
}
/**
 * Backport of marktext commit 1c42555a (#671). When pasting multi-paragraph
 * markdown into an atx/setext heading, splice the first paragraph state into
 * the heading's text — keeping the heading semantics intact — and return the
 * tail states so the caller can drop them in as new blocks below.
 *
 * When the wrapper is not a heading or the first state isn't a plain paragraph,
 * the original states array is returned untouched and the caller falls back
 * to its previous behaviour (which still needs to collapse any selection).
 */
export declare function mergePasteIntoHeading(anchorBlock: Content, wrapperBlock: Nullable<Pick<Parent, 'blockName'>>, states: TState[], cursor: IPasteCursor): TState[];
export {};
