import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { isValidThemeSlug, listBundledThemes } from './add-theme.ts';
import {
  parseGithubSource,
  resolveBundledTheme,
  resolveThemeSource,
  writeThemeFiles,
} from './theme-source.ts';

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

describe('parseGithubSource', () => {
  it('parses github: shorthand', () => {
    expect(parseGithubSource('github:1weiho/awesome-open-slide/themes/aurora')).toEqual({
      owner: '1weiho',
      repo: 'awesome-open-slide',
      ref: 'main',
      path: 'themes/aurora',
    });
  });

  it('parses github: shorthand with ref', () => {
    expect(parseGithubSource('github:1weiho/awesome-open-slide/themes/aurora@v1')).toEqual({
      owner: '1weiho',
      repo: 'awesome-open-slide',
      ref: 'v1',
      path: 'themes/aurora',
    });
  });

  it('parses github tree URLs', () => {
    expect(
      parseGithubSource('https://github.com/1weiho/awesome-open-slide/tree/main/themes/aurora'),
    ).toEqual({
      owner: '1weiho',
      repo: 'awesome-open-slide',
      ref: 'main',
      path: 'themes/aurora',
    });
  });
});

describe('resolveThemeSource', () => {
  let tempRoot = '';

  afterEach(async () => {
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
    tempRoot = '';
  });

  it('resolves bundled themes without --from', async () => {
    const source = await resolveThemeSource({ slug: 'aurora', cwd: process.cwd() });
    expect(source.label).toBe('bundled');
    expect(source.files.some((file) => file.name === 'aurora.md')).toBe(true);
  });

  it('resolves local community themes from --from', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'open-slide-theme-'));
    const sourceDir = join(tempRoot, 'themes');
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, 'my-theme.md'), '# My Theme\n', 'utf8');
    await writeFile(join(sourceDir, 'my-theme.demo.tsx'), 'export default [];\n', 'utf8');

    const source = await resolveThemeSource({
      slug: 'my-theme',
      cwd: tempRoot,
      from: './themes',
    });

    expect(source.label).toBe('./themes');
    expect(source.files.map((file) => file.name)).toEqual(['my-theme.md', 'my-theme.demo.tsx']);
  });

  it('writes resolved theme files into the target themes dir', async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'open-slide-theme-'));
    const bundled = await resolveBundledTheme('aurora');
    if (!bundled) throw new Error('expected bundled aurora theme');

    const written = await writeThemeFiles({
      slug: 'aurora',
      cwd: tempRoot,
      themesDir: 'themes',
      force: false,
      source: bundled,
    });

    expect(written).toContain('aurora.md');
    expect(written).toContain('aurora.demo.tsx');
  });
});
