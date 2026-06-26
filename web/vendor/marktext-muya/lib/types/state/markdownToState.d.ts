import { TState } from './types';
interface IMarkdownToStateOptions {
    footnote: boolean;
    math: boolean;
    isGitlabCompatibilityEnabled: boolean;
    trimUnnecessaryCodeBlockEmptyLines: boolean;
    frontMatter: boolean;
}
export declare class MarkdownToState {
    private _options;
    constructor(_options?: IMarkdownToStateOptions);
    generate(markdown: string): TState[];
    private _convertMarkdownToState;
}
export {};
