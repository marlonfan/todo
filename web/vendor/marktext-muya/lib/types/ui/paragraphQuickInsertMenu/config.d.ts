import { default as Parent } from '../../block/base/parent';
import { Muya } from '../../index';
export interface IQuickInsertMenuItem {
    name: string;
    children: {
        title: string;
        subTitle: string;
        label: string;
        icon: string;
        score?: number;
        i18nTitle?: string;
        shortCut?: string;
        shortKeyMap?: {
            altKey: boolean;
            shiftKey: boolean;
            metaKey: boolean;
            code: string;
        };
    }[];
}
export declare const MENU_CONFIG: IQuickInsertMenuItem[];
export declare function getLabelFromEvent(event: Event): string | undefined;
export declare function replaceBlockByLabel({ block, muya, label, text }: {
    block: Parent;
    muya: Muya;
    label: string;
    text?: string;
}): void;
