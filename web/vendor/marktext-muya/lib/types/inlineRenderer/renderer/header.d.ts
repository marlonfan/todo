import { BeginRuleToken, ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function header(this: Renderer, { h, cursor, block, token, outerClass, }: ISyntaxRenderOptions & {
    token: BeginRuleToken;
}): import('snabbdom').VNode[];
