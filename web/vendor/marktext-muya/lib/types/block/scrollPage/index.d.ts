import { Muya } from '../../muya';
import { TState } from '../../state/types';
import { default as Content } from '../base/content';
import { TBlockPath } from '../types';
import { default as Parent } from '../base/parent';
export declare class ScrollPage extends Parent {
    private _blurFocus;
    static blockName: string;
    static registeredBlocks: Map<any, any>;
    static register(Block: any): void;
    static loadBlock(blockName: string): any;
    static create(muya: Muya, state: TState[]): ScrollPage;
    get path(): never[];
    constructor(muya: Muya);
    getState(): TState;
    private _listenDomEvent;
    updateState(state: TState[]): void;
    /**
     * Find the content block by the path
     * @param {Array} path
     */
    queryBlock(path: TBlockPath): any;
    updateRefLinkAndImage(label: string): void;
    handleBlurFromContent(block: Content): void;
    handleFocusFromContent(block: Content): void;
    private _updateActiveStatus;
    private _clickHandler;
}
