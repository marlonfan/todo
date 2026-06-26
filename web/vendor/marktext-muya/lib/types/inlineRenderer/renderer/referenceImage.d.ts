import { ISyntaxRenderOptions, ReferenceImageToken } from '../types';
import { default as Renderer } from './index';
export default function referenceImage(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: ReferenceImageToken;
}): import('snabbdom').VNode[];
