import { IEvent, IListeners, Listener } from './types';
declare class EventCenter {
    events: IEvent[];
    listeners: IListeners;
    get eventId(): string;
    /**
     * [attachDOMEvent] bind event listener to target, and return a unique ID,
     * this ID
     */
    attachDOMEvent(target: HTMLElement | Document, event: string, listener: EventListener, capture?: boolean | AddEventListenerOptions): string;
    /**
     * [detachDOMEvent removeEventListener]
     * @param  {[type]} eventId [unique eventId]
     */
    detachDOMEvent(eventId: string): false | undefined;
    /**
     * [detachAllDomEvents remove all the DOM events handler]
     */
    detachAllDomEvents(): void;
    /**
     * inner method for on and once
     */
    subscribe(event: string, listener: Listener, once?: boolean): void;
    /**
     * [on] on custom event
     */
    on(event: string, listener: Listener): void;
    /**
     * [off] off custom event
     */
    off(event: string, listener: Listener): void;
    /**
     * [once] subscribe event and listen once
     */
    once(event: string, listener: Listener): void;
    /**
     * emit custom event
     */
    emit(event: string, ...data: unknown[]): void;
    /**
     * Remove all pub/sub subscriptions. Called from muya.destroy() to
     * release listener closures so the host page can GC the Muya instance.
     */
    unsubscribeAll(): void;
    checkHasBind(cTarget: HTMLElement | Document, cEvent: string, cListener: EventListenerOrEventListenerObject, cCapture?: boolean | AddEventListenerOptions): boolean;
}
export default EventCenter;
