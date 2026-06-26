import { Emoji as EmojiType } from '../../config/emojis';
declare class Emoji {
    private _cache;
    search(text: string): Record<string, EmojiType[]>;
    destroy(): void;
}
export default Emoji;
