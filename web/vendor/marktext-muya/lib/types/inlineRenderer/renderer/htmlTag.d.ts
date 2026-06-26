import { VNode } from 'snabbdom';
import { HTMLTagToken, ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function htmlTag(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: HTMLTagToken;
}): VNode[];
