import { ISyntaxRenderOptions, SoftLineBreakToken } from '../types';
import { default as Renderer } from './index';
export default function softLineBreak(this: Renderer, { h, token }: ISyntaxRenderOptions & {
    token: SoftLineBreakToken;
}): import('snabbdom').VNode[];
