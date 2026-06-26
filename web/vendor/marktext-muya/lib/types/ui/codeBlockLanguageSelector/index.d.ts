import { Muya } from '../../index';
import { default as BaseScrollFloat } from '../baseScrollFloat';
export declare class CodeBlockLanguageSelector extends BaseScrollFloat {
    static pluginName: string;
    private _oldVNode;
    private _block;
    constructor(muya: Muya, options?: {});
    listen(): void;
    render(): void;
    getItemElement(item: {
        name: string;
    }): HTMLElement;
    selectItem(item: {
        name: string;
    }): void;
}
