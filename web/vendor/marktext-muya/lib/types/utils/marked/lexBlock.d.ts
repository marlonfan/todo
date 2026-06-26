import { Token } from 'marked';
import { Heading, ILexOption, ListToken } from './types';
export declare function lexBlock(src: string, options?: ILexOption): (Token | ListToken | Heading)[];
