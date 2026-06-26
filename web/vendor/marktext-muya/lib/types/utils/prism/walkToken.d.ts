import { Token } from 'prismjs';
interface ITempTextToken {
    type: 'temp-text';
    content: string;
    length: number;
}
export declare function walkTokens(tokens: (string | Token)[], cb: (t: ITempTextToken | Token) => void): void;
export {};
