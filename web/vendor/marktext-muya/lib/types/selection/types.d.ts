import { default as ContentBlock } from '../block/base/content';
export interface INodeOffset {
    offset: number;
}
export interface ICursor {
    start?: INodeOffset | null;
    end?: INodeOffset | null;
    block?: ContentBlock;
    path?: (string | number)[];
    anchor?: INodeOffset | null;
    focus?: INodeOffset | null;
    anchorBlock?: ContentBlock;
    anchorPath?: (string | number)[];
    focusBlock?: ContentBlock;
    focusPath?: (string | number)[];
    isCollapsed?: boolean;
    isSelectionInSameBlock?: boolean;
    direction?: string;
    type?: string;
}
export interface ISelection {
    anchor: INodeOffset;
    focus: INodeOffset;
    anchorBlock: ContentBlock;
    anchorPath: (string | number)[];
    focusBlock: ContentBlock;
    focusPath: (string | number)[];
    isCollapsed: boolean;
    isSelectionInSameBlock: boolean;
    direction: string;
    type: string;
}
