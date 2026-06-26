import { Muya } from '../muya';
export interface ITocItem {
    content: string;
    lvl: number;
    slug: string;
    githubSlug: string;
}
export declare function getTOC(muya: Muya): ITocItem[];
