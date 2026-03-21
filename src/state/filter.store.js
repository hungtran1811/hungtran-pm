export function createFilterStore(initialState = {}) {
  const listeners = new Set();
  let state = { ...initialState };

  function notify() {
    listeners.forEach((listener) => listener({ ...state }));
  }

  return {
    getState() {
      return { ...state };
    },
    set(partialState) {
      state = { ...state, ...partialState };
      notify();
    },
    reset() {
      state = { ...initialState };
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
