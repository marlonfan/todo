import { ISyntaxRenderOptions, TailHeaderToken } from '../types';
import { default as Renderer } from './index';
export default function tailHeader(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: TailHeaderToken;
}): (string | import('snabbdom').VNode)[];
