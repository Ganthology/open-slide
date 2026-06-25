import { existsSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const BUNDLED_THEMES_DIR = resolve(HERE, '..', 'themes');

export const DEFAULT_THEME_REGISTRY =
  'https://raw.githubusercontent.com/1weiho/awesome-open-slide/main/registry.json';

export type ThemeFile = {
  name: string;
  content?: string;
  sourcePath?: string;
};

export type ThemeRegistry = {
  version?: number;
  themes: ThemeRegistryEntry[];
};

export type ThemeRegistryEntry = {
  id: string;
  name?: string;
  description?: string;
  source: string;
};

export type ResolvedThemeSource = {
  label: string;
  files: ThemeFile[];
};

const GITHUB_PREFIX = 'github:';
const GITHUB_TREE_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:tree|blob)\/([^/]+)\/(.+?)\/?$/;

export function parseGithubSource(value: string): {
  owner: string;
  repo: string;
  ref: string;
  path: string;
} {
  const trimmed = value.trim();
  if (trimmed.startsWith(GITHUB_PREFIX)) {
    const rest = trimmed.slice(GITHUB_PREFIX.length);
    const at = rest.lastIndexOf('@');
    const ref = at >= 0 ? rest.slice(at + 1) : 'main';
    const withoutRef = at >= 0 ? rest.slice(0, at) : rest;
    const parts = withoutRef.split('/').filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Invalid GitHub source "${value}". Use github:owner/repo/path/to/theme.`);
    }
    const owner = parts[0];
    const repo = parts[1];
    if (!owner || !repo) {
      throw new Error(`Invalid GitHub source "${value}". Use github:owner/repo/path/to/theme.`);
    }
    return {
      owner,
      repo,
      ref,
      path: parts.slice(2).join('/'),
    };
  }

  const treeMatch = trimmed.match(GITHUB_TREE_RE);
  if (treeMatch) {
    const owner = treeMatch[1];
    const repo = treeMatch[2];
    const ref = treeMatch[3];
    const path = treeMatch[4]?.replace(/\/$/, '') ?? '';
    if (!owner || !repo || !ref) {
      throw new Error(`Invalid GitHub URL "${value}".`);
    }
    return { owner, repo, ref, path };
  }

  throw new Error(
    `Unsupported remote source "${value}". Use github:owner/repo/path or a github.com/.../tree/... URL.`,
  );
}

function themeFileNames(slug: string): string[] {
  return [`${slug}.md`, `${slug}.demo.tsx`];
}

function bundledPaths(slug: string): ThemeFile[] {
  return themeFileNames(slug)
    .filter((name) => existsSync(join(BUNDLED_THEMES_DIR, name)))
    .map((name) => ({ name, sourcePath: join(BUNDLED_THEMES_DIR, name) }));
}

function localPaths(slug: string, from: string, cwd: string): ThemeFile[] {
  const abs = resolve(cwd, from);
  if (!existsSync(abs)) {
    throw new Error(`Theme source path not found: ${from}`);
  }

  const dir = abs.endsWith('.md') ? dirname(abs) : abs;
  const files = themeFileNames(slug)
    .filter((name) => existsSync(join(dir, name)))
    .map((name) => ({ name, sourcePath: join(dir, name) }));

  if (files.length === 0) {
    throw new Error(
      `No theme files for "${slug}" under ${from}. Expected ${slug}.md (and optional ${slug}.demo.tsx).`,
    );
  }
  if (!files.some((file) => file.name.endsWith('.md'))) {
    throw new Error(`Theme markdown missing: expected ${slug}.md under ${from}.`);
  }

  return files;
}

async function fetchGithubFile(
  owner: string,
  repo: string,
  ref: string,
  path: string,
): Promise<string | null> {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url} (${res.status} ${res.statusText}).`);
  }
  return res.text();
}

async function fetchGithubTheme(slug: string, source: string): Promise<ThemeFile[]> {
  const { owner, repo, ref, path } = parseGithubSource(source);
  const refs = ref === 'main' ? ['main', 'master'] : [ref];
  const wanted = themeFileNames(slug);
  let lastError: string | null = null;

  for (const branch of refs) {
    const files: ThemeFile[] = [];
    for (const name of wanted) {
      const remotePath = path ? `${path}/${name}` : name;
      const content = await fetchGithubFile(owner, repo, branch, remotePath);
      if (content === null) {
        if (name.endsWith('.md')) {
          lastError = `Theme "${slug}" not found at github:${owner}/${repo}/${path} on ${branch}.`;
          files.length = 0;
          break;
        }
        continue;
      }
      files.push({ name, content });
    }
    if (files.some((file) => file.name.endsWith('.md'))) {
      return files;
    }
  }

  throw new Error(lastError ?? `Theme "${slug}" could not be fetched from ${source}.`);
}

export async function fetchThemeRegistry(url: string): Promise<ThemeRegistry> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch theme registry (${res.status} ${res.statusText}).`);
  }
  const data = (await res.json()) as ThemeRegistry;
  if (!Array.isArray(data.themes)) {
    throw new Error('Theme registry is invalid: expected a "themes" array.');
  }
  return data;
}

export function findRegistryEntry(
  registry: ThemeRegistry,
  slug: string,
): ThemeRegistryEntry | undefined {
  return registry.themes.find((entry) => entry.id === slug);
}

export async function resolveBundledTheme(slug: string): Promise<ResolvedThemeSource | null> {
  const files = bundledPaths(slug);
  if (files.length === 0) return null;
  return { label: 'bundled', files };
}

export async function resolveThemeSource(opts: {
  slug: string;
  cwd: string;
  from?: string;
  registryUrl?: string;
}): Promise<ResolvedThemeSource> {
  if (opts.from) {
    const trimmed = opts.from.trim();
    if (trimmed.startsWith(GITHUB_PREFIX) || trimmed.includes('github.com/')) {
      const files = await fetchGithubTheme(opts.slug, trimmed);
      return { label: trimmed, files };
    }
    const files = localPaths(opts.slug, trimmed, opts.cwd);
    return { label: trimmed, files };
  }

  const bundled = await resolveBundledTheme(opts.slug);
  if (bundled) return bundled;

  if (opts.registryUrl) {
    const registry = await fetchThemeRegistry(opts.registryUrl);
    const entry = findRegistryEntry(registry, opts.slug);
    if (!entry) {
      const ids = registry.themes.map((theme) => theme.id).sort();
      const hint = ids.length > 0 ? ` Available: ${ids.join(', ')}.` : '';
      throw new Error(`Theme "${opts.slug}" is not in the registry.${hint}`);
    }
    const files = await fetchGithubTheme(opts.slug, entry.source);
    return { label: entry.source, files };
  }

  throw new Error(
    `Theme "${opts.slug}" is not bundled. Install a community theme with --from github:owner/repo/themes/${opts.slug} or --registry <url>.`,
  );
}

export async function writeThemeFiles(opts: {
  slug: string;
  cwd: string;
  themesDir: string;
  force: boolean;
  source: ResolvedThemeSource;
}): Promise<string[]> {
  const targetDir = resolve(opts.cwd, opts.themesDir);
  await mkdir(targetDir, { recursive: true });

  const names = opts.source.files.map((file) => file.name);
  const collisions = names.filter((name) => existsSync(join(targetDir, name)));
  if (collisions.length > 0 && !opts.force) {
    throw new Error(
      `Theme files already exist in ${opts.themesDir}/: ${collisions.join(', ')}. Pass --force to overwrite.`,
    );
  }

  for (const file of opts.source.files) {
    const target = join(targetDir, file.name);
    if (file.sourcePath) {
      await copyFile(file.sourcePath, target);
    } else if (file.content !== undefined) {
      await writeFile(target, file.content, 'utf8');
    }
  }

  return names;
}

export async function listBundledThemes(): Promise<string[]> {
  if (!existsSync(BUNDLED_THEMES_DIR)) return [];
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(BUNDLED_THEMES_DIR);
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.endsWith('.md')) ids.add(basename(entry, '.md'));
  }
  return [...ids].sort();
}

export async function readRegistryThemeIds(registryUrl: string): Promise<string[]> {
  const registry = await fetchThemeRegistry(registryUrl);
  return registry.themes.map((entry) => entry.id).sort();
}
