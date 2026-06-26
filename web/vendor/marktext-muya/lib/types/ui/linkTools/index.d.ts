import { VNode } from 'snabbdom';
import { default as Format } from '../../block/base/format';
import { Muya } from '../../muya';
import { IBaseOptions } from '../types';
import { default as BaseFloat } from '../baseFloat';
import { default as iconsConfig } from './config';
type LinkToolIcon = typeof iconsConfig[number];
interface ILinkInfo {
    href?: string | null;
    text?: string;
    raw?: string;
    range?: {
        start: number;
        end: number;
    } | null;
    [key: string]: unknown;
}
interface ILinkToolsOptions extends IBaseOptions {
    jumpClick?: (linkInfo: ILinkInfo | null) => void;
}
declare class LinkTools extends BaseFloat {
    static pluginName: string;
    options: ILinkToolsOptions;
    oldVNode: VNode | null;
    linkInfo: ILinkInfo | null;
    linkBlock: Format | null;
    icons: LinkToolIcon[];
    hideTimer: ReturnType<typeof setTimeout> | null;
    linkContainer: HTMLElement;
    constructor(muya: Muya, options?: Partial<ILinkToolsOptions>);
    listen(): void;
    render(): void;
    selectItem(event: Event, item: LinkToolIcon): void;
}
export default LinkTools;
