import { CodeEmojiMathToken, ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function inlineCode(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: CodeEmojiMathToken;
}): import('snabbdom').VNode[];
