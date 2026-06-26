import { default as Renderer } from './index';
export default function loadImageAsync(this: Renderer, imageInfo: {
    isUnknownType: boolean;
    src: string;
}, attrs: Record<string, string>, className?: string, imageClass?: string): {
    id: string;
    isSuccess: boolean | undefined;
    url: string | undefined;
    width: number | undefined;
    height: number | undefined;
};
