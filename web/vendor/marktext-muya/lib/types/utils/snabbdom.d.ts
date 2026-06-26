import { h as sh, toVNode as sToVNode } from 'snabbdom';
import { default as sToHTML } from 'snabbdom-to-html';
export declare const patch: (oldVnode: import('snabbdom').VNode | Element | DocumentFragment, vnode: import('snabbdom').VNode) => import('snabbdom').VNode;
export declare const h: typeof sh;
export declare const toVnode: typeof sToVNode;
export declare const toHTML: typeof sToHTML;
export declare function htmlToVNode(html: string): (string | import('snabbdom').VNode)[] | undefined;
