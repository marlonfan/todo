import { VNode } from 'snabbdom';
import { DelToken, ISyntaxRenderOptions, StrongEmToken } from '../types';
import { default as Renderer } from './index';
export default function delEmStrongFac(this: Renderer, type: 'del' | 'em' | 'strong', { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: StrongEmToken | DelToken;
}): VNode[];
