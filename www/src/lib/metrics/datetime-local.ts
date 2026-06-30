function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Format an epoch second value for `<input type="datetime-local" />`. */
export function epochToDatetimeLocalValue(epoch: number): string {
  const date = new Date(epoch * 1000);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/** Parse a `<input type="datetime-local" />` value to epoch seconds. */
export function datetimeLocalValueToEpoch(value: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return Math.floor(date.getTime() / 1000);
}
