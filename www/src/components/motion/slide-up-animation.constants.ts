const SLIDE_UP_STAGGER_MS = 120;

export function staggeredSlideUpDelay(index: number): number {
  return index * SLIDE_UP_STAGGER_MS;
}
