export declare const beginRules: {
    hr: RegExp;
    code_fence: RegExp;
    header: RegExp;
    reference_definition: RegExp;
    multiple_math: RegExp;
};
export declare const endRules: {
    tail_header: RegExp;
};
export type BeginRules = typeof beginRules;
export declare const commonMarkRules: {
    strong: RegExp;
    em: RegExp;
    inline_code: RegExp;
    image: RegExp;
    link: RegExp;
    reference_link: RegExp;
    reference_image: RegExp;
    html_tag: RegExp;
    html_escape: RegExp;
    soft_line_break: RegExp;
    hard_line_break: RegExp;
    backlash: RegExp;
};
export type CommonMarkRules = typeof commonMarkRules;
export declare const gfmRules: {
    emoji: RegExp;
    del: RegExp;
    auto_link: RegExp;
    auto_link_extension: RegExp;
};
export type GfmRules = typeof gfmRules;
export declare const inlineExtensionRules: {
    inline_math: RegExp;
    superscript: RegExp;
    subscript: RegExp;
    footnote_identifier: RegExp;
};
export type InlineExtensionRules = typeof inlineExtensionRules;
export declare const inlineRules: {
    inline_math: RegExp;
    superscript: RegExp;
    subscript: RegExp;
    footnote_identifier: RegExp;
    emoji: RegExp;
    del: RegExp;
    auto_link: RegExp;
    auto_link_extension: RegExp;
    strong: RegExp;
    em: RegExp;
    inline_code: RegExp;
    image: RegExp;
    link: RegExp;
    reference_link: RegExp;
    reference_image: RegExp;
    html_tag: RegExp;
    html_escape: RegExp;
    soft_line_break: RegExp;
    hard_line_break: RegExp;
    backlash: RegExp;
    tail_header: RegExp;
};
export type InlineRules = typeof inlineRules;
declare const EXCLUDE_KEYS: readonly ["em", "strong", "tail_header", "backlash", "superscript", "subscript", "footnote_identifier"];
type InlineRuleKeys = keyof InlineRules;
type ValidateRules = {
    [keys in Exclude<InlineRuleKeys, typeof EXCLUDE_KEYS[number]>]: RegExp;
};
export declare const validateRules: ValidateRules;
export {};
