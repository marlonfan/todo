import { VNode } from 'snabbdom';
import { ImageToken, ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function image(this: Renderer, { h, block, token }: ISyntaxRenderOptions & {
    token: ImageToken;
}): VNode[];
