import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.hasAttribute('disabled')) return false;
      const style = window.getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none';
    });
}

export function useFocusTrap(active, containerRef, { initialFocusRef, restoreFocus = true } = {}) {
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!active || typeof document === 'undefined' || typeof window === 'undefined') return undefined;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusInitial = () => {
      const container = containerRef.current;
      if (!container) return;
      if (document.activeElement && container.contains(document.activeElement)) return;
      const target = initialFocusRef?.current || getFocusableElements(container)[0] || container;
      target?.focus?.({ preventScroll: true });
    };

    const frame = window.requestAnimationFrame(focusInitial);
    const handleKeyDown = (event) => {
      if (event.key !== 'Tab') return;
      const container = containerRef.current;
      if (!container) return;
      const focusable = getFocusableElements(container);
      if (focusable.length === 0) {
        event.preventDefault();
        container.focus?.({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (!container.contains(activeElement)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
        return;
      }
      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
        return;
      }
      if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown, true);
      const previous = previousFocusRef.current;
      if (restoreFocus && previous?.isConnected) {
        previous.focus?.({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocusRef, restoreFocus]);
}
