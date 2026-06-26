interface IScriptToken {
    type: string;
    raw: string;
    text: string;
    marker: string;
}
export default function (): {
    extensions: {
        name: "superscript" | "subscript";
        level: "inline";
        start(src: string): number | undefined;
        tokenizer(src: string): {
            type: "superscript" | "subscript";
            raw: string;
            text: string;
            marker: string;
        } | undefined;
        renderer(token: IScriptToken): string;
    }[];
};
export {};
