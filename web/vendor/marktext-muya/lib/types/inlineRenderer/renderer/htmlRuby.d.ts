import { HTMLTagToken, ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function htmlRuby(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: HTMLTagToken;
}): import('snabbdom').VNode[];
