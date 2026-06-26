import { Listener } from './event/types';
import { ILocale } from './i18n/types';
import { ITocItem } from './state/getTOC';
import { TState } from './state/types';
import { IMuyaOptions } from './types';
import { Editor } from './editor/index';
import { default as EventCenter } from './event/index';
import { default as I18n } from './i18n/index';
import { Ui } from './ui/ui';
interface IPlugin {
    plugin: any;
    options: any;
}
export declare class Muya {
    static plugins: IPlugin[];
    static use(plugin: any, options?: {}): void;
    readonly version: string;
    options: IMuyaOptions;
    eventCenter: EventCenter;
    domNode: HTMLElement;
    editor: Editor;
    ui: Ui;
    i18n: I18n;
    private _uiPlugins;
    constructor(element: HTMLElement, options?: Partial<IMuyaOptions>);
    private _bindFocusBlurEvents;
    init(): void;
    locale(object: ILocale): void;
    /**
     * [on] on custom event
     */
    on(event: string, listener: Listener): void;
    /**
     * [off] off custom event
     */
    off(event: string, listener: Listener): void;
    /**
     * [once] subscribe event and listen once
     */
    once(event: string, listener: Listener): void;
    getState(): TState[];
    getMarkdown(): string;
    /**
     * Return a flat table of contents for the current document.
     *
     * Mirrors marktext's `tocCtrl.getTOC` (including the 9cb2cbe8 regex
     * fix). Only top-level atx / setext headings are surfaced; nested
     * headings inside blockquotes / list items are ignored, same as
     * marktext. `content` is the raw heading text (inline markdown not
     * parsed); `slug` is a stable per-block identifier; `githubSlug` is
     * the GitHub-style anchor derived from `content`.
     */
    getTOC(): ITocItem[];
    undo(): void;
    redo(): void;
    /**
     * Search value in current document.
     * @param {string} value
     * @param {object} opts
     */
    search(value: string, opts?: {}): import('./search').Search;
    /**
     * Find preview or next value, and highlight it.
     * @param {string} action : previous or next.
     */
    find(action: 'previous' | 'next'): import('./search').Search;
    replace(replaceValue: string, opt?: {
        isSingle: boolean;
        isRegexp: boolean;
    }): import('./search').Search;
    setContent(content: TState[] | string, autoFocus?: boolean): void;
    focus(): void;
    selectAll(): void;
    destroy(): void;
}
export {};
