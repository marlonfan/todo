declare const STYLE_LANG: {
    readonly '-': "yaml";
    readonly '+': "toml";
    readonly ';': "json";
    readonly '{': "json";
};
interface IFrontMatterToken {
    type: 'frontmatter';
    raw: string;
    text: string;
    style: keyof typeof STYLE_LANG;
    lang: 'yaml' | 'toml' | 'json';
}
export default function getFrontMatterInfo(text: string): {
    token: IFrontMatterToken | null;
    src: string;
};
export declare function frontMatterRender(token: IFrontMatterToken): string;
export {};
