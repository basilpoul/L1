// Shell Executor - Main execution engine for the Linux simulator shell
import type { VirtualFileSystem } from '../vfs/fileSystem';
import type { ShellState, CommandResult } from '../types';
import { tokenize } from './lexer';
import { parseTokens } from './parser';
import { expandVariables } from './environment';
import { registry } from './commandRegistry';
import type { ExecutionContext } from './commandRegistry';
import type { Pipeline, PipelineStage } from './parser';

/**
 * Expand aliases in the input string.
 * Only expands the first word if it matches an alias.
 * Prevents infinite recursion by tracking already-expanded aliases.
 */
function expandAliases(input: string, aliases: Record<string, string>): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const expanded = new Set<string>();
  let result = trimmed;

  // Iteratively expand the first word against aliases
  for (let iteration = 0; iteration < 20; iteration++) {
    const spaceIdx = result.indexOf(' ');
    const firstWord = spaceIdx === -1 ? result : result.substring(0, spaceIdx);
    const rest = spaceIdx === -1 ? '' : result.substring(spaceIdx);

    if (aliases[firstWord] && !expanded.has(firstWord)) {
      expanded.add(firstWord);
      result = aliases[firstWord] + rest;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Resolve a file path relative to the current working directory.
 */
function resolvePath(filepath: string, cwd: string): string {
  if (filepath.startsWith('/')) return filepath;

  const parts = cwd.split('/').filter(Boolean);
  const segments = filepath.split('/');

  for (const seg of segments) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') {
      parts.pop();
    } else {
      parts.push(seg);
    }
  }

  return '/' + parts.join('/');
}

/**
 * Execute a single pipeline stage (one command).
 */
async function executeStage(
  stage: PipelineStage,
  shellState: ShellState,
  vfs: VirtualFileSystem,
  context: ExecutionContext,
  stdin?: string
): Promise<CommandResult> {
  const { command } = stage;
  const cmdName = command.command;

  // Built-in: export VAR=value
  if (cmdName === 'export') {
    for (const arg of command.rawArgs) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const varName = arg.substring(0, eqIdx);
        const varValue = arg.substring(eqIdx + 1);
        shellState.env[varName] = varValue;
      }
    }
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Built-in: unset VAR
  if (cmdName === 'unset') {
    for (const arg of command.rawArgs) {
      delete shellState.env[arg];
    }
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Built-in: alias name='value' or alias (list all)
  if (cmdName === 'alias') {
    if (command.rawArgs.length === 0) {
      // List all aliases
      const lines = Object.entries(shellState.aliases)
        .map(([name, value]) => `alias ${name}='${value}'`)
        .join('\n');
      return { stdout: lines, stderr: '', exitCode: 0 };
    }
    for (const arg of command.rawArgs) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        const name = arg.substring(0, eqIdx);
        let value = arg.substring(eqIdx + 1);
        // Strip surrounding quotes if present
        if (
          (value.startsWith("'") && value.endsWith("'")) ||
          (value.startsWith('"') && value.endsWith('"'))
        ) {
          value = value.substring(1, value.length - 1);
        }
        shellState.aliases[name] = value;
      }
    }
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Built-in: unalias name
  if (cmdName === 'unalias') {
    for (const arg of command.rawArgs) {
      delete shellState.aliases[arg];
    }
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Built-in: cd
  if (cmdName === 'cd') {
    let target: string;
    const arg = command.rawArgs[0];

    if (!arg || arg === '~') {
      target = shellState.env['HOME'] || '/home/user';
    } else if (arg === '-') {
      target = shellState.previousDir || shellState.cwd;
    } else if (arg.startsWith('~')) {
      target = (shellState.env['HOME'] || '/home/user') + arg.substring(1);
    } else {
      target = resolvePath(arg, shellState.cwd);
    }

    // Normalize the path
    target = normalizePath(target);

    // Check if directory exists in VFS
    try {
      const node = vfs.getNode(target);
      if (!node || node.type !== 'dir') {
        return {
          stdout: '',
          stderr: `cd: ${arg}: Not a directory`,
          exitCode: 1,
        };
      }
    } catch {
      return {
        stdout: '',
        stderr: `cd: ${arg}: No such file or directory`,
        exitCode: 1,
      };
    }

    shellState.previousDir = shellState.cwd;
    shellState.cwd = target;
    shellState.env['PWD'] = target;
    shellState.env['OLDPWD'] = shellState.previousDir;

    return { stdout: arg === '-' ? target : '', stderr: '', exitCode: 0 };
  }

  // Look up command in registry
  const cmdInfo = registry.get(cmdName);
  if (!cmdInfo) {
    return {
      stdout: '',
      stderr: `${cmdName}: command not found`,
      exitCode: 127,
    };
  }

  // Execute the command handler
  try {
    const result = await cmdInfo.handler(
      command.args,
      command.flags,
      shellState,
      vfs,
      stdin,
      context
    );
    return result;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      stdout: '',
      stderr: `${cmdName}: ${message}`,
      exitCode: 1,
    };
  }
}

/**
 * Normalize a path: resolve . and .. segments, ensure leading /.
 */
function normalizePath(path: string): string {
  const parts = path.split('/').filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  return '/' + resolved.join('/');
}

/**
 * Execute a full pipeline (multiple stages connected by pipes).
 */
async function executePipeline(
  pipeline: Pipeline,
  shellState: ShellState,
  vfs: VirtualFileSystem,
  context: ExecutionContext
): Promise<CommandResult> {
  let stdin: string | undefined = undefined;
  let lastResult: CommandResult = { stdout: '', stderr: '', exitCode: 0 };

  for (let i = 0; i < pipeline.segments.length; i++) {
    const stage = pipeline.segments[i];
    const isLast = i === pipeline.segments.length - 1;

    lastResult = await executeStage(stage, shellState, vfs, context, stdin);

    // Handle redirects on this stage
    for (const redirect of stage.redirects) {
      const targetPath = resolvePath(redirect.target, shellState.cwd);
      try {
        if (redirect.type === '>>') {
          // Append
          try {
            const existing = vfs.readFile(targetPath);
            vfs.writeFile(targetPath, existing + lastResult.stdout);
          } catch {
            // File doesn't exist, create it
            vfs.writeFile(targetPath, lastResult.stdout);
          }
        } else {
          // Overwrite
          vfs.writeFile(targetPath, lastResult.stdout);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        lastResult.stderr += `\n${redirect.target}: ${msg}`;
        lastResult.exitCode = 1;
      }
      // When output is redirected, clear stdout (it went to the file)
      lastResult.stdout = '';
    }

    // Pipe: stdout of this stage becomes stdin of the next
    if (!isLast) {
      stdin = lastResult.stdout;
    }
  }

  return lastResult;
}

/**
 * Main entry point: execute a command string in the shell.
 *
 * Steps:
 * 1. Expand aliases
 * 2. Expand environment variables
 * 3. Tokenize
 * 4. Parse into pipelines
 * 5. Execute each pipeline chain respecting && and ; operators
 * 6. Update shell state (history, exit code)
 */
export async function executeCommand(
  input: string,
  shellState: ShellState,
  vfs: VirtualFileSystem,
  context: ExecutionContext
): Promise<CommandResult> {
  const trimmed = input.trim();

  // Empty command
  if (!trimmed) {
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Add to history (don't add duplicates of the last entry)
  if (
    shellState.history.length === 0 ||
    shellState.history[shellState.history.length - 1] !== trimmed
  ) {
    shellState.history.push(trimmed);
  }

  // Handle comments
  if (trimmed.startsWith('#')) {
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Handle variable assignment: VAR=value (no spaces around =)
  const assignmentMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (assignmentMatch && !trimmed.includes(' ')) {
    const [, varName, varValue] = assignmentMatch;
    shellState.env[varName] = varValue;
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Step 1: Expand aliases
  const aliasExpanded = expandAliases(trimmed, shellState.aliases);

  // Step 2: Expand environment variables
  // Set $? so it can be expanded
  shellState.env['?'] = String(shellState.lastExitCode);
  const varExpanded = expandVariables(aliasExpanded, shellState.env);

  // Step 3: Tokenize
  const tokens = tokenize(varExpanded);
  if (tokens.length === 0) {
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Step 4: Parse into pipelines
  const pipelines = parseTokens(tokens);
  if (pipelines.length === 0) {
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  // Step 5: Execute pipeline chains
  let lastResult: CommandResult = { stdout: '', stderr: '', exitCode: 0 };

  for (let i = 0; i < pipelines.length; i++) {
    const pipeline = pipelines[i];
    const prevPipeline = i > 0 ? pipelines[i - 1] : null;

    // Check chain operator from the PREVIOUS pipeline
    if (prevPipeline && prevPipeline.chainOp === '&&' && lastResult.exitCode !== 0) {
      // && means skip this pipeline if previous failed
      continue;
    }
    // ; always continues (no check needed)

    lastResult = await executePipeline(pipeline, shellState, vfs, context);

    // Output results to the terminal context
    if (lastResult.stdout) {
      context.addLine('output', lastResult.stdout);
    }
    if (lastResult.stderr) {
      context.addLine('error', lastResult.stderr);
    }
  }

  // Step 6: Update exit code
  shellState.lastExitCode = lastResult.exitCode;

  return lastResult;
}

/**
 * Provide tab-completion suggestions for partial input.
 *
 * - If the partial is the first word (or only word), complete command names.
 * - If it's a subsequent word, complete file/directory paths relative to cwd.
 */
export function getCompletions(
  partial: string,
  shellState: ShellState,
  vfs: VirtualFileSystem
): string[] {
  const trimmed = partial.trimStart();
  const parts = trimmed.split(/\s+/);

  if (parts.length <= 1) {
    // Completing a command name
    const prefix = parts[0] || '';
    const commandNames = registry.getNames();
    // Also include built-in commands not in registry
    const builtins = ['cd', 'export', 'unset', 'alias', 'unalias'];
    const allCommands = [...new Set([...commandNames, ...builtins])].sort();
    return allCommands.filter((name) => name.startsWith(prefix));
  }

  // Completing a file/directory path (the last word)
  const lastWord = parts[parts.length - 1] || '';
  return completeFilePath(lastWord, shellState.cwd, vfs);
}

/**
 * Complete file paths given a partial path and the current working directory.
 */
function completeFilePath(
  partial: string,
  cwd: string,
  vfs: VirtualFileSystem
): string[] {
  let dirPath: string;
  let prefix: string;
  let returnPrefix: string;

  if (partial.includes('/')) {
    const lastSlash = partial.lastIndexOf('/');
    const dirPart = partial.substring(0, lastSlash) || '/';
    prefix = partial.substring(lastSlash + 1);
    returnPrefix = partial.substring(0, lastSlash + 1);

    if (dirPart.startsWith('/')) {
      dirPath = dirPart;
    } else {
      dirPath = resolvePath(dirPart, cwd);
    }
  } else {
    dirPath = cwd;
    prefix = partial;
    returnPrefix = '';
  }

  try {
    const node = vfs.getNode(dirPath);
    if (!node || node.type !== 'dir' || !node.children) {
      return [];
    }

    const matches: string[] = [];
    for (const [name, child] of node.children) {
      if (name.startsWith(prefix)) {
        const suffix = child.type === 'dir' ? '/' : '';
        matches.push(returnPrefix + name + suffix);
      }
    }

    return matches.sort();
  } catch {
    return [];
  }
}
