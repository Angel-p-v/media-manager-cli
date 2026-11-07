/** Generates shell autocomplete scripts for mm. */

import { ValidationError } from '../shared/errors.js';

export type CompletionShell = 'bash' | 'zsh' | 'fish';

/** Generates the autocomplete script for Bash. */
function generateBashCompletion(): string {
  return [
    '# media-manager shell completion for Bash',
    '',
    '_mm_completion() {',
    '  local cur prev words cword',
    '  _init_completion || return',
    '',
    '  local mm_cmds="index list search show play mark favorite tag doctor db watch config metadata completion"',
    '',
    '  case "${prev}" in',
    '    mm)',
    '      COMPREPLY=( $(compgen -W "${mm_cmds}" -- "${cur}") )',
    '      return 0',
    '      ;;',
    '    index|search|show|play|mark|favorite|tag|doctor|db|watch|config|metadata|completion)',
    '      # No additional subcommands for now',
    '      COMPREPLY=()',
    '      return 0',
    '      ;;',
    '    *)',
    '      COMPREPLY=()',
    '      ;;',
    '  esac',
    '}',
    '',
    'complete -F _mm_completion mm',
    '',
  ].join('\n');
}

/** Generates the autocomplete script for Zsh. */
function generateZshCompletion(): string {
  return [
    '#compdef mm',
    '',
    '# media-manager shell completion for Zsh',
    '',
    '_mm() {',
    '  local -a commands',
    '  commands=(',
    "    'index:index the library'",
    "    'list:list library titles'",
    "    'search:search titles'",
    "    'show:show title detail'",
    "    'play:play a title'",
    "    'mark:mark watched/unwatched status'",
    "    'favorite:mark as favorite'",
    "    'tag:manage tags'",
    "    'doctor:library diagnosis'",
    "    'db:database operations'",
    "    'watch:watch for library changes'",
    "    'config:show configuration'",
    "    'metadata:manage external metadata'",
    "    'self-update:auto-update'",
    "    'completion:generate autocomplete script'",
    "    'help:show help'",
    '  )',
    '',
    '  _arguments -s \\',
    "    '(-h --help)'{-h,--help}[shows help] \\",
    "    '(-V --version)'{-V,--version}[shows version] \\",
    "    '*: :_mm_commands'",
    '}',
    '',
    '# Define commands for completion',
    '_mm_commands() {',
    "  _values 'command' \\",
    "    'index[index the library]' \\",
    "    'list[list library titles]' \\",
    "    'search[search titles]' \\",
    "    'show[show title detail]' \\",
    "    'play[play a title]' \\",
    "    'mark[mark watched/unwatched status]' \\",
    "    'favorite[mark as favorite]' \\",
    "    'tag[manage tags]' \\",
    "    'doctor[library diagnosis]' \\",
    "    'db[database operations]' \\",
    "    'watch[watch for library changes]' \\",
    "    'config[show configuration]' \\",
    "    'metadata[manage external metadata]' \\",
    "    'self-update[auto-update]' \\",
    "    'completion[generate autocomplete script]' \\",
    "    'help[show help]'",
    '}',
    '',
  ].join('\n');
}

/** Generates the autocomplete script for Fish. */
function generateFishCompletion(): string {
  return [
    '# media-manager shell completion for Fish',
    '',
    'function __fish_mm_using_command',
    '  set -l cmd (commandline -opc)',
    '  test (count $cmd) -eq 1',
    'end',
    '',
    'function __fish_mm_using_command',
    '  set -l cmd (commandline -opc)',
    '  test (count $cmd) -eq 1',
    'end',
    '',
    "complete -c mm -f -a 'index' -d 'index the library'",
    "complete -c mm -f -a 'list' -d 'list library titles'",
    "complete -c mm -f -a 'search' -d 'search titles'",
    "complete -c mm -f -a 'show' -d 'show title detail'",
    "complete -c mm -f -a 'play' -d 'play a title'",
    "complete -c mm -f -a 'mark' -d 'mark watched/unwatched status'",
    "complete -c mm -f -a 'favorite' -d 'mark as favorite'",
    "complete -c mm -f -a 'tag' -d 'manage tags'",
    "complete -c mm -f -a 'doctor' -d 'library diagnosis'",
    "complete -c mm -f -a 'db' -d 'database operations'",
    "complete -c mm -f -a 'watch' -d 'watch for library changes'",
    "complete -c mm -f -a 'config' -d 'show configuration'",
    "complete -c mm -f -a 'metadata' -d 'manage external metadata'",
    "complete -c mm -f -a 'self-update' -d 'auto-update'",
    "complete -c mm -f -a 'completion' -d 'generate autocomplete script'",
    "complete -c mm -f -a 'help' -d 'show help'",
    '',
  ].join('\n');
}

/**
 * Generates the autocomplete script for the specified shell.
 *
 * @param shell - shell name ('bash', 'zsh', 'fish')
 * @returns the autocomplete script as a string
 * @throws Error if the shell is not supported
 */
export function generateCompletion(shell: string): string {
  switch (shell) {
    case 'bash':
      return generateBashCompletion();
    case 'zsh':
      return generateZshCompletion();
    case 'fish':
      return generateFishCompletion();
    default:
      throw new ValidationError(
        'Unsupported shell: ' + String(shell) + '. Use "bash", "zsh" or "fish".',
      );
  }
}

/** List of supported shells. */
export const supportedShells: CompletionShell[] = ['bash', 'zsh', 'fish'];
