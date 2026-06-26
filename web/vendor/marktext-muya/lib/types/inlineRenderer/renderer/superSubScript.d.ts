import { ISyntaxRenderOptions, SuperSubScriptToken } from '../types';
import { default as Renderer } from './index';
export default function superSubScript(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: SuperSubScriptToken;
}): import('snabbdom').VNode[];
