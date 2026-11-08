import { useCallback, useState, type SetStateAction } from 'react';
import { create } from 'zustand';

// Session memory only: drafts never enter device storage or another account.
export const useSessionStore = create(() => ({
  values: {} as Record<string, unknown>,
  generation: 0,
}));

export function resetSessionState() {
  useSessionStore.setState((state) => ({
    values: {},
    generation: state.generation + 1,
  }));
}

export function clearSessionValues(prefix: string) {
  useSessionStore.setState((state) => ({
    values: Object.fromEntries(
      Object.entries(state.values).filter(([key]) => !key.startsWith(prefix)),
    ),
  }));
}

export function useSessionValue<T>(key: string, initial: T | (() => T)) {
  const [fallback] = useState(initial);
  const stored = useSessionStore((state) => state.values[key]);
  const generation = useSessionStore((state) => state.generation);
  const setValue = useCallback(
    (next: SetStateAction<T>) => {
      useSessionStore.setState((state) => {
        if (state.generation !== generation) return state;
        const previous = Object.hasOwn(state.values, key)
          ? (state.values[key] as T)
          : fallback;
        const value =
          typeof next === 'function'
            ? (next as (value: T) => T)(previous)
            : next;
        return { values: { ...state.values, [key]: value } };
      });
    },
    [key, fallback, generation],
  );
  return [stored === undefined ? fallback : (stored as T), setValue] as const;
}
