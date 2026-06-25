import type { Page } from './sdk';

export function isPageHidden(page: Page): boolean {
  return page.hidden === true;
}

export function findNextPresentableIndex(pages: Page[], from: number): number | null {
  for (let i = from + 1; i < pages.length; i++) {
    if (!isPageHidden(pages[i])) return i;
  }
  return null;
}

export function findPrevPresentableIndex(pages: Page[], from: number): number | null {
  for (let i = from - 1; i >= 0; i--) {
    if (!isPageHidden(pages[i])) return i;
  }
  return null;
}

export function findFirstPresentableIndex(pages: Page[]): number | null {
  return findNextPresentableIndex(pages, -1);
}

export function findLastPresentableIndex(pages: Page[]): number | null {
  return findPrevPresentableIndex(pages, pages.length);
}

export function snapToPresentableIndex(
  pages: Page[],
  index: number,
  direction: 'forward' | 'backward' | 'nearest' = 'nearest',
): number {
  if (pages.length === 0) return 0;
  const clamped = Math.max(0, Math.min(pages.length - 1, index));
  if (!isPageHidden(pages[clamped])) return clamped;

  if (direction === 'forward' || direction === 'nearest') {
    const next = findNextPresentableIndex(pages, clamped);
    if (next !== null) return next;
  }
  if (direction === 'backward' || direction === 'nearest') {
    const prev = findPrevPresentableIndex(pages, clamped);
    if (prev !== null) return prev;
  }
  return clamped;
}

export function countPresentablePages(pages: Page[]): number {
  return pages.reduce((count, page) => count + (isPageHidden(page) ? 0 : 1), 0);
}

export function presentablePosition(pages: Page[], index: number): number {
  let pos = 0;
  for (let i = 0; i <= index && i < pages.length; i++) {
    if (!isPageHidden(pages[i])) pos++;
  }
  return pos;
}

export function presentableIndexToAuthorIndex(
  pages: Page[],
  presentableIndex: number,
): number | null {
  if (presentableIndex < 0) return null;
  let seen = 0;
  for (let i = 0; i < pages.length; i++) {
    if (!isPageHidden(pages[i])) {
      if (seen === presentableIndex) return i;
      seen++;
    }
  }
  return null;
}
