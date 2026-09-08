"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * `true` once the component has hydrated on the client, `false` during SSR and
 * the first client render. Avoids hydration mismatches for browser-only UI
 * (theme icons, localStorage-backed state) without setState-in-effect.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

const listeners = new Set<() => void>();

function subscribeToStorage(callback: () => void) {
  listeners.add(callback);
  const onStorage = () => callback();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Boolean preference persisted in localStorage, hydration-safe. */
export function useLocalStorageFlag(key: string, fallback = false): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null ? fallback : raw === "1";
      } catch {
        return fallback;
      }
    },
    () => fallback
  );

  const setValue = (next: boolean) => {
    try {
      window.localStorage.setItem(key, next ? "1" : "0");
    } catch {
      // storage unavailable (private mode); UI just won't persist
    }
    listeners.forEach((l) => l());
  };

  return [value, setValue];
}
