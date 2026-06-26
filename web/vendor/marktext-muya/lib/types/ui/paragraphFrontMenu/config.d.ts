import { default as Parent } from '../../block/base/parent';
export declare const FRONT_MENU: {
    icon: any;
    label: string;
    text: string;
    shortCut: string;
}[];
export type FrontMenuIcon = (typeof FRONT_MENU)[number];
export declare function canTurnIntoMenu(block: Parent): {
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
