import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import { checkPermission } from '../../vfs/permissions';
import type { ShellState, CommandResult } from '../../types';
import type { VirtualFileSystem } from '../../vfs/fileSystem';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

export function registerTextCommands() {
  // cat
  registry.register({
    name: 'cat',
    description: 'Concatenate and print file contents',
    usage: 'cat [-n] [file...]',
    flags: [{ flag: '-n', description: 'Number all output lines' }],
    handler: (args, flags, shellState, vfs, stdin) => {
      const numberLines = !!flags['n'];

      // If stdin is provided (from pipe) and no file args, use stdin
      if ((!args || args.length === 0) && stdin !== undefined) {
        if (numberLines) {
          const lines = stdin.split('\n');
          const numbered = lines.map((l, i) => `     ${i + 1}\t${l}`).join('\n');
          return { stdout: numbered, stderr: '', exitCode: 0 };
        }
        return { stdout: stdin, stderr: '', exitCode: 0 };
      }

      if (!args || args.length === 0) {
        return { stdout: stdin || '', stderr: '', exitCode: 0 };
      }

      const outputs: string[] = [];
      const errors: string[] = [];

      for (const arg of args) {
        const path = resolve(arg, shellState);
        const node = vfs.getNode(path);

        if (!node) {
          errors.push(`cat: ${arg}: No such file or directory`);
          continue;
        }
        if (node.type === 'dir') {
          errors.push(`cat: ${arg}: Is a directory`);
          continue;
        }

        if (!checkPermission(node, 'read', shellState.env['USER'] || 'user', shellState.isRoot)) {
          errors.push(`cat: ${arg}: Permission denied`);
          continue;
        }

        outputs.push(node.content ?? '');
      }

      let content = outputs.join('');
      if (numberLines && content) {
        const lines = content.split('\n');
        content = lines.map((l, i) => `     ${i + 1}\t${l}`).join('\n');
      }

      return {
        stdout: content,
        stderr: errors.join('\n'),
        exitCode: errors.length > 0 ? 1 : 0,
      };
    },
  });

  // echo
  registry.register({
    name: 'echo',
    description: 'Display text',
    usage: 'echo [-n] [-e] [text...]',
    flags: [
      { flag: '-n', description: 'Do not output trailing newline' },
      { flag: '-e', description: 'Enable interpretation of backslash escapes' },
    ],
    handler: (args, flags, _shellState) => {
      let text = args.join(' ');

      if (flags['e']) {
        text = text
          .replace(/\\n/g, '\n')
          .replace(/\\t/g, '\t')
          .replace(/\\\\/g, '\\');
      }

      return { stdout: text, stderr: '', exitCode: 0 };
    },
  });

  // grep
  registry.register({
    name: 'grep',
    description: 'Search text patterns in files or stdin',
    usage: 'grep [-i] [-v] [-n] [-c] <pattern> [file...]',
    flags: [
      { flag: '-i', description: 'Case-insensitive matching' },
      { flag: '-v', description: 'Invert match (show non-matching lines)' },
      { flag: '-n', description: 'Prefix each line with line number' },
      { flag: '-c', description: 'Count matching lines' },
    ],
    handler: (args, flags, shellState, vfs, stdin) => {
      const caseInsensitive = !!flags['i'];
      const invertMatch = !!flags['v'];
      const showLineNumbers = !!flags['n'];
      const countOnly = !!flags['c'];

      if (args.length === 0) {
        return { stdout: '', stderr: 'grep: missing pattern', exitCode: 2 };
      }

      const pattern = args[0];
      const files = args.slice(1);

      const grepText = (text: string, filename?: string): string => {
        const lines = text.split('\n');
        const matched: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let isMatch: boolean;

          if (caseInsensitive) {
            isMatch = line.toLowerCase().includes(pattern.toLowerCase());
          } else {
            isMatch = line.includes(pattern);
          }

          if (invertMatch) isMatch = !isMatch;

          if (isMatch) {
            let output = line;

            // Highlight matched text (not for inverted matches)
            if (!invertMatch && !countOnly) {
              const regex = new RegExp(
                pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                caseInsensitive ? 'gi' : 'g'
              );
              output = output.replace(
                regex,
                (m) => `<span style="color:#f87171;font-weight:bold">${m}</span>`
              );
            }

            if (showLineNumbers) {
              output = `${i + 1}:${output}`;
            }
            if (filename && files.length > 1) {
              output = `${filename}:${output}`;
            }
            matched.push(output);
          }
        }

        if (countOnly) {
          return filename && files.length > 1
            ? `${filename}:${matched.length}`
            : String(matched.length);
        }

        return matched.join('\n');
      };

      // If files given, grep from files
      if (files.length > 0) {
        const outputs: string[] = [];
        const errors: string[] = [];

        for (const file of files) {
          const path = resolve(file, shellState);
          const node = vfs.getNode(path);

          if (!node) {
            errors.push(`grep: ${file}: No such file or directory`);
            continue;
          }
          if (node.type === 'dir') {
            errors.push(`grep: ${file}: Is a directory`);
            continue;
          }

          const result = grepText(node.content ?? '', file);
          if (result) outputs.push(result);
        }

        return {
          stdout: outputs.join('\n'),
          stderr: errors.join('\n'),
          exitCode: outputs.length > 0 ? 0 : 1,
        };
      }

      // grep from stdin
      if (stdin !== undefined) {
        const result = grepText(stdin);
        return { stdout: result, stderr: '', exitCode: result ? 0 : 1 };
      }

      return { stdout: '', stderr: 'grep: no input', exitCode: 2 };
    },
  });

  // head
  registry.register({
    name: 'head',
    description: 'Output the first part of files',
    usage: 'head [-n <count>] [file...]',
    flags: [{ flag: '-n', description: 'Number of lines to show (default 10)' }],
    handler: (args, flags, shellState, vfs, stdin) => {
      const count = typeof flags['n'] === 'string' ? parseInt(flags['n'], 10) : 10;

      const headText = (text: string): string => {
        const lines = text.split('\n');
        return lines.slice(0, count).join('\n');
      };

      if (args.length > 0) {
        const outputs: string[] = [];
        for (const file of args) {
          const path = resolve(file, shellState);
          const result = vfs.readFile(path);
          if (result.exitCode !== 0) {
            return { stdout: '', stderr: `head: ${result.stderr}`, exitCode: 1 };
          }
          if (args.length > 1) outputs.push(`==> ${file} <==\n${headText(result.stdout)}`);
          else outputs.push(headText(result.stdout));
        }
        return { stdout: outputs.join('\n\n'), stderr: '', exitCode: 0 };
      }

      if (stdin !== undefined) {
        return { stdout: headText(stdin), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'head: no input', exitCode: 1 };
    },
  });

  // tail
  registry.register({
    name: 'tail',
    description: 'Output the last part of files',
    usage: 'tail [-n <count>] [file...]',
    flags: [{ flag: '-n', description: 'Number of lines to show (default 10)' }],
    handler: (args, flags, shellState, vfs, stdin) => {
      const count = typeof flags['n'] === 'string' ? parseInt(flags['n'], 10) : 10;

      const tailText = (text: string): string => {
        const lines = text.split('\n');
        return lines.slice(-count).join('\n');
      };

      if (args.length > 0) {
        const outputs: string[] = [];
        for (const file of args) {
          const path = resolve(file, shellState);
          const result = vfs.readFile(path);
          if (result.exitCode !== 0) {
            return { stdout: '', stderr: `tail: ${result.stderr}`, exitCode: 1 };
          }
          if (args.length > 1) outputs.push(`==> ${file} <==\n${tailText(result.stdout)}`);
          else outputs.push(tailText(result.stdout));
        }
        return { stdout: outputs.join('\n\n'), stderr: '', exitCode: 0 };
      }

      if (stdin !== undefined) {
        return { stdout: tailText(stdin), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'tail: no input', exitCode: 1 };
    },
  });

  // wc
  registry.register({
    name: 'wc',
    description: 'Word, line, and byte count',
    usage: 'wc [-l] [-w] [-c] [file...]',
    flags: [
      { flag: '-l', description: 'Print line count only' },
      { flag: '-w', description: 'Print word count only' },
      { flag: '-c', description: 'Print byte count only' },
    ],
    handler: (args, flags, shellState, vfs, stdin) => {
      const linesOnly = !!flags['l'];
      const wordsOnly = !!flags['w'];
      const bytesOnly = !!flags['c'];
      const showAll = !linesOnly && !wordsOnly && !bytesOnly;

      const countText = (text: string, label?: string): string => {
        const lines = text.split('\n');
        const lineCount = lines.length > 0 && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
        const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
        const byteCount = new Blob([text]).size;

        const parts: string[] = [];
        if (showAll || linesOnly) parts.push(String(lineCount).padStart(7));
        if (showAll || wordsOnly) parts.push(String(wordCount).padStart(7));
        if (showAll || bytesOnly) parts.push(String(byteCount).padStart(7));
        if (label) parts.push(` ${label}`);

        return parts.join(' ');
      };

      if (args.length > 0) {
        const outputs: string[] = [];
        for (const file of args) {
          const path = resolve(file, shellState);
          const result = vfs.readFile(path);
          if (result.exitCode !== 0) {
            return { stdout: '', stderr: `wc: ${result.stderr}`, exitCode: 1 };
          }
          outputs.push(countText(result.stdout, file));
        }
        return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
      }

      if (stdin !== undefined) {
        return { stdout: countText(stdin), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'wc: no input', exitCode: 1 };
    },
  });

  // sort
  registry.register({
    name: 'sort',
    description: 'Sort lines of text',
    usage: 'sort [-r] [-n] [-u] [file...]',
    flags: [
      { flag: '-r', description: 'Reverse sort order' },
      { flag: '-n', description: 'Numeric sort' },
      { flag: '-u', description: 'Output only unique lines' },
    ],
    handler: (args, flags, shellState, vfs, stdin) => {
      const reverse = !!flags['r'];
      const numeric = !!flags['n'];
      const unique = !!flags['u'];

      const sortText = (text: string): string => {
        let lines = text.split('\n');
        // Remove trailing empty line if exists
        if (lines.length > 0 && lines[lines.length - 1] === '') {
          lines.pop();
        }

        if (numeric) {
          lines.sort((a, b) => parseFloat(a) - parseFloat(b));
        } else {
          lines.sort();
        }

        if (reverse) lines.reverse();
        if (unique) lines = [...new Set(lines)];

        return lines.join('\n');
      };

      if (args.length > 0) {
        const outputs: string[] = [];
        for (const file of args) {
          const path = resolve(file, shellState);
          const result = vfs.readFile(path);
          if (result.exitCode !== 0) {
            return { stdout: '', stderr: `sort: ${result.stderr}`, exitCode: 1 };
          }
          outputs.push(sortText(result.stdout));
        }
        return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
      }

      if (stdin !== undefined) {
        return { stdout: sortText(stdin), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'sort: no input', exitCode: 1 };
    },
  });

  // uniq
  registry.register({
    name: 'uniq',
    description: 'Filter adjacent duplicate lines',
    usage: 'uniq [-c] [-d] [file]',
    flags: [
      { flag: '-c', description: 'Prefix lines with occurrence count' },
      { flag: '-d', description: 'Only print duplicate lines' },
    ],
    handler: (args, flags, shellState, vfs, stdin) => {
      const showCount = !!flags['c'];
      const duplicatesOnly = !!flags['d'];

      const uniqText = (text: string): string => {
        const lines = text.split('\n');
        if (lines.length === 0) return '';

        const result: { line: string; count: number }[] = [];
        let current = lines[0];
        let count = 1;

        for (let i = 1; i < lines.length; i++) {
          if (lines[i] === current) {
            count++;
          } else {
            result.push({ line: current, count });
            current = lines[i];
            count = 1;
          }
        }
        result.push({ line: current, count });

        let filtered = result;
        if (duplicatesOnly) {
          filtered = result.filter(r => r.count > 1);
        }

        if (showCount) {
          return filtered.map(r => `${String(r.count).padStart(7)} ${r.line}`).join('\n');
        }

        return filtered.map(r => r.line).join('\n');
      };

      if (args.length > 0) {
        const path = resolve(args[0], shellState);
        const fileResult = vfs.readFile(path);
        if (fileResult.exitCode !== 0) {
          return { stdout: '', stderr: `uniq: ${fileResult.stderr}`, exitCode: 1 };
        }
        return { stdout: uniqText(fileResult.stdout), stderr: '', exitCode: 0 };
      }

      if (stdin !== undefined) {
        return { stdout: uniqText(stdin), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'uniq: no input', exitCode: 1 };
    },
  });

  // nano
  registry.register({
    name: 'nano',
    description: 'Simple text editor',
    usage: 'nano <filename>',
    flags: [],
    handler: (args, _flags, shellState, vfs, _stdin, context) => {
      if (!context) return { stdout: '', stderr: 'nano: no context', exitCode: 1 };
      if (args.length === 0) {
        return { stdout: '', stderr: 'nano: missing filename', exitCode: 1 };
      }

      const path = resolve(args[0], shellState);
      const node = vfs.getNode(path);
      let content = '';

      if (node) {
        if (node.type === 'dir') {
          return { stdout: '', stderr: `nano: ${args[0]}: Is a directory`, exitCode: 1 };
        }
        content = node.content ?? '';
      }

      // Open nano editor via context
      context.setNanoState({
        filename: path,
        content,
        cursorLine: 0,
        cursorCol: 0,
        modified: false,
        scrollOffset: 0,
      });

      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // vim and vi
  const vimHandler = (
    args: string[],
    _flags: Record<string, string | boolean>,
    shellState: ShellState,
    vfs: VirtualFileSystem,
    _stdin?: string,
    context?: any
  ): CommandResult => {
    if (!context) return { stdout: '', stderr: 'vim: no context', exitCode: 1 };
    if (args.length === 0) {
      return { stdout: '', stderr: 'vim: missing filename', exitCode: 1 };
    }

    const path = resolve(args[0], shellState);
    const node = vfs.getNode(path);
    let content = '';

    if (node) {
      if (node.type === 'dir') {
        return { stdout: '', stderr: `vim: ${args[0]}: Is a directory`, exitCode: 1 };
      }
      content = node.content ?? '';
    }

    if (context.setVimState) {
      context.setVimState({
        filename: path,
        content,
        mode: 'NORMAL',
        cursorLine: 0,
        cursorCol: 0,
        modified: false,
      });
    }

    return { stdout: '', stderr: '', exitCode: 0 };
  };

  registry.register({
    name: 'vim',
    description: 'Vi IMproved - powerful modal text editor',
    usage: 'vim <filename>',
    flags: [],
    handler: vimHandler,
  });

  registry.register({
    name: 'vi',
    description: 'Vi modal text editor',
    usage: 'vi <filename>',
    flags: [],
    handler: vimHandler,
  });
}
