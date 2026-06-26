import { Muya } from '../muya';
import { default as BaseFloat } from './baseFloat';
export declare class Ui {
    muya: Muya;
    shownFloat: Set<BaseFloat>;
    shownButton: Set<BaseFloat>;
    constructor(muya: Muya);
    listen(): void;
    hideAllFloatTools(): void;
}
