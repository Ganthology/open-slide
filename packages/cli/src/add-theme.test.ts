import { describe, expect, it } from 'vitest';
import { isValidThemeSlug, listBundledThemes } from './add-theme.ts';

describe('isValidThemeSlug', () => {
  it('accepts kebab-case slugs', () => {
    expect(isValidThemeSlug('aurora')).toBe(true);
    expect(isValidThemeSlug('bright-sans')).toBe(true);
    expect(isValidThemeSlug('sticker-pop')).toBe(true);
  });

  it('rejects invalid slugs', () => {
    expect(isValidThemeSlug('')).toBe(false);
    expect(isValidThemeSlug('Aurora')).toBe(false);
    expect(isValidThemeSlug('bright_sans')).toBe(false);
    expect(isValidThemeSlug('-aurora')).toBe(false);
    expect(isValidThemeSlug('aurora-')).toBe(false);
  });
});

describe('listBundledThemes', () => {
  it('lists themes shipped with the CLI', async () => {
    const themes = await listBundledThemes();
    expect(themes).toContain('aurora');
    expect(themes).toContain('bright-sans');
    expect(themes).toContain('replit');
    expect(themes).toContain('sticker-pop');
  });
});
