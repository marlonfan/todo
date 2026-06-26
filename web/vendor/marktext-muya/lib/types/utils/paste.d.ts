export declare const isOnline: () => boolean;
export declare function getPageTitle(url: string): Promise<string>;
export declare function normalizePastedHTML(html: string): Promise<string>;
export declare function isStandaloneTableHtml(text: string): boolean;
/**
 *
 * @param {string} html
 * @param {string} text
 * @param {string} pasteType normal or pasteAsPlainText
 * return html | text | code, if the return value is html, we'll use html as paste data, we'll use text
 * as paste data if the return value is text, we'll create a html code block if the result is code.
 */
export declare function getCopyTextType(html: string, text: string, pasteType: string): "code" | "html" | "text";
