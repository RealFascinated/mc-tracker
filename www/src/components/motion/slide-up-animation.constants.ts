const SLIDE_UP_STAGGER_MS = 80;
const SLIDE_UP_STAGGER_MAX_MS = 400;

export function staggeredSlideUpDelay(index: number): number {
  return Math.min(index * SLIDE_UP_STAGGER_MS, SLIDE_UP_STAGGER_MAX_MS);
}
