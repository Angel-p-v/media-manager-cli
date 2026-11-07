#!/usr/bin/env node
import process from 'node:process';

import { Command, CommanderError } from 'commander';

import { generateCompletion } from './commands/completion.js';
import { runConfigCommand } from './commands/config.js';
import {
  runDbBackupCommand,
  runDbOptimizeCommand,
  runDbRestoreCommand,
  runDbStatsCommand,
} from './commands/db.js';
import { runDoctorCommand } from './commands/doctor.js';
import { reportFatalError } from './commands/errorHandler.js';
import { runIndexCommand } from './commands/index.js';
import { runListCommand } from './commands/list.js';
import {
  parseMediaType,
  parseNonNegativeInteger,
  parsePositiveInteger,
  parseSortOrder,
} from './commands/options.js';
import { runPlaylistCommand, type PlaylistCommandOptions } from './commands/playlist.js';
import { runSelfUpdateCommand } from './commands/self-update.js';
import { runShowCommand } from './commands/show.js';
import { loadConfig, resolveConfigPath } from './core/config/loader.js';
import { getVersion } from './shared/version.js';
import { runTui, defaultLogFile } from './ui/run.js';

const program = new Command()
  .name('mm')
  .description('Media Manager — terminal multimedia content manager (series and movies)')
  .version(getVersion(), '-V, --version', 'shows the version')
  .option('-v, --verbose', 'enables debug logs and error stacks')
  .option('--log-file <path>', 'writes logs to a file with automatic rotation (10 MB)')
  .showHelpAfterError()
  .addHelpText(
    'before',
    '\nCommand index:\n  list / show   browse the library\n  index         keep the library up to date\n  doctor        diagnosis\n  config        settings\n  db / self-update / completion  advanced utilities\n',
  )
  .addHelpText(
    'after',
    '\nUsage examples:\n  mm                              opens the interactive interface (TUI)\n  mm list                         lists all indexed titles\n  mm show 1                       shows the detail of title #1\n  mm index                        indexes the entire library\n  mm doctor                       diagnoses and repairs the library\n  mm completion bash              generates autocomplete script for bash\n\nExit codes:\n  0  success\n  1  execution error\n  2  incorrect usage\n',
  )
  .exitOverride();

// Commander keeps global options in the program; they are copied to the subcommand
// so that all `run*Command(options)` receive the same `verbose` and `logFile`.
program.hook('preAction', (thisCommand, actionCommand) => {
  const opts = thisCommand.opts();
  if (opts.verbose === true) {
    actionCommand.setOptionValue('verbose', true);
  }
  if (opts.logFile !== undefined) {
    actionCommand.setOptionValue('logFile', opts.logFile);
  }
});

program
  .command('config')
  .description('shows and edits the effective configuration')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--path', 'shows only the configuration file path')
  .option('--validate', 'validates the configuration file and exits')
  .option('--json', 'JSON output')
  .option('--init', 'creates the default configuration file if it does not exist')
  .option('--set <key=value>', 'sets a nested key, e.g. player.default=vlc')
  .action(runConfigCommand);

program
  .command('index')
  .description('indexes the library (scans folders and adds titles to the DB)')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--dry-run', 'simulates indexing without writing to the database')
  .option('--root <path>', 'indexes only the indicated root')
  .option('--folder <path>', 'indexes only the indicated folder within the root')
  .option('--json', 'JSON output')
  .action(runIndexCommand);

program
  .command('list')
  .description('lists library titles with filters and pagination')
  .option('-c, --config <path>', 'configuration file to use')
  .option('-t, --type <type>', 'filters by type (series, movie)', parseMediaType)
  .option('--sort <order>', 'orders by title, added or recent', parseSortOrder)
  .option('--limit <n>', 'maximum number of results', parsePositiveInteger)
  .option('--offset <n>', 'results to skip', parseNonNegativeInteger)
  .option('--json', 'JSON output')
  .option('--export <format>', 'exports to file: json or csv')
  .action(runListCommand);

program
  .command('show')
  .description('shows the complete detail of a title (metadata and files)')
  .argument('<id-or-title>', 'numeric ID or title to query')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--json', 'JSON output')
  .action(runShowCommand);

program
  .command('playlist <titles...>')
  .description('plays multiple titles in sequence (playlist)')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--dry-run', 'shows what would be played without launching anything')
  .option('--json', 'JSON output')
  .action((rawOptions: Record<string, unknown>, titles: string[]) => {
    const options = {
      ...rawOptions,
      _: titles,
    };
    return runPlaylistCommand(titles, options as PlaylistCommandOptions);
  });

program
  .command('doctor')
  .description('diagnosis and repair of the library (index and metadata)')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--json', 'JSON output')
  .option('--full-hash', 'full hash to confirm duplicates')
  .option('--prune-missing', 'removes missing files from the index')
  .option('-y, --yes', 'does not ask for confirmation for --prune-missing')
  .action(runDoctorCommand);

program
  .command('self-update')
  .description('searches and installs updates from GitHub Releases')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--check', 'only checks if an update is available')
  .option('--dry-run', 'shows what would be downloaded without installing')
  .action(runSelfUpdateCommand);

program
  .command('completion <shell>')
  .description('generates shell autocomplete script (bash, zsh, fish)')
  .action((shell: string) => {
    try {
      console.log(generateCompletion(shell));
    } catch (error: unknown) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
  });

const dbCommand = program.command('db').description('operations on the local database');

dbCommand
  .command('stats')
  .description('shows the size and content of the index')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--json', 'JSON output')
  .action(runDbStatsCommand);

dbCommand
  .command('optimize')
  .description('updates statistics and compacts the database')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--vacuum', 'compacts the file (may take a while)')
  .option('--json', 'JSON output')
  .action(runDbOptimizeCommand);

dbCommand
  .command('backup')
  .description('creates a backup of the database')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--label <label>', 'label to identify the backup', 'manual')
  .option('--json', 'JSON output')
  .action(runDbBackupCommand);

dbCommand
  .command('restore')
  .description('restores the database from a backup file')
  .option('-c, --config <path>', 'configuration file to use')
  .option('--from <path>', 'path to the backup file to restore', '')
  .option('--json', 'JSON output')
  .action(runDbRestoreCommand);

async function main(): Promise<void> {
  // Without a subcommand, the interactive interface opens; with a subcommand, the headless CLI.
  const rawArgs = process.argv.slice(2);
  const verbose = rawArgs.includes('--verbose') || rawArgs.includes('-v');
  const logFile = verbose ? defaultLogFile() : undefined;
  const args = rawArgs.filter((arg) => arg !== '--verbose' && arg !== '-v');
  if (args.length === 0) {
    const configPath = resolveConfigPath();
    const config = await loadConfig({ configPath });
    const tuiOptions: { verbose?: boolean; logFile?: string } = { verbose };
    if (logFile !== undefined) {
      tuiOptions.logFile = logFile;
    }
    await runTui(config, configPath, tuiOptions);
    return;
  }

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    // Commander has already printed the help, version, or usage error. Only `help`
    // and `--version` exit with 0; the rest are usage errors (2).
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode === 0 ? 0 : 2;
      return;
    }
    throw error;
  }
}

main().catch((error: unknown) => {
  reportFatalError(error, { verbose: program.opts().verbose === true });
  process.exitCode = 1;
});
