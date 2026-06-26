import { Rules } from './types';
export declare const PUNCTUATION_REG: RegExp;
export declare const WHITELIST_ATTRIBUTES: string[];
export declare function lowerPriority(src: string, offset: number, rules: Rules): boolean;
export declare function getAttributes(html: string): Record<string, string | null> | null;
export declare function parseSrcAndTitle(text?: string): {
    src: string;
    title: string;
};
export declare function validateEmphasize(src: string, offset: number, marker: string, pending: string, rules: Rules): boolean;
export declare function correctUrl(token: string[] | null): void;
