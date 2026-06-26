import { ISyntaxRenderOptions, LinkToken } from '../types';
import { default as Renderer } from './index';
export default function link(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: LinkToken;
}): any[];
