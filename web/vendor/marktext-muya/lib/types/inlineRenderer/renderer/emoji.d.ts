import { VNode } from 'snabbdom';
import { CodeEmojiMathToken, ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function emoji(this: Renderer, { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & {
    token: CodeEmojiMathToken;
}): VNode[];
