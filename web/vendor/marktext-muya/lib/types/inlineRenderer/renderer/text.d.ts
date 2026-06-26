import { ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function text(this: Renderer, { h, block, token }: ISyntaxRenderOptions): import('snabbdom').VNode[];
