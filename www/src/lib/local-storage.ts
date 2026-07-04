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
