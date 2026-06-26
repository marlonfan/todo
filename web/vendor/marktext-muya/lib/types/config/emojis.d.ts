declare const emojis: ({
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
})[];
export default emojis;
export type Emoji = typeof emojis[number];
