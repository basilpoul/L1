import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import { formatPermissions } from '../../vfs/permissions';
import { matchGlob } from '../../vfs/pathResolver';
import type { CommandResult, ShellState, VFSNode } from '../../types';
import type { VirtualFileSystem } from '../../vfs/fileSystem';

function colorize(text: string, color: string): string {
  return `<span style="color:${color}">${text}</span>`;
}

function formatDate(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,' ')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatSize(size: number): string {
  return String(size).padStart(5, ' ');
}

export function registerNavigationCommands() {
  // pwd
  registry.register({
    name: 'pwd',
    description: 'Print the current working directory',
    usage: 'pwd',
    flags: [],
    handler: (_args, _flags, shellState) => ({
      stdout: shellState.cwd,
      stderr: '',
      exitCode: 0,
    }),
  });

  // cd
  registry.register({
    name: 'cd',
    description: 'Change the current working directory',
    usage: 'cd [directory]',
    flags: [],
    handler: (args, _flags, shellState, vfs) => {
      let target: string;
      const arg = args[0];

      if (!arg || arg === '~') {
        target = shellState.env['HOME'] || '/home/user';
      } else if (arg === '-') {
        target = shellState.previousDir || shellState.cwd;
      } else if (arg.startsWith('~')) {
        target = (shellState.env['HOME'] || '/home/user') + arg.substring(1);
      } else {
        target = resolvePath(arg, shellState.cwd, shellState.env['HOME'] || '/home/user');
      }

      const node = vfs.getNode(target);
      if (!node) {
        return { stdout: '', stderr: `cd: ${arg}: No such file or directory`, exitCode: 1 };
      }
      if (node.type !== 'dir') {
        return { stdout: '', stderr: `cd: ${arg}: Not a directory`, exitCode: 1 };
      }

      shellState.previousDir = shellState.cwd;
      shellState.cwd = target;
      shellState.env['PWD'] = target;
      shellState.env['OLDPWD'] = shellState.previousDir;

      return { stdout: arg === '-' ? target : '', stderr: '', exitCode: 0 };
    },
  });

  // ls
  registry.register({
    name: 'ls',
    description: 'List directory contents',
    usage: 'ls [-a] [-l] [path]',
    flags: [
      { flag: '-a', description: 'Show hidden files (dotfiles)' },
      { flag: '-l', description: 'Long format listing' },
    ],
    handler: (args: string[], flags: Record<string, string | boolean>, shellState: ShellState, vfs: VirtualFileSystem): CommandResult => {
      const showAll = !!flags['a'];
      const longFormat = !!flags['l'];
      const targetPath = args[0]
        ? resolvePath(args[0], shellState.cwd, shellState.env['HOME'] || '/home/user')
        : shellState.cwd;

      const node = vfs.getNode(targetPath, false);
      if (!node) {
        return { stdout: '', stderr: `ls: cannot access '${args[0] || targetPath}': No such file or directory`, exitCode: 2 };
      }

      if (node.type === 'file' || node.type === 'symlink') {
        const displayName = node.type === 'symlink'
          ? `${colorize(node.name, '#22d3ee')} -> ${node.target || ''}`
          : (node.permissions.includes('x') ? colorize(node.name, '#4ade80') : node.name);

        if (longFormat) {
          const line = `${formatPermissions(node)}  ${node.owner.padEnd(5)}  ${node.group.padEnd(5)}  ${formatSize(node.size)}  ${formatDate(node.updatedAt)}  ${displayName}`;
          return { stdout: line, stderr: '', exitCode: 0 };
        }
        return { stdout: displayName, stderr: '', exitCode: 0 };
      }

      const children = vfs.listDirectory(targetPath);
      if (!children) {
        return { stdout: '', stderr: `ls: cannot open directory '${args[0] || targetPath}'`, exitCode: 2 };
      }

      let entries = children.sort((a, b) => a.name.localeCompare(b.name));
      if (!showAll) {
        entries = entries.filter(e => !e.name.startsWith('.'));
      }

      if (entries.length === 0) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      const colorName = (n: VFSNode, isLong: boolean = false): string => {
        if (n.type === 'dir') return colorize(n.name, '#60a5fa');
        if (n.type === 'symlink') {
          return isLong ? `${colorize(n.name, '#22d3ee')} -> ${n.target || ''}` : colorize(n.name, '#22d3ee');
        }
        if (n.permissions.includes('x')) return colorize(n.name, '#4ade80');
        return n.name;
      };

      if (longFormat) {
        const dotEntries: string[] = [];
        if (showAll) {
          dotEntries.push(`${colorize('drwxr-xr-x', '#94a3b8')}  ${node.owner.padEnd(5)}  ${node.group.padEnd(5)}  ${formatSize(4096)}  ${formatDate(node.updatedAt)}  ${colorize('.', '#60a5fa')}`);
          dotEntries.push(`${colorize('drwxr-xr-x', '#94a3b8')}  ${node.owner.padEnd(5)}  ${node.group.padEnd(5)}  ${formatSize(4096)}  ${formatDate(node.updatedAt)}  ${colorize('..', '#60a5fa')}`);
        }
        const lines = entries.map(e => {
          const perm = formatPermissions(e);
          return `${perm}  ${e.owner.padEnd(5)}  ${e.group.padEnd(5)}  ${formatSize(e.size)}  ${formatDate(e.updatedAt)}  ${colorName(e, true)}`;
        });
        const totalLines = `total ${entries.length}`;
        const result = [totalLines, ...dotEntries, ...lines].join('\n');
        return { stdout: result, stderr: '', exitCode: 0 };
      }

      const names = entries.map(e => colorName(e, false));
      return { stdout: names.join('  '), stderr: '', exitCode: 0 };
    },
  });

  // tree
  registry.register({
    name: 'tree',
    description: 'Display directory tree structure',
    usage: 'tree [path]',
    flags: [],
    handler: (args, _flags, shellState, vfs) => {
      const targetPath = args[0]
        ? resolvePath(args[0], shellState.cwd, shellState.env['HOME'] || '/home/user')
        : shellState.cwd;

      const node = vfs.getNode(targetPath);
      if (!node) {
        return { stdout: '', stderr: `tree: '${args[0] || targetPath}': No such file or directory`, exitCode: 1 };
      }

      const treeOutput = vfs.getTree(targetPath);
      return { stdout: treeOutput, stderr: '', exitCode: 0 };
    },
  });

  // find
  registry.register({
    name: 'find',
    description: 'Search for files by name',
    usage: 'find <path> -name <pattern>',
    flags: [
      { flag: '-name', description: 'Match file name pattern (supports * and ?)' },
    ],
    handler: (args, flags, shellState, vfs) => {
      let searchPath = args[0] || shellState.cwd;
      searchPath = resolvePath(searchPath, shellState.cwd, shellState.env['HOME'] || '/home/user');

      const node = vfs.getNode(searchPath);
      if (!node) {
        return { stdout: '', stderr: `find: '${args[0] || searchPath}': No such file or directory`, exitCode: 1 };
      }

      let pattern = '';
      if (flags['name'] && typeof flags['name'] === 'string') {
        pattern = flags['name'];
      } else {
        // Check rawArgs-style: find /path -name "*.txt"
        const nameIdx = args.indexOf('-name');
        if (nameIdx !== -1 && nameIdx + 1 < args.length) {
          pattern = args[nameIdx + 1];
          searchPath = resolvePath(args[0] || '.', shellState.cwd, shellState.env['HOME'] || '/home/user');
        }
      }

      const results = vfs.findNodes(searchPath, (n, _p) => {
        if (!pattern) return true;
        return matchGlob(n.name, pattern);
      });

      return { stdout: results.join('\n'), stderr: '', exitCode: 0 };
    },
  });
}
