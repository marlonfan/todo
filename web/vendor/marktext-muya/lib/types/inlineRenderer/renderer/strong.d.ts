import { ISyntaxRenderOptions, StrongEmToken } from '../types';
import { default as Renderer } from './index';
export default function strong(this: Renderer, { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & {
    token: StrongEmToken;
}): import('snabbdom').VNode[];
