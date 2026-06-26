declare const icons: {
    type: string;
    tooltip: string;
    icon: any;
}[];
export default icons;
export type Icon = typeof icons[number];
