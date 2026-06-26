import { DelToken, ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function del(this: Renderer, { h, cursor, block, token, outerClass }: ISyntaxRenderOptions & {
    token: DelToken;
}): import('snabbdom').VNode[];
