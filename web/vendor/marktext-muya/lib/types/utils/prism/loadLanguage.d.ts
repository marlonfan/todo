interface ILangLoadStatus {
    lang: string;
    status: 'noexist' | 'cached' | 'loaded';
}
/**
 * The set of all languages which have been loaded using the below function.
 *
 * @type {Set<string>}
 */
export declare const loadedLanguages: Set<string>;
export declare function transformAliasToOrigin(langs: string[]): string[];
declare function initLoadLanguage(Prism: any): (langs?: string[] | string) => Promise<ILangLoadStatus[]>;
export default initLoadLanguage;
