import { useCallback, useState } from "react";

import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from "@/lib/local-storage";

type UseLocalStorageOptions<T> = {
  defaultValue: T;
  serialize: (value: T) => string;
  deserialize: (raw: string) => T | null;
  clearWhen?: (value: T) => boolean;
};

export function useLocalStorage<T>(
  key: string,
  {
    defaultValue,
    serialize,
    deserialize,
    clearWhen,
  }: UseLocalStorageOptions<T>,
): [T, (value: T | ((previous: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const raw = readLocalStorage(key);
    if (raw === null) {
      return defaultValue;
    }

    return deserialize(raw) ?? defaultValue;
  });

  const setValue = useCallback(
    (value: T | ((previous: T) => T)) => {
      setStoredValue((previous) => {
        const next =
          typeof value === "function"
            ? (value as (current: T) => T)(previous)
            : value;

        if (clearWhen?.(next)) {
          removeLocalStorage(key);
        } else {
          writeLocalStorage(key, serialize(next));
        }

        return next;
      });
    },
    [clearWhen, key, serialize],
  );

  return [storedValue, setValue];
}

export const localStorageStringOptions = {
  serialize: (value: string) => value,
  deserialize: (raw: string) => raw,
} as const;

export const localStorageJsonOptions = <T,>(parse: (raw: unknown) => T | null) =>
  ({
    serialize: (value: T) => JSON.stringify(value),
    deserialize: (raw: string) => {
      try {
        return parse(JSON.parse(raw));
      } catch {
        return null;
      }
    },
  }) as const;
