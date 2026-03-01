const listeners = new Set();

let state = {
  open: false,
  query: '',
};

function emit() {
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      console.error('search overlay listener failed:', error);
    }
  });
}

export function subscribeSearchOverlay(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

export function openSearchDialog(initialQuery = '') {
  state = {
    open: true,
    query: String(initialQuery || ''),
  };
  emit();
}

export function closeSearchDialog() {
  state = {
    ...state,
    open: false,
  };
  emit();
}
