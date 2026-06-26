export interface IMathToken {
    type: 'inlineMath' | 'multiplemath';
    raw: string;
    text: string;
    displayMode: boolean;
    mathStyle?: '' | 'gitlab';
}
interface IOptions {
    throwOnError?: boolean;
    useKatexRender?: boolean;
}
export default function (options?: IOptions): {
    extensions: ({
        name: string;
        level: "inline";
        start(src: string): number | undefined;
        tokenizer(src: string): {
            type: string;
            raw: string;
            text: string;
            displayMode: boolean;
        } | undefined;
        renderer: (token: IMathToken) => string;
    } | {
        name: string;
        level: "block";
        start(src: string): number;
        tokenizer(src: string): {
            type: string;
            raw: string;
            text: string;
            displayMode: boolean;
            mathStyle: string;
        } | undefined;
        renderer: (token: IMathToken) => string;
    })[];
};
export {};
