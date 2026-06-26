declare const icons: {
    type: string;
    tooltip: string;
    shortcut: string;
    icon: any;
}[];
export type FormatToolIcon = typeof icons[number];
export default icons;
