export function toolStatusLabel(name: string): string {
  return name.replaceAll("_", " ");
}

export function formatTokenCountFull(value: number): string {
  return value.toLocaleString();
}
