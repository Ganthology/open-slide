import { describe, expect, it } from 'vitest';
import {
  countPresentablePages,
  findNextPresentableIndex,
  presentableIndexToAuthorIndex,
  presentablePosition,
  snapToPresentableIndex,
} from './page-visibility';
import type { Page } from './sdk';

const visible = { hidden: false } as Page;
const hidden = { hidden: true } as Page;

describe('page-visibility', () => {
  const pages = [visible, hidden, visible, hidden, visible] as Page[];

  it('counts presentable pages', () => {
    expect(countPresentablePages(pages)).toBe(3);
  });

  it('skips hidden pages when moving forward', () => {
    expect(findNextPresentableIndex(pages, 0)).toBe(2);
    expect(findNextPresentableIndex(pages, 2)).toBe(4);
    expect(findNextPresentableIndex(pages, 4)).toBeNull();
  });

  it('snaps jumps onto the nearest visible page', () => {
    expect(snapToPresentableIndex(pages, 1)).toBe(2);
    expect(snapToPresentableIndex(pages, 3)).toBe(4);
  });

  it('maps presentable positions back to author indices', () => {
    expect(presentablePosition(pages, 4)).toBe(3);
    expect(presentableIndexToAuthorIndex(pages, 2)).toBe(4);
  });
});
