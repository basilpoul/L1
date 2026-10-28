import type { VirtualFileSystem } from '../vfs/fileSystem';
import type { ShellState, CommandResult } from '../types';
import type { ExecutionContext } from './commandRegistry';
import { executeCommand } from './executor';
import { resolvePath } from '../vfs/pathResolver';
import { checkPermission } from '../vfs/permissions';

/**
 * Expand script-specific variables such as $0, $1..$9, $@, $#, and standard $VARS.
 */
function expandScriptVariables(
  line: string,
  env: Record<string, string>,
  positionalArgs: string[],
  scriptPath: string
): string {
  let result = line;

  // $# (number of args)
  result = result.replace(/\$#/g, String(positionalArgs.length));

  // $0 (script name/path)
  result = result.replace(/\$0/g, scriptPath);

  // $@ and $* (all positional args)
  result = result.replace(/\$[@*]/g, positionalArgs.join(' '));

  // $1 .. $9
  for (let i = 1; i <= 9; i++) {
    const val = positionalArgs[i - 1] ?? '';
    const re = new RegExp(`\\$${i}`, 'g');
    result = result.replace(re, val);
  }

  // ${VAR}
  result = result.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, varName) => {
    return env[varName] ?? '';
  });

  // $VAR (avoid double expanding $1-$9 or already handled)
  result = result.replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, varName) => {
    return env[varName] ?? '';
  });

  return result;
}

/**
 * Evaluate test condition inside `[ ... ]` or `[[ ... ]]`.
 */
function evaluateCondition(
  rawCond: string,
  cwd: string,
  home: string,
  vfs: VirtualFileSystem
): boolean {
  let cond = rawCond.trim();
  if (cond.startsWith('[[')) cond = cond.substring(2);
  else if (cond.startsWith('[')) cond = cond.substring(1);

  if (cond.endsWith(']]')) cond = cond.substring(0, cond.length - 2);
  else if (cond.endsWith(']')) cond = cond.substring(0, cond.length - 1);

  cond = cond.trim();
  if (!cond) return false;

  // Tokenize condition preserving simple quotes
  const tokens: string[] = [];
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  let match;
  while ((match = regex.exec(cond)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[0]);
  }

  if (tokens.length === 0) return false;

  // Single operand: [ "$VAR" ] -> true if non-empty
  if (tokens.length === 1) {
    return tokens[0].length > 0;
  }

  // -f <path>
  if (tokens[0] === '-f' && tokens[1]) {
    const fullPath = resolvePath(tokens[1], cwd, home);
    const node = vfs.getNode(fullPath, true);
    return !!node && (node.type === 'file' || node.type === 'symlink');
  }

  // -d <path>
  if (tokens[0] === '-d' && tokens[1]) {
    const fullPath = resolvePath(tokens[1], cwd, home);
    const node = vfs.getNode(fullPath, true);
    return !!node && node.type === 'dir';
  }

  // -z <string>
  if (tokens[0] === '-z') {
    return (tokens[1] ?? '').length === 0;
  }

  // -n <string>
  if (tokens[0] === '-n') {
    return (tokens[1] ?? '').length > 0;
  }

  // Binary operators: arg1 op arg2
  if (tokens.length >= 3) {
    const [left, op, right] = tokens;
    switch (op) {
      case '==':
      case '=':
        return left === right;
      case '!=':
        return left !== right;
      case '-eq':
        return Number(left) === Number(right);
      case '-ne':
        return Number(left) !== Number(right);
      case '-gt':
        return Number(left) > Number(right);
      case '-ge':
        return Number(left) >= Number(right);
      case '-lt':
        return Number(left) < Number(right);
      case '-le':
        return Number(left) <= Number(right);
      default:
        return false;
    }
  }

  return false;
}

/**
 * Execute multi-line bash script content with control flow.
 */
export async function runScriptContent(
  scriptContent: string,
  scriptPath: string,
  args: string[],
  shellState: ShellState,
  vfs: VirtualFileSystem,
  context: ExecutionContext
): Promise<CommandResult> {
  const lines = scriptContent.split('\n');
  const home = shellState.env['HOME'] || '/home/user';
  let lastResult: CommandResult = { stdout: '', stderr: '', exitCode: 0 };

  // Create isolated subshell env inheriting parent env
  const scriptEnv: Record<string, string> = { ...shellState.env };

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i].trim();
    i++;

    // Skip empty lines & comments
    if (!rawLine || rawLine.startsWith('#')) {
      continue;
    }

    // 1. Variable Assignment: VAR=value or VAR="value"
    const assignMatch = rawLine.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (assignMatch && !rawLine.includes(' ') && !rawLine.startsWith('if') && !rawLine.startsWith('for')) {
      const varName = assignMatch[1];
      let val = assignMatch[2];
      // Expand variables in value
      val = expandScriptVariables(val, scriptEnv, args, scriptPath);
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.substring(1, val.length - 1);
      }
      scriptEnv[varName] = val;
      shellState.env[varName] = val; // Reflect back to session
      continue;
    }

    // 2. If-block: `if [ cond ]; then ... else ... fi`
    if (rawLine.startsWith('if ') || rawLine.startsWith('if[')) {
      // Collect the entire if block
      let condStr = '';
      let ifLines: string[] = [rawLine];

      while (i < lines.length && !ifLines.some(l => l.trim() === 'fi' || l.trim().startsWith('fi ') || l.trim().endsWith('; fi') || l.trim().endsWith(';fi'))) {
        ifLines.push(lines[i]);
        i++;
      }

      // Extract condition from if line
      const fullIfText = ifLines.join('\n');
      const conditionMatch = fullIfText.match(/if\s+(.+?)(?:;\s*then|\s+then|\n\s*then)/s);
      condStr = conditionMatch ? conditionMatch[1].trim() : '';

      // Expand condition variables
      condStr = expandScriptVariables(condStr, scriptEnv, args, scriptPath);
      const conditionPassed = evaluateCondition(condStr, shellState.cwd, home, vfs);

      // Split then-part and else-part
      let thenPart = '';
      let elsePart = '';

      const thenIdx = fullIfText.indexOf('then');
      const elseIdx = fullIfText.indexOf('else');
      const fiIdx = fullIfText.lastIndexOf('fi');

      if (thenIdx !== -1) {
        if (elseIdx !== -1 && elseIdx > thenIdx) {
          thenPart = fullIfText.substring(thenIdx + 4, elseIdx);
          elsePart = fullIfText.substring(elseIdx + 4, fiIdx);
        } else {
          thenPart = fullIfText.substring(thenIdx + 4, fiIdx);
        }
      }

      const blockToRun = conditionPassed ? thenPart : elsePart;
      if (blockToRun.trim()) {
        lastResult = await runScriptContent(blockToRun, scriptPath, args, shellState, vfs, context);
      }
      continue;
    }

    // 3. For loop: `for VAR in list; do ... done`
    if (rawLine.startsWith('for ') || rawLine.startsWith('for(')) {
      const forLines: string[] = [rawLine];
      while (i < lines.length && !forLines.some(l => l.trim() === 'done' || l.trim().endsWith('; done') || l.trim().endsWith(';done'))) {
        forLines.push(lines[i]);
        i++;
      }

      const fullForText = forLines.join('\n');
      const forHeaderMatch = fullForText.match(/for\s+([A-Za-z_][A-Za-z0-9_]*)\s+in\s+(.+?)(?:;\s*do|\s+do|\n\s*do)/s);

      if (forHeaderMatch) {
        const iterVar = forHeaderMatch[1];
        let rawItems = forHeaderMatch[2].trim();
        rawItems = expandScriptVariables(rawItems, scriptEnv, args, scriptPath);

        // Split items
        let items: string[] = [];
        if (rawItems.includes('*')) {
          // Glob expansion
          const found = vfs.findNodes(shellState.cwd, (node) => node.name.endsWith(rawItems.replace('*', '')));
          items = found.length > 0 ? found : [rawItems];
        } else {
          items = rawItems.split(/\s+/).filter(Boolean);
        }

        const doIdx = fullForText.indexOf('do');
        const doneIdx = fullForText.lastIndexOf('done');
        const loopBody = fullForText.substring(doIdx + 2, doneIdx);

        for (const item of items) {
          scriptEnv[iterVar] = item;
          shellState.env[iterVar] = item;
          lastResult = await runScriptContent(loopBody, scriptPath, args, shellState, vfs, context);
          if (lastResult.exitCode !== 0 && lastResult.stderr) {
            break;
          }
        }
      }
      continue;
    }

    // 4. Regular command line
    const expandedLine = expandScriptVariables(rawLine, scriptEnv, args, scriptPath);
    // Execute command with subshell env
    const originalEnv = { ...shellState.env };
    shellState.env = { ...shellState.env, ...scriptEnv };

    lastResult = await executeCommand(expandedLine, shellState, vfs, context);

    // Merge changes to env back
    Object.assign(scriptEnv, shellState.env);
    shellState.env = { ...originalEnv, ...scriptEnv };
    scriptEnv['?'] = String(lastResult.exitCode);
  }

  return lastResult;
}

/**
 * Execute a script file stored in the VFS.
 */
export async function executeScriptFile(
  filePath: string,
  args: string[],
  shellState: ShellState,
  vfs: VirtualFileSystem,
  context: ExecutionContext,
  skipPermCheck: boolean = false
): Promise<CommandResult> {
  const home = shellState.env['HOME'] || '/home/user';
  const fullPath = resolvePath(filePath, shellState.cwd, home);

  const node = vfs.getNode(fullPath, true);
  if (!node) {
    return {
      stdout: '',
      stderr: `bash: ${filePath}: No such file or directory`,
      exitCode: 127,
    };
  }

  if (node.type === 'dir') {
    return {
      stdout: '',
      stderr: `bash: ${filePath}: Is a directory`,
      exitCode: 126,
    };
  }

  // Permission check if invoked directly (e.g. `./script.sh` or `/bin/script.sh`)
  if (!skipPermCheck) {
    const user = shellState.env['USER'] || 'user';
    const isExec = checkPermission(node, 'execute', user, shellState.isRoot);
    if (!isExec) {
      return {
        stdout: '',
        stderr: `bash: ${filePath}: Permission denied`,
        exitCode: 126,
      };
    }
  }

  const content = node.content ?? '';
  return runScriptContent(content, filePath, args, shellState, vfs, context);
}
