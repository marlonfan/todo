import { Token } from 'marked';
import { Heading, ILexOption } from './types';
declare function walkTokens(options: ILexOption): (token: Token | Heading) => void;
export default walkTokens;
