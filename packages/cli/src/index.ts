import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { Command } from 'commander';
import prompts from 'prompts';
import { addTheme, DEFAULT_THEME_REGISTRY, listAvailableThemes } from './add-theme.ts';
import { type InitOptions, init, isDirNonEmpty, sanitizeDirName } from './init.ts';
import { detectPackageManager, PACKAGE_MANAGERS, type PackageManager } from './package-manager.ts';

async function readVersion(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(await readFile(join(here, '..', 'package.json'), 'utf8')) as {
    version: string;
  };
  return pkg.version;
}

interface InitCliFlags {
  force?: boolean;
  name?: string;
  useNpm?: boolean;
  usePnpm?: boolean;
  useYarn?: boolean;
  useBun?: boolean;
  install?: boolean;
  git?: boolean;
}

function onCancel(): never {
  process.stdout.write(chalk.dim('\nCancelled.\n'));
  process.exit(130);
}

function packageManagerFromFlags(flags: InitCliFlags): PackageManager | undefined {
  const picks: PackageManager[] = [];
  if (flags.useNpm) picks.push('npm');
  if (flags.usePnpm) picks.push('pnpm');
  if (flags.useYarn) picks.push('yarn');
  if (flags.useBun) picks.push('bun');

  if (picks.length > 1) {
    throw new Error(
      `Only one of --use-npm / --use-pnpm / --use-yarn / --use-bun may be specified (got ${picks.map((p) => `--use-${p}`).join(', ')}).`,
    );
  }
  return picks[0];
}

async function runInit(dirArg: string | undefined, flags: InitCliFlags): Promise<void> {
  const isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);

  let dir = dirArg;
  const name = flags.name;
  let force = flags.force ?? false;
  let packageManager = packageManagerFromFlags(flags);

  if (isTTY && dir === undefined) {
    const answers = await prompts(
      {
        type: 'text',
        name: 'dir',
        message: 'Target directory',
        initial: '.',
      },
      { onCancel },
    );
    dir = answers.dir;
  }

  if (dir !== undefined) {
    const safe = sanitizeDirName(dir);
    if (safe !== dir) {
      if (!isTTY) {
        throw new Error(
          `Target directory "${dir}" contains characters that break shell commands (spaces, quotes, etc.). Try "${safe}" instead.`,
        );
      }
      process.stdout.write(
        `${chalk.yellow('!')} ${chalk.bold(`"${dir}"`)} has characters that confuse shells.\n` +
          `  Suggested: ${chalk.cyan(`"${safe}"`)}\n`,
      );
      const answers = await prompts(
        {
          type: 'text',
          name: 'dir',
          message: 'Directory name',
          initial: safe,
        },
        { onCancel },
      );
      dir = sanitizeDirName(answers.dir ?? safe);
    }
  }

  if (isTTY && packageManager === undefined && flags.install !== false) {
    const detected = detectPackageManager();
    const answers = await prompts(
      {
        type: 'select',
        name: 'packageManager',
        message: 'Package manager',
        choices: PACKAGE_MANAGERS.map((pm) => ({ title: pm, value: pm })),
        initial: PACKAGE_MANAGERS.indexOf(detected),
      },
      { onCancel },
    );
    packageManager = answers.packageManager as PackageManager | undefined;
  }

  const resolvedDir = dir ?? '.';
  const target = resolve(process.cwd(), resolvedDir);

  if (!force && (await isDirNonEmpty(target))) {
    if (!isTTY) {
      throw new Error(`Target ${target} is not empty. Pass --force to scaffold into it anyway.`);
    }
    const { overwrite } = await prompts(
      {
        type: 'confirm',
        name: 'overwrite',
        message: `${chalk.yellow(target)} is not empty. Scaffold into it anyway?`,
        initial: false,
      },
      { onCancel },
    );
    if (!overwrite) {
      process.stdout.write(chalk.dim('Aborted.\n'));
      return;
    }
    force = true;
  }

  const opts: InitOptions = {
    dir: resolvedDir,
    force,
    name,
    packageManager: packageManager ?? detectPackageManager(),
    install: flags.install !== false,
    git: flags.git !== false,
  };
  await init(opts);
}

interface AddThemeCliFlags {
  force?: boolean;
  list?: boolean;
  dir?: string;
  from?: string;
  registry?: string;
}

async function runAddTheme(slug: string | undefined, flags: AddThemeCliFlags): Promise<void> {
  const registryUrl = flags.registry ?? process.env.OPEN_SLIDE_THEME_REGISTRY;

  if (flags.list) {
    const { bundled, community } = await listAvailableThemes(registryUrl);
    if (bundled.length === 0 && community.length === 0) {
      process.stdout.write(chalk.dim('No themes found.\n'));
      return;
    }
    if (bundled.length > 0) {
      process.stdout.write(`${chalk.bold('Official themes')}\n`);
      for (const id of bundled) {
        process.stdout.write(`  ${chalk.cyan(id)}\n`);
      }
    }
    if (community.length > 0) {
      if (bundled.length > 0) process.stdout.write('\n');
      process.stdout.write(`${chalk.bold('Community themes')}\n`);
      for (const id of community) {
        process.stdout.write(`  ${chalk.cyan(id)}\n`);
      }
    }
    if (community.length === 0) {
      process.stdout.write(
        `\n${chalk.dim('Community themes: set --registry or OPEN_SLIDE_THEME_REGISTRY to a registry.json URL.')}\n`,
      );
    }
    return;
  }

  if (!slug) {
    throw new Error(
      'Theme slug required. Example: open-slide add-theme aurora — or open-slide add-theme my-theme --from github:owner/repo/themes/my-theme',
    );
  }

  await addTheme({
    slug,
    cwd: process.cwd(),
    themesDir: flags.dir ?? 'themes',
    force: flags.force ?? false,
    from: flags.from,
    registryUrl: registryUrl || undefined,
  });
}

export async function run(argv: string[]): Promise<void> {
  const version = await readVersion();

  const program = new Command();
  program
    .name('open-slide')
    .description('Scaffold and manage open-slide workspaces.')
    .version(version, '-v, --version', 'print version')
    .helpOption('-h, --help', 'show help')
    .showHelpAfterError(chalk.dim('(run `open-slide --help` for usage)'));

  program
    .command('init')
    .description('Create a new open-slide workspace')
    .argument('[dir]', 'target directory', undefined)
    .option('-f, --force', 'overwrite non-empty target directory', false)
    .option('-n, --name <name>', 'override package name (defaults to folder name)')
    .option('--use-npm', 'use npm to install dependencies')
    .option('--use-pnpm', 'use pnpm to install dependencies')
    .option('--use-yarn', 'use yarn to install dependencies')
    .option('--use-bun', 'use bun to install dependencies')
    .option('--no-install', 'skip dependency installation')
    .option('--no-git', 'skip git init and initial commit')
    .action(async (dir: string | undefined, flags: InitCliFlags) => {
      await runInit(dir, flags);
    });

  program
    .command('add-theme')
    .description('Install a theme into themes/')
    .argument('[slug]', 'theme id (e.g. aurora, bright-sans)')
    .option('-f, --force', 'overwrite existing theme files', false)
    .option('--list', 'list official and registry themes', false)
    .option('--dir <dir>', 'themes directory (default: themes)', 'themes')
    .option('--from <source>', 'local path or github:owner/repo/path (for community themes)')
    .option(
      '--registry <url>',
      `community registry.json URL (default env: OPEN_SLIDE_THEME_REGISTRY; suggested: ${DEFAULT_THEME_REGISTRY})`,
    )
    .action(async (slug: string | undefined, flags: AddThemeCliFlags) => {
      await runAddTheme(slug, flags);
    });

  await program.parseAsync(argv, { from: 'user' });
}
