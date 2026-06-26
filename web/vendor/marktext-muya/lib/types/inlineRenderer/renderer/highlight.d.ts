import { default as Format } from '../../block/base/format';
import { H, Token } from '../types';
import { default as Renderer } from './index';
export default function highlight(this: Renderer, h: H, block: Format, rStart: number, rEnd: number, token: Token): (string | import('snabbdom').VNode)[];
