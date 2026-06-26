import { VNode } from 'snabbdom';
import { ISyntaxRenderOptions, ReferenceLinkToken } from '../types';
import { default as Renderer } from './index';
export default function referenceLink(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: ReferenceLinkToken;
}): VNode[];
