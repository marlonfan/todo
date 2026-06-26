import { Muya } from '../../muya';
import { IBaseOptions } from '../types';
import { default as BaseFloat } from '../baseFloat';
export declare class FootnoteTool extends BaseFloat {
    static pluginName: string;
    private _oldVNode;
    private _identifier;
    private _footnotes;
    private _hideTimer;
    private _toolContainer;
    constructor(muya: Muya, options?: Partial<IBaseOptions>);
    listen(): void;
    private _render;
    private _handleButtonClick;
    private _goTo;
    private _createDefinition;
}
export default FootnoteTool;
