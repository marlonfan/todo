type TLevel = 'error' | 'warn' | 'log' | 'info';
type Ilogger = Record<TLevel, (...args: string[]) => void>;
declare function namespace(ns: string): Ilogger;
declare namespace namespace {
    var level: (newLevel: TLevel) => void;
}
export default namespace;
