import { ISyntaxRenderOptions, ReferenceDefinitionToken } from '../types';
import { default as Renderer } from './index';
export default function referenceDefinition(this: Renderer, { h, block, token }: ISyntaxRenderOptions & {
    token: ReferenceDefinitionToken;
}): import('snabbdom').VNode[];
