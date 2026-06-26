import { ISyntaxRenderOptions } from '../types';
import { default as Renderer } from './index';
export default function backlash(this: Renderer, { h, cursor, block, token, outerClass }: ISyntaxRenderOptions): import('snabbdom').VNode[];
