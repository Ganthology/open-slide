import chalk from 'chalk';
import {
  DEFAULT_THEME_REGISTRY,
  listBundledThemes,
  readRegistryThemeIds,
  resolveThemeSource,
  writeThemeFiles,
} from './theme-source.ts';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface AddThemeOptions {
  slug: string;
  cwd: string;
  themesDir: string;
  force: boolean;
  from?: string;
  registryUrl?: string;
}

export { DEFAULT_THEME_REGISTRY, listBundledThemes };

export function isValidThemeSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export async function addTheme(opts: AddThemeOptions): Promise<void> {
  const { slug, cwd, themesDir, force, from, registryUrl } = opts;

  if (!isValidThemeSlug(slug)) {
    throw new Error(
      `Invalid theme slug "${slug}". Use kebab-case letters and numbers (e.g. aurora, bright-sans).`,
    );
  }

  const source = await resolveThemeSource({ slug, cwd, from, registryUrl });
  const written = await writeThemeFiles({ slug, cwd, themesDir, force, source });

  process.stdout.write(
    `${chalk.green('✓')} Added theme ${chalk.bold(slug)} to ${chalk.cyan(`${themesDir}/`)}\n`,
  );
  process.stdout.write(`  ${chalk.dim('source:')} ${source.label}\n`);
  for (const name of written) {
    process.stdout.write(`  ${chalk.dim('·')} ${name}\n`);
  }
}

export async function listAvailableThemes(registryUrl?: string): Promise<{
  bundled: string[];
  community: string[];
}> {
  const bundled = await listBundledThemes();
  if (!registryUrl) return { bundled, community: [] };
  try {
    const community = await readRegistryThemeIds(registryUrl);
    return { bundled, community };
  } catch {
    return { bundled, community: [] };
  }
}
