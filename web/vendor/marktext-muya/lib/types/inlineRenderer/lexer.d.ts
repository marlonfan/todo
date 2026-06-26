import { ITokenizerOptions, Token } from './types';
export declare function tokenizer(src: string, { highlights, hasBeginRules, labels, options, }?: ITokenizerOptions): Token[];
export declare function generator(tokens: Token[]): string;
