import { ImageToken } from '../inlineRenderer/types';
export declare function isInlineImage(token: {
    attrs: Record<string, string | null>;
}): boolean;
export declare function shouldShowImageResizeBar(token: ImageToken | {
    attrs: Record<string, string | null>;
}): boolean;
