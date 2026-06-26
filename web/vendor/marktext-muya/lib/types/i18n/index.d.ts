import { Muya } from '../muya';
import { ILocale } from './types';
declare class I18n {
    muya: Muya;
    lang: string;
    resources: Record<string, ILocale['resource']>;
    constructor(muya: Muya, object: ILocale);
    t(key: string): string;
    locale(object: ILocale): void;
}
export default I18n;
