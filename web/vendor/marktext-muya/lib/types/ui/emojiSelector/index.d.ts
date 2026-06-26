import { Emoji as EmojiType } from '../../config/emojis';
import { Muya } from '../../index';
import { default as BaseScrollFloat } from '../baseScrollFloat';
export declare class EmojiSelector extends BaseScrollFloat {
    static pluginName: string;
    private _renderObj;
    private _oldVNode;
    private _emoji;
    renderArray: EmojiType[];
    activeItem: EmojiType | null;
    constructor(muya: Muya);
    get renderObj(): Record<string, EmojiType[]>;
    set renderObj(obj: Record<string, EmojiType[]>);
    listen(): void;
    render(): void;
    getItemElement(item: EmojiType): HTMLElement;
    destroy(): void;
}
