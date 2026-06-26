import { HTMLEscapeToken, ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function htmlEscape(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: HTMLEscapeToken;
}): import('snabbdom').VNode[];
