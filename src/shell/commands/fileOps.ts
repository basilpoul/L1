import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import type { ShellState } from '../../types';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

export function registerFileOpsCommands() {
  // mkdir
  registry.register({
    name: 'mkdir',
    description: 'Create directories',
    usage: 'mkdir [-p] <directory...>',
    flags: [{ flag: '-p', description: 'Create parent directories as needed' }],
    handler: (args, flags, shellState, vfs) => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'mkdir: missing operand', exitCode: 1 };
      }
      const recursive = !!flags['p'];
      const errors: string[] = [];
      for (const arg of args) {
        const path = resolve(arg, shellState);
        const result = vfs.createDirectory(path, recursive);
        if (result.exitCode !== 0) errors.push(`mkdir: ${result.stderr}`);
      }
      if (errors.length > 0) {
        return { stdout: '', stderr: errors.join('\n'), exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // touch
  registry.register({
    name: 'touch',
    description: 'Create empty files or update timestamps',
    usage: 'touch <file...>',
    flags: [],
    handler: (args, _flags, shellState, vfs) => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'touch: missing file operand', exitCode: 1 };
      }
      const errors: string[] = [];
      for (const arg of args) {
        const path = resolve(arg, shellState);
        const existing = vfs.getNode(path);
        if (existing) {
          existing.updatedAt = new Date();
          vfs.save();
        } else {
          const result = vfs.createFile(path, '');
          if (result.exitCode !== 0) errors.push(`touch: ${result.stderr}`);
        }
      }
      if (errors.length > 0) {
        return { stdout: '', stderr: errors.join('\n'), exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // rm
  registry.register({
    name: 'rm',
    description: 'Remove files or directories',
    usage: 'rm [-r] [-f] <file...>',
    flags: [
      { flag: '-r', description: 'Remove directories and their contents recursively' },
      { flag: '-f', description: 'Force removal without errors for missing files' },
    ],
    handler: (args, flags, shellState, vfs) => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'rm: missing operand', exitCode: 1 };
      }
      const recursive = !!flags['r'] || !!flags['f'] && !!flags['r'];
      const force = !!flags['f'];
      const errors: string[] = [];

      for (const arg of args) {
        const path = resolve(arg, shellState);
        const node = vfs.getNode(path);

        if (!node) {
          if (!force) errors.push(`rm: cannot remove '${arg}': No such file or directory`);
          continue;
        }

        if (node.type === 'dir' && !recursive) {
          errors.push(`rm: cannot remove '${arg}': Is a directory`);
          continue;
        }

        const result = vfs.deleteNode(path, recursive);
        if (result.exitCode !== 0 && !force) {
          errors.push(`rm: ${result.stderr}`);
        }
      }

      if (errors.length > 0) {
        return { stdout: '', stderr: errors.join('\n'), exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // cp
  registry.register({
    name: 'cp',
    description: 'Copy files and directories',
    usage: 'cp [-r] <source> <dest>',
    flags: [{ flag: '-r', description: 'Copy directories recursively' }],
    handler: (args, flags, shellState, vfs) => {
      if (args.length < 2) {
        return { stdout: '', stderr: 'cp: missing file operand', exitCode: 1 };
      }
      const recursive = !!flags['r'];
      const srcPath = resolve(args[0], shellState);
      const destPath = resolve(args[1], shellState);
      const result = vfs.copyNode(srcPath, destPath, recursive);
      if (result.exitCode !== 0) {
        return { stdout: '', stderr: `cp: ${result.stderr}`, exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // mv
  registry.register({
    name: 'mv',
    description: 'Move or rename files and directories',
    usage: 'mv <source> <dest>',
    flags: [],
    handler: (args, _flags, shellState, vfs) => {
      if (args.length < 2) {
        return { stdout: '', stderr: 'mv: missing file operand', exitCode: 1 };
      }
      const srcPath = resolve(args[0], shellState);
      const destPath = resolve(args[1], shellState);
      const result = vfs.moveNode(srcPath, destPath);
      if (result.exitCode !== 0) {
        return { stdout: '', stderr: `mv: ${result.stderr}`, exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });
}
