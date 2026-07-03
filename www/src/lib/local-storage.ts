function canUseLocalStorage(): boolean {
  return typeof window !== "undefined";
}

export function readLocalStorage(key: string): string | null {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorage(key: string, value: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function removeLocalStorage(key: string): void {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function readLocalStorageJson<T>(
  key: string,
  parse: (raw: unknown) => T | null,
): T | null {
  const raw = readLocalStorage(key);
  if (raw === null) {
    return null;
  }

  try {
    return parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalStorageJson(key: string, value: unknown): void {
  writeLocalStorage(key, JSON.stringify(value));
}
