import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import type { ShellState, CommandResult } from '../../types';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

export function registerAdvancedTextCommands() {
  // ─── sed ───────────────────────────────────────────────────────
  registry.register({
    name: 'sed',
    description: 'Stream editor for filtering and transforming text',
    usage: 'sed [-i] \'s/find/replace/[g|i]\' [file...]',
    flags: [
      { flag: '-i', description: 'Edit files in place' },
    ],
    handler: (args, flags, shellState, vfs, stdin): CommandResult => {
      const inPlace = !!flags['i'];
      let expr = '';
      let fileArgs: string[] = [];

      for (const arg of args) {
        if (!expr && (arg.startsWith('s') || arg.startsWith('\'s') || arg.startsWith('"s'))) {
          expr = arg;
        } else {
          fileArgs.push(arg);
        }
      }

      // If expr is missing but first positional was caught
      if (!expr && args.length > 0) {
        expr = args[0];
        fileArgs = args.slice(1);
      }

      // Strip outer quotes if present
      if ((expr.startsWith('\'') && expr.endsWith('\'')) || (expr.startsWith('"') && expr.endsWith('"'))) {
        expr = expr.substring(1, expr.length - 1);
      }

      // Parse s/pattern/replacement/flags
      // Support common delimiters: /, #, |
      const delim = expr[1] || '/';
      const parts = expr.split(delim);
      if (parts[0] !== 's' || parts.length < 3) {
        return {
          stdout: '',
          stderr: `sed: -e expression #1, char 1: unknown command: '${expr}'`,
          exitCode: 1,
        };
      }

      const pattern = parts[1];
      const replacement = parts[2];
      const sedFlags = parts[3] || '';

      const isGlobal = sedFlags.includes('g');
      const isCaseInsensitive = sedFlags.includes('i');

      const regexFlags = (isGlobal ? 'g' : '') + (isCaseInsensitive ? 'i' : '');
      let regex: RegExp;
      try {
        regex = new RegExp(pattern, regexFlags);
      } catch {
        regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), regexFlags);
      }

      const applySed = (text: string): string => {
        const lines = text.split('\n');
        return lines.map(line => line.replace(regex, replacement)).join('\n');
      };

      if (fileArgs.length > 0) {
        const outputs: string[] = [];
        const errors: string[] = [];

        for (const f of fileArgs) {
          const path = resolve(f, shellState);
          const node = vfs.getNode(path, true);
          if (!node) {
            errors.push(`sed: can't read ${f}: No such file or directory`);
            continue;
          }
          if (node.type === 'dir') {
            errors.push(`sed: couldn't edit ${f}: Is a directory`);
            continue;
          }

          const transformed = applySed(node.content ?? '');
          if (inPlace) {
            vfs.writeFile(path, transformed);
          } else {
            outputs.push(transformed);
          }
        }

        if (errors.length > 0) {
          return { stdout: outputs.join('\n'), stderr: errors.join('\n'), exitCode: 1 };
        }
        return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
      }

      // Read from stdin
      if (stdin !== undefined) {
        return { stdout: applySed(stdin), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'sed: no input files or stdin', exitCode: 1 };
    },
  });

  // ─── awk ───────────────────────────────────────────────────────
  registry.register({
    name: 'awk',
    description: 'Pattern scanning and processing language',
    usage: 'awk [-F <delim>] \'program\' [file...]',
    flags: [
      { flag: '-F', description: 'Field separator character' },
    ],
    handler: (args, flags, shellState, vfs, stdin): CommandResult => {
      let delim = (typeof flags['F'] === 'string' ? flags['F'] : '') || '';
      let program = '';
      let fileArgs: string[] = [];

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-F' && i + 1 < args.length) {
          delim = args[i + 1];
          i++;
        } else if (!program) {
          program = a;
        } else {
          fileArgs.push(a);
        }
      }

      if (!program) {
        return { stdout: '', stderr: 'awk: missing program', exitCode: 1 };
      }

      // Strip outer quotes
      if ((program.startsWith('\'') && program.endsWith('\'')) || (program.startsWith('"') && program.endsWith('"'))) {
        program = program.substring(1, program.length - 1);
      }

      // Check pattern e.g. /ERROR/ {print $1}
      let patternFilter: RegExp | null = null;
      let action = program;

      const patternMatch = program.match(/^\/(.+?)\/\s*(\{.+\})$/);
      if (patternMatch) {
        patternFilter = new RegExp(patternMatch[1]);
        action = patternMatch[2];
      }

      const processAwk = (text: string): string => {
        const lines = text.split('\n');
        const outputLines: string[] = [];

        for (const line of lines) {
          if (!line && lines.length === 1) continue;
          if (patternFilter && !patternFilter.test(line)) {
            continue;
          }

          // Split line into fields
          const fields: string[] = delim ? line.split(delim) : line.trim().split(/\s+/);
          const nf = fields.length;

          // Simple `{print $1, $2, ...}` handler
          if (action.includes('print')) {
            // Find what is printed inside print ...
            const printContentMatch = action.match(/print\s+(.+?)[\s;}]*$/);
            if (printContentMatch) {
              const exprs = printContentMatch[1].split(',').map(s => s.trim());
              const rowParts = exprs.map(expr => {
                if (expr === '$0') return line;
                if (expr === '$NF') return fields[nf - 1] ?? '';
                const fieldNumMatch = expr.match(/^\$(\d+)$/);
                if (fieldNumMatch) {
                  const idx = parseInt(fieldNumMatch[1], 10);
                  if (idx === 0) return line;
                  return fields[idx - 1] ?? '';
                }
                // Literals like "->", strip quotes
                if ((expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith('\'') && expr.endsWith('\''))) {
                  return expr.substring(1, expr.length - 1);
                }
                return expr;
              });
              outputLines.push(rowParts.join(' '));
            } else {
              outputLines.push(line);
            }
          } else {
            outputLines.push(line);
          }
        }

        return outputLines.join('\n');
      };

      if (fileArgs.length > 0) {
        const outputs: string[] = [];
        for (const f of fileArgs) {
          const path = resolve(f, shellState);
          const node = vfs.getNode(path, true);
          if (!node) {
            return { stdout: '', stderr: `awk: cannot open ${f} (No such file or directory)`, exitCode: 1 };
          }
          outputs.push(processAwk(node.content ?? ''));
        }
        return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
      }

      if (stdin !== undefined) {
        return { stdout: processAwk(stdin), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'awk: no input provided', exitCode: 1 };
    },
  });

  // ─── cut ───────────────────────────────────────────────────────
  registry.register({
    name: 'cut',
    description: 'Remove sections from each line of files',
    usage: 'cut -d <delimiter> -f <fields> [file...]',
    flags: [
      { flag: '-d', description: 'Field delimiter character' },
      { flag: '-f', description: 'List of fields to output (e.g. 1, 1,3, 1-3)' },
    ],
    handler: (args, flags, shellState, vfs, stdin): CommandResult => {
      let delim = typeof flags['d'] === 'string' ? flags['d'] : '\t';
      let fieldsArg = typeof flags['f'] === 'string' ? flags['f'] : '';
      const fileArgs: string[] = [];

      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '-d' && i + 1 < args.length) {
          delim = args[i + 1];
          i++;
        } else if (a.startsWith('-d')) {
          delim = a.substring(2);
        } else if (a === '-f' && i + 1 < args.length) {
          fieldsArg = args[i + 1];
          i++;
        } else if (a.startsWith('-f')) {
          fieldsArg = a.substring(2);
        } else {
          fileArgs.push(a);
        }
      }

      if (!fieldsArg) {
        return { stdout: '', stderr: 'cut: you must specify a list of fields with -f', exitCode: 1 };
      }

      // Parse target indices (1-based)
      const fieldIndices: number[] = [];
      for (const part of fieldsArg.split(',')) {
        if (part.includes('-')) {
          const [start, end] = part.split('-').map(Number);
          for (let n = start; n <= end; n++) fieldIndices.push(n);
        } else {
          fieldIndices.push(Number(part));
        }
      }

      const applyCut = (text: string): string => {
        const lines = text.split('\n');
        return lines.map(line => {
          if (!line) return '';
          const parts = line.split(delim);
          const selected = fieldIndices.map(idx => parts[idx - 1] ?? '').filter(s => s !== '');
          return selected.join(delim);
        }).join('\n');
      };

      if (fileArgs.length > 0) {
        const outputs: string[] = [];
        for (const f of fileArgs) {
          const path = resolve(f, shellState);
          const node = vfs.getNode(path, true);
          if (!node) {
            return { stdout: '', stderr: `cut: ${f}: No such file or directory`, exitCode: 1 };
          }
          outputs.push(applyCut(node.content ?? ''));
        }
        return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
      }

      if (stdin !== undefined) {
        return { stdout: applyCut(stdin), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'cut: no input', exitCode: 1 };
    },
  });

  // ─── tr ────────────────────────────────────────────────────────
  registry.register({
    name: 'tr',
    description: 'Translate, squeeze, and/or delete characters',
    usage: 'tr [-d] [-s] set1 [set2]',
    flags: [
      { flag: '-d', description: 'Delete characters in set1' },
      { flag: '-s', description: 'Squeeze repeated characters in set1' },
    ],
    handler: (args, flags, _shellState, _vfs, stdin): CommandResult => {
      const isDelete = !!flags['d'];
      const isSqueeze = !!flags['s'];

      if (stdin === undefined) {
        return { stdout: '', stderr: 'tr: no standard input provided', exitCode: 1 };
      }

      if (args.length === 0) {
        return { stdout: '', stderr: 'tr: missing operand', exitCode: 1 };
      }

      const expandSet = (s: string): string => {
        let clean = s;
        if ((clean.startsWith('\'') && clean.endsWith('\'')) || (clean.startsWith('"') && clean.endsWith('"'))) {
          clean = clean.substring(1, clean.length - 1);
        }
        if (clean === 'a-z') return 'abcdefghijklmnopqrstuvwxyz';
        if (clean === 'A-Z') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        if (clean === '0-9') return '0123456789';
        return clean;
      };

      const set1 = expandSet(args[0]);
      const set2 = args[1] ? expandSet(args[1]) : '';

      let text = stdin;

      if (isDelete) {
        for (const ch of set1) {
          text = text.split(ch).join('');
        }
        return { stdout: text, stderr: '', exitCode: 0 };
      }

      if (isSqueeze) {
        for (const ch of set1) {
          const escaped = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`${escaped}+`, 'g');
          text = text.replace(re, ch);
        }
        return { stdout: text, stderr: '', exitCode: 0 };
      }

      // Translation
      let result = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const idx = set1.indexOf(ch);
        if (idx !== -1 && idx < set2.length) {
          result += set2[idx];
        } else {
          result += ch;
        }
      }

      return { stdout: result, stderr: '', exitCode: 0 };
    },
  });

  // ─── diff ──────────────────────────────────────────────────────
  registry.register({
    name: 'diff',
    description: 'Compare files line by line',
    usage: 'diff [-u] <file1> <file2>',
    flags: [
      { flag: '-u', description: 'Output unified format diff' },
    ],
    handler: (args, flags, shellState, vfs): CommandResult => {
      const unified = !!flags['u'];
      const fileArgs = args.filter(a => a !== '-u');

      if (fileArgs.length < 2) {
        return { stdout: '', stderr: 'diff: missing operand', exitCode: 2 };
      }

      const path1 = resolve(fileArgs[0], shellState);
      const path2 = resolve(fileArgs[1], shellState);

      const node1 = vfs.getNode(path1, true);
      const node2 = vfs.getNode(path2, true);

      if (!node1) return { stdout: '', stderr: `diff: ${fileArgs[0]}: No such file or directory`, exitCode: 2 };
      if (!node2) return { stdout: '', stderr: `diff: ${fileArgs[1]}: No such file or directory`, exitCode: 2 };

      const lines1 = (node1.content ?? '').split('\n');
      const lines2 = (node2.content ?? '').split('\n');

      if (node1.content === node2.content) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      const diffLines: string[] = [];

      if (unified) {
        diffLines.push(`--- ${fileArgs[0]}\t${node1.updatedAt.toISOString().slice(0, 19)}`);
        diffLines.push(`+++ ${fileArgs[1]}\t${node2.updatedAt.toISOString().slice(0, 19)}`);
        diffLines.push(`@@ -1,${lines1.length} +1,${lines2.length} @@`);

        const maxL = Math.max(lines1.length, lines2.length);
        for (let i = 0; i < maxL; i++) {
          const l1 = lines1[i];
          const l2 = lines2[i];
          if (l1 === l2) {
            diffLines.push(` ${l1}`);
          } else {
            if (l1 !== undefined) diffLines.push(`<span style="color:#f87171">-${l1}</span>`);
            if (l2 !== undefined) diffLines.push(`<span style="color:#4ade80">+${l2}</span>`);
          }
        }
      } else {
        const maxL = Math.max(lines1.length, lines2.length);
        for (let i = 0; i < maxL; i++) {
          const l1 = lines1[i];
          const l2 = lines2[i];
          if (l1 !== l2) {
            diffLines.push(`${i + 1}c${i + 1}`);
            if (l1 !== undefined) diffLines.push(`< <span style="color:#f87171">${l1}</span>`);
            diffLines.push('---');
            if (l2 !== undefined) diffLines.push(`> <span style="color:#4ade80">${l2}</span>`);
          }
        }
      }

      return { stdout: diffLines.join('\n'), stderr: '', exitCode: 1 };
    },
  });

  // ─── jq ────────────────────────────────────────────────────────
  registry.register({
    name: 'jq',
    description: 'Command-line JSON processor',
    usage: 'jq \'<filter>\' [file...]',
    flags: [],
    handler: (args, _flags, shellState, vfs, stdin): CommandResult => {
      let filter = '.';
      let fileArg = '';

      if (args.length > 0) {
        filter = args[0];
        fileArg = args[1] || '';
      }

      // Strip outer quotes from filter
      if ((filter.startsWith('\'') && filter.endsWith('\'')) || (filter.startsWith('"') && filter.endsWith('"'))) {
        filter = filter.substring(1, filter.length - 1);
      }

      let jsonStr = '';
      if (fileArg) {
        const path = resolve(fileArg, shellState);
        const node = vfs.getNode(path, true);
        if (!node) {
          return { stdout: '', stderr: `jq: cannot open ${fileArg}: No such file or directory`, exitCode: 2 };
        }
        jsonStr = node.content ?? '';
      } else if (stdin !== undefined) {
        jsonStr = stdin;
      } else {
        return { stdout: '', stderr: 'jq: no JSON input provided', exitCode: 1 };
      }

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr.trim());
      } catch (err: any) {
        return { stdout: '', stderr: `parse error: Invalid numeric literal or syntax at line 1: ${err.message}`, exitCode: 5 };
      }

      // Process filter:
      const evaluateJq = (data: any, q: string): any => {
        if (!q || q === '.') return data;

        // keys
        if (q === 'keys') {
          return typeof data === 'object' && data !== null ? Object.keys(data) : [];
        }

        // length
        if (q === 'length') {
          if (Array.isArray(data)) return data.length;
          if (typeof data === 'object' && data !== null) return Object.keys(data).length;
          if (typeof data === 'string') return data.length;
          return 0;
        }

        // .[]
        if (q === '.[]') {
          return Array.isArray(data) ? data : Object.values(data);
        }

        // Subpath traversal like .users[0].name or .[].name or .name
        let current = data;
        // Normalize `.users[0].name` into path tokens
        const tokens: string[] = [];
        const tokenRegex = /\.([A-Za-z0-9_-]+)|\[(\d+)\]|\[\]/g;
        let match;
        while ((match = tokenRegex.exec(q)) !== null) {
          if (match[1]) tokens.push(match[1]);
          else if (match[2] !== undefined) tokens.push(match[2]);
          else tokens.push('[]');
        }

        if (tokens.length === 0 && q.startsWith('.')) {
          tokens.push(q.slice(1));
        }

        for (let i = 0; i < tokens.length; i++) {
          const tok = tokens[i];
          if (tok === '[]') {
            if (Array.isArray(current)) {
              // Map remaining tokens on each element
              const remaining = tokens.slice(i + 1);
              if (remaining.length === 0) return current;
              return current.map(item => {
                let sub = item;
                for (const subTok of remaining) {
                  if (sub && typeof sub === 'object') sub = sub[subTok];
                }
                return sub;
              });
            }
          } else if (current && typeof current === 'object') {
            current = current[tok];
          } else {
            return undefined;
          }
        }

        return current;
      };

      try {
        const result = evaluateJq(parsed, filter);
        if (result === undefined) {
          return { stdout: 'null', stderr: '', exitCode: 0 };
        }
        if (Array.isArray(result) && filter.includes('[]')) {
          // If extracted array elements directly
          const formatted = result.map(item =>
            typeof item === 'string' ? `"${item}"` : JSON.stringify(item, null, 2)
          ).join('\n');
          return { stdout: formatted, stderr: '', exitCode: 0 };
        }
        return {
          stdout: JSON.stringify(result, null, 2),
          stderr: '',
          exitCode: 0,
        };
      } catch (err: any) {
        return { stdout: '', stderr: `jq: filter error: ${err.message}`, exitCode: 1 };
      }
    },
  });
}
