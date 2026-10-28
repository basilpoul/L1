import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import { applySymbolicMode, octalToPermissions } from '../../vfs/permissions';
import { executeCommand } from '../executor';
import type { ShellState } from '../../types';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

export function registerPermissionCommands() {
  // chmod
  registry.register({
    name: 'chmod',
    description: 'Change file permissions',
    usage: 'chmod <mode> <file>',
    flags: [],
    handler: (args, _flags, shellState, vfs) => {
      if (args.length < 2) {
        return { stdout: '', stderr: 'chmod: missing operand', exitCode: 1 };
      }

      const mode = args[0];
      const errors: string[] = [];

      for (let i = 1; i < args.length; i++) {
        const path = resolve(args[i], shellState);
        const node = vfs.getNode(path);

        if (!node) {
          errors.push(`chmod: cannot access '${args[i]}': No such file or directory`);
          continue;
        }

        let newPerms: string;
        if (/^\d{3,4}$/.test(mode)) {
          newPerms = octalToPermissions(mode);
        } else {
          newPerms = applySymbolicMode(node.permissions, mode);
        }

        vfs.setPermissions(path, newPerms);
      }

      if (errors.length > 0) {
        return { stdout: '', stderr: errors.join('\n'), exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // chown
  registry.register({
    name: 'chown',
    description: 'Change file owner and group',
    usage: 'chown <owner[:group]> <file>',
    flags: [],
    handler: (args, _flags, shellState, vfs) => {
      if (args.length < 2) {
        return { stdout: '', stderr: 'chown: missing operand', exitCode: 1 };
      }

      if (!shellState.isRoot) {
        return { stdout: '', stderr: 'chown: Operation not permitted (use sudo)', exitCode: 1 };
      }

      const ownerSpec = args[0];
      const parts = ownerSpec.split(':');
      const owner = parts[0];
      const group = parts[1];

      const errors: string[] = [];

      for (let i = 1; i < args.length; i++) {
        const path = resolve(args[i], shellState);
        const result = vfs.setOwner(path, owner, group);
        if (result.exitCode !== 0) {
          errors.push(result.stderr);
        }
      }

      if (errors.length > 0) {
        return { stdout: '', stderr: errors.join('\n'), exitCode: 1 };
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // sudo
  registry.register({
    name: 'sudo',
    description: 'Execute a command as root',
    usage: 'sudo <command>',
    flags: [],
    handler: async (args, _flags, shellState, vfs, _stdin, context) => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'sudo: missing command', exitCode: 1 };
      }

      const prevRoot = shellState.isRoot;
      shellState.isRoot = true;

      try {
        const cmdStr = args.join(' ');
        const result = await executeCommand(cmdStr, shellState, vfs, context!);
        return result;
      } finally {
        shellState.isRoot = prevRoot;
      }
    },
  });

  // whoami
  registry.register({
    name: 'whoami',
    description: 'Print current user name',
    usage: 'whoami',
    flags: [],
    handler: (_args, _flags, shellState) => {
      const user = shellState.isRoot ? 'root' : (shellState.env['USER'] || 'user');
      return { stdout: user, stderr: '', exitCode: 0 };
    },
  });

  // id
  registry.register({
    name: 'id',
    description: 'Print user identity',
    usage: 'id',
    flags: [],
    handler: (_args, _flags, shellState) => {
      if (shellState.isRoot) {
        return { stdout: 'uid=0(root) gid=0(root) groups=0(root)', stderr: '', exitCode: 0 };
      }
      return {
        stdout: 'uid=1000(user) gid=1000(user) groups=1000(user),4(adm),24(cdrom),27(sudo)',
        stderr: '',
        exitCode: 0,
      };
    },
  });
}
