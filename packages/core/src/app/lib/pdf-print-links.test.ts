import { describe, expect, it } from 'vitest';
import { normalizeDetectedUrl, splitTextIntoLinkSegments } from './pdf-print-links';

describe('normalizeDetectedUrl', () => {
  it('keeps https URLs as-is', () => {
    expect(normalizeDetectedUrl('https://example.com/docs')).toEqual({
      href: 'https://example.com/docs',
      display: 'https://example.com/docs',
    });
  });

  it('prefixes www URLs with https', () => {
    expect(normalizeDetectedUrl('www.example.com')).toEqual({
      href: 'https://www.example.com',
      display: 'www.example.com',
    });
  });

  it('leaves trailing punctuation outside the href', () => {
    expect(normalizeDetectedUrl('https://example.com/docs).')).toEqual({
      href: 'https://example.com/docs',
      display: 'https://example.com/docs).',
    });
  });
});

describe('splitTextIntoLinkSegments', () => {
  it('splits mixed text and URLs', () => {
    expect(splitTextIntoLinkSegments('Visit https://example.com/docs today.')).toEqual([
      { type: 'text', value: 'Visit ' },
      {
        type: 'url',
        display: 'https://example.com/docs',
        href: 'https://example.com/docs',
      },
      { type: 'text', value: ' today.' },
    ]);
  });

  it('returns plain text when no URL is present', () => {
    expect(splitTextIntoLinkSegments('no links here')).toEqual([
      { type: 'text', value: 'no links here' },
    ]);
  });
});
