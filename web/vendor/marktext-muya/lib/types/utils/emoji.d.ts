/**
 * check if one emoji code is in emojis, return undefined or found emoji
 */
export declare function validEmoji(text: string): {
    emoji: string;
    description: string;
    category: string;
    aliases: string[];
    tags: string[];
    skin_tones?: undefined;
} | {
    emoji: string;
    description: string;
    category: string;
    aliases: string[];
    tags: string[];
    skin_tones: boolean;
} | undefined;
/**
 * check edit emoji
 */
export declare function checkEditEmoji(node: HTMLElement): false | HTMLElement;
