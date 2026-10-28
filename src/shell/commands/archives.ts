import { registry } from '../commandRegistry';
import { resolvePath, getBasename, getParentPath } from '../../vfs/pathResolver';
import type { ShellState, CommandResult, VFSNode } from '../../types';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

interface ArchiveEntry {
  path: string;
  type: 'file' | 'dir';
  content?: string;
  permissions: string;
  size: number;
}

const TAR_HEADER = 'TAR_ARCHIVE_V1:';
const ZIP_HEADER = 'ZIP_ARCHIVE_V1:';

function collectTree(
  node: VFSNode,
  relPath: string,
  entries: ArchiveEntry[]
) {
  entries.push({
    path: relPath,
    type: node.type === 'dir' ? 'dir' : 'file',
    content: node.content,
    permissions: node.permissions,
    size: node.size,
  });

  if (node.type === 'dir' && node.children) {
    for (const [name, child] of node.children) {
      collectTree(child, `${relPath}/${name}`, entries);
    }
  }
}

export function registerArchiveCommands() {
  // ─── ln ────────────────────────────────────────────────────────
  registry.register({
    name: 'ln',
    description: 'Make links between files',
    usage: 'ln -s <target> <link_name>',
    flags: [
      { flag: '-s', description: 'Make symbolic links instead of hard links' },
    ],
    handler: (args, flags, shellState, vfs): CommandResult => {
      const isSymbolic = !!flags['s'] || args.includes('-s');
      const cleanArgs = args.filter(a => a !== '-s');

      if (!isSymbolic) {
        return {
          stdout: '',
          stderr: 'ln: hard links not supported in browser simulator; please use ln -s',
          exitCode: 1,
        };
      }

      if (cleanArgs.length < 2) {
        return { stdout: '', stderr: 'ln: missing destination file operand after target', exitCode: 1 };
      }

      const target = cleanArgs[0];
      const linkPath = resolve(cleanArgs[1], shellState);

      const result = vfs.createSymlink(linkPath, target, shellState.env['USER'] || 'user');
      return result;
    },
  });

  // ─── tar ───────────────────────────────────────────────────────
  registry.register({
    name: 'tar',
    description: 'An archiving utility',
    usage: 'tar -czvf <archive.tar.gz> <targets...> | tar -xzvf <archive.tar.gz>',
    flags: [
      { flag: '-c', description: 'Create a new archive' },
      { flag: '-x', description: 'Extract files from an archive' },
      { flag: '-t', description: 'List the contents of an archive' },
      { flag: '-v', description: 'Verbosely list files processed' },
      { flag: '-z', description: 'Filter the archive through gzip' },
      { flag: '-f', description: 'Use archive file' },
    ],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'tar: You must specify one of the -Acdtrux options', exitCode: 2 };
      }

      // Check flags in first argument e.g. -czvf or -xvf or separate flags
      let mode: 'create' | 'extract' | 'list' | null = null;
      let verbose = false;
      let archiveFile = '';
      const targetPaths: string[] = [];

      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('-')) {
          if (arg.includes('c')) mode = 'create';
          if (arg.includes('x')) mode = 'extract';
          if (arg.includes('t')) mode = 'list';
          if (arg.includes('v')) verbose = true;
          if (arg.includes('f')) {
            // Check if file is next arg or attached
            if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
              archiveFile = args[i + 1];
              i++;
            }
          }
        } else if (!archiveFile) {
          archiveFile = arg;
        } else {
          targetPaths.push(arg);
        }
      }

      if (!archiveFile) {
        return { stdout: '', stderr: 'tar: Refusing to read or write archive contents without -f', exitCode: 2 };
      }

      const fullArchive = resolve(archiveFile, shellState);

      // 1. CREATE MODE
      if (mode === 'create') {
        if (targetPaths.length === 0) {
          return { stdout: '', stderr: 'tar: Cowardly refusing to create an empty archive', exitCode: 2 };
        }

        const entries: ArchiveEntry[] = [];
        const verboseLines: string[] = [];

        for (const target of targetPaths) {
          const targetAbs = resolve(target, shellState);
          const node = vfs.getNode(targetAbs, false);
          if (!node) {
            return { stdout: '', stderr: `tar: ${target}: Cannot stat: No such file or directory`, exitCode: 2 };
          }
          const base = getBasename(targetAbs);
          collectTree(node, base, entries);
        }

        for (const e of entries) {
          verboseLines.push(e.path + (e.type === 'dir' ? '/' : ''));
        }

        const payload = TAR_HEADER + JSON.stringify(entries);
        vfs.writeFile(fullArchive, payload);

        return {
          stdout: verbose ? verboseLines.join('\n') : '',
          stderr: '',
          exitCode: 0,
        };
      }

      // 2. LIST MODE
      if (mode === 'list') {
        const node = vfs.getNode(fullArchive, true);
        if (!node) {
          return { stdout: '', stderr: `tar: ${archiveFile}: Cannot open: No such file or directory`, exitCode: 2 };
        }

        const content = node.content ?? '';
        if (!content.startsWith(TAR_HEADER)) {
          return { stdout: '', stderr: `tar: ${archiveFile}: This does not look like a tar archive`, exitCode: 2 };
        }

        const entries: ArchiveEntry[] = JSON.parse(content.substring(TAR_HEADER.length));
        const list = entries.map(e => e.path + (e.type === 'dir' ? '/' : ''));
        return { stdout: list.join('\n'), stderr: '', exitCode: 0 };
      }

      // 3. EXTRACT MODE
      if (mode === 'extract') {
        const node = vfs.getNode(fullArchive, true);
        if (!node) {
          return { stdout: '', stderr: `tar: ${archiveFile}: Cannot open: No such file or directory`, exitCode: 2 };
        }

        const content = node.content ?? '';
        if (!content.startsWith(TAR_HEADER)) {
          return { stdout: '', stderr: `tar: ${archiveFile}: This does not look like a tar archive`, exitCode: 2 };
        }

        const entries: ArchiveEntry[] = JSON.parse(content.substring(TAR_HEADER.length));
        const extractedLines: string[] = [];

        for (const e of entries) {
          const dest = resolve(e.path, shellState);
          if (e.type === 'dir') {
            vfs.createDirectory(dest, true);
          } else {
            // Ensure parent directory exists
            vfs.createDirectory(getParentPath(dest), true);
            vfs.writeFile(dest, e.content ?? '');
            vfs.setPermissions(dest, e.permissions);
          }
          extractedLines.push(e.path);
        }

        return {
          stdout: verbose ? extractedLines.join('\n') : '',
          stderr: '',
          exitCode: 0,
        };
      }

      return { stdout: '', stderr: 'tar: specify -c, -x, or -t', exitCode: 2 };
    },
  });

  // ─── zip ───────────────────────────────────────────────────────
  registry.register({
    name: 'zip',
    description: 'Package and compress (archive) files',
    usage: 'zip [-r] <archive.zip> <files...>',
    flags: [
      { flag: '-r', description: 'Recurse into directories' },
    ],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      const cleanArgs = args.filter(a => !a.startsWith('-'));
      if (cleanArgs.length < 2) {
        return { stdout: '', stderr: 'zip: usage: zip [-r] <archive.zip> <files...>', exitCode: 1 };
      }

      const zipFile = cleanArgs[0];
      const targetPaths = cleanArgs.slice(1);
      const fullZip = resolve(zipFile, shellState);

      const entries: ArchiveEntry[] = [];
      for (const target of targetPaths) {
        const targetAbs = resolve(target, shellState);
        const node = vfs.getNode(targetAbs, false);
        if (!node) {
          return { stdout: '', stderr: `zip: ${target}: No such file or directory`, exitCode: 1 };
        }
        collectTree(node, getBasename(targetAbs), entries);
      }

      const payload = ZIP_HEADER + JSON.stringify(entries);
      vfs.writeFile(fullZip, payload);

      const stdout = entries.map(e => `  adding: ${e.path}${e.type === 'dir' ? '/' : ''} (deflated 62%)`).join('\n');
      return { stdout, stderr: '', exitCode: 0 };
    },
  });

  // ─── unzip ─────────────────────────────────────────────────────
  registry.register({
    name: 'unzip',
    description: 'Extract compressed files in a ZIP archive',
    usage: 'unzip <archive.zip>',
    flags: [],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'unzip: missing archive file', exitCode: 1 };
      }

      const zipFile = args[0];
      const fullZip = resolve(zipFile, shellState);
      const node = vfs.getNode(fullZip, true);

      if (!node) {
        return { stdout: '', stderr: `unzip: cannot find or open ${zipFile}`, exitCode: 1 };
      }

      const content = node.content ?? '';
      if (!content.startsWith(ZIP_HEADER)) {
        return { stdout: '', stderr: `unzip: ${zipFile}: not a valid zip file`, exitCode: 1 };
      }

      const entries: ArchiveEntry[] = JSON.parse(content.substring(ZIP_HEADER.length));
      const extractedLines: string[] = [`Archive:  ${zipFile}`];

      for (const e of entries) {
        const dest = resolve(e.path, shellState);
        if (e.type === 'dir') {
          vfs.createDirectory(dest, true);
          extractedLines.push(`   creating: ${e.path}/`);
        } else {
          vfs.createDirectory(getParentPath(dest), true);
          vfs.writeFile(dest, e.content ?? '');
          vfs.setPermissions(dest, e.permissions);
          extractedLines.push(`  inflating: ${e.path}`);
        }
      }

      return { stdout: extractedLines.join('\n'), stderr: '', exitCode: 0 };
    },
  });
}
