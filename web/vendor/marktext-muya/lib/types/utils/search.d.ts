import { IMatch, ISearchOption } from '../search/types';
export declare function matchString(text: string, value: string, options: ISearchOption): import('execall').Match[];
export declare function buildRegexValue(match: IMatch, value: string): string;
