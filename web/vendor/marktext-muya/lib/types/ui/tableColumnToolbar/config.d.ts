declare const icons: {
    type: string;
    tooltip: string;
    icon: any;
}[];
export type TableColumnToolIcon = typeof icons[number];
export default icons;
