export declare const toolList: {
    right: {
        label: string;
        action: string;
        location: string;
        target: string;
    }[];
    bottom: {
        label: string;
        action: string;
        location: string;
        target: string;
    }[];
};
export type MenuItem = typeof toolList['right'][number];
