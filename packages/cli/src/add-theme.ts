import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLED_THEMES_DIR = resolve(HERE, '..', 'themes');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface AddThemeOptions {
  slug: string;
  cwd: string;
  themesDir: string;
  force: boolean;
}

export function isValidThemeSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export async function listBundledThemes(): Promise<string[]> {
  if (!existsSync(BUNDLED_THEMES_DIR)) return [];
  const entries = await readdir(BUNDLED_THEMES_DIR);
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.endsWith('.md')) {
      ids.add(basename(entry, '.md'));
    }
  }
  return [...ids].sort();
}

function bundledThemeFiles(slug: string): string[] {
  const files = [`${slug}.md`, `${slug}.demo.tsx`];
  return files.filter((name) => existsSync(join(BUNDLED_THEMES_DIR, name)));
}

export async function addTheme(opts: AddThemeOptions): Promise<void> {
  const { slug, cwd, themesDir, force } = opts;

  if (!isValidThemeSlug(slug)) {
    throw new Error(
      `Invalid theme slug "${slug}". Use kebab-case letters and numbers (e.g. aurora, bright-sans).`,
    );
  }

  const bundled = bundledThemeFiles(slug);
  if (bundled.length === 0) {
    const available = await listBundledThemes();
    const hint =
      available.length > 0
        ? ` Available themes: ${available.join(', ')}.`
        : ' No bundled themes found in this CLI install.';
    throw new Error(`Theme "${slug}" is not bundled.${hint}`);
  }

  const targetDir = resolve(cwd, themesDir);
  await mkdir(targetDir, { recursive: true });

  const collisions = bundled.filter((name) => existsSync(join(targetDir, name)));
  if (collisions.length > 0 && !force) {
    throw new Error(
      `Theme files already exist in ${themesDir}/: ${collisions.join(', ')}. Pass --force to overwrite.`,
    );
  }

  for (const name of bundled) {
    await copyFile(join(BUNDLED_THEMES_DIR, name), join(targetDir, name));
  }

  process.stdout.write(
    `${chalk.green('✓')} Added theme ${chalk.bold(slug)} to ${chalk.cyan(`${themesDir}/`)}\n`,
  );
  for (const name of bundled) {
    process.stdout.write(`  ${chalk.dim('·')} ${name}\n`);
  }
}
