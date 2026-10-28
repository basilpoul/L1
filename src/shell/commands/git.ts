import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import type { ShellState, CommandResult } from '../../types';
import type { VirtualFileSystem } from '../../vfs/fileSystem';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  message: string;
  branch: string;
  tree: Record<string, string>; // relativePath -> fileContent
  parent?: string;
}

export interface GitStaging {
  staged: Record<string, string>; // relativePath -> content
  deleted: string[];
}

/**
 * Traverses up from cwd to find a directory containing .git
 */
export function findRepoRoot(cwd: string, vfs: VirtualFileSystem): string | null {
  let current = cwd;
  while (true) {
    const gitPath = current === '/' ? '/.git' : `${current}/.git`;
    const gitNode = vfs.getNode(gitPath, false);
    if (gitNode && gitNode.type === 'dir') {
      return current;
    }
    if (current === '/' || !current) break;
    const lastSlash = current.lastIndexOf('/');
    current = lastSlash <= 0 ? '/' : current.slice(0, lastSlash);
  }
  return null;
}

/**
 * Returns active branch and dirty status for the prompt
 */
export function getGitBranchInfo(
  cwd: string,
  vfs: VirtualFileSystem
): { branch: string; isDirty: boolean } | null {
  const repoRoot = findRepoRoot(cwd, vfs);
  if (!repoRoot) return null;

  const headPath = `${repoRoot}/.git/HEAD`;
  const headNode = vfs.getNode(headPath, true);
  if (!headNode || !headNode.content) return null;

  const headContent = headNode.content.trim();
  let branch = 'main';
  if (headContent.startsWith('ref: refs/heads/')) {
    branch = headContent.replace('ref: refs/heads/', '').trim();
  } else if (headContent.length >= 7) {
    branch = headContent.slice(0, 7);
  }

  // Check staging
  let isDirty = false;
  const stagingNode = vfs.getNode(`${repoRoot}/.git/staging.json`, true);
  if (stagingNode && stagingNode.content) {
    try {
      const staging: GitStaging = JSON.parse(stagingNode.content);
      if (Object.keys(staging.staged).length > 0 || (staging.deleted && staging.deleted.length > 0)) {
        isDirty = true;
      }
    } catch {
      // ignore
    }
  }

  // Check working directory modifications against HEAD
  if (!isDirty) {
    const commitsNode = vfs.getNode(`${repoRoot}/.git/commits.json`, true);
    let headTree: Record<string, string> = {};
    if (commitsNode && commitsNode.content) {
      try {
        const commits: GitCommit[] = JSON.parse(commitsNode.content);
        const branchCommits = commits.filter(c => c.branch === branch);
        if (branchCommits.length > 0) {
          headTree = branchCommits[branchCommits.length - 1].tree;
        }
      } catch {
        // ignore
      }
    }

    const workingFiles = getAllRepoFiles(repoRoot, repoRoot, vfs);
    for (const [relPath, content] of Object.entries(workingFiles)) {
      if (headTree[relPath] === undefined || headTree[relPath] !== content) {
        isDirty = true;
        break;
      }
    }
    if (!isDirty) {
      for (const relPath of Object.keys(headTree)) {
        if (workingFiles[relPath] === undefined) {
          isDirty = true;
          break;
        }
      }
    }
  }

  return { branch, isDirty };
}

/**
 * Recursively scans files in repo excluding .git
 */
function getAllRepoFiles(
  dirPath: string,
  repoRoot: string,
  vfs: VirtualFileSystem
): Record<string, string> {
  const result: Record<string, string> = {};
  const node = vfs.getNode(dirPath, false);
  if (!node || node.type !== 'dir' || !node.children) return result;

  for (const [name, child] of node.children.entries()) {
    if (name === '.git') continue;
    const fullPath = dirPath === '/' ? `/${name}` : `${dirPath}/${name}`;
    const relPath = fullPath.startsWith(repoRoot)
      ? fullPath.slice(repoRoot.length).replace(/^\//, '')
      : fullPath;

    if (child.type === 'file') {
      result[relPath] = child.content ?? '';
    } else if (child.type === 'dir') {
      const sub = getAllRepoFiles(fullPath, repoRoot, vfs);
      Object.assign(result, sub);
    }
  }

  return result;
}

function formatDate(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} ${d.getFullYear()} +0000`;
}

export function registerGitCommands() {
  registry.register({
    name: 'git',
    description: 'Fast, scalable, distributed revision control system',
    usage: 'git <command> [<args>]',
    flags: [],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      if (args.length === 0) {
        return {
          stdout: `usage: git [--version] [--help] <command> [<args>]

These are common Git commands used in various situations:

start a working area
   init       Create an empty Git repository or reinitialize an existing one
   clone      Clone a repository into a new directory

work on the current change
   add        Add file contents to the index
   status     Show the working tree status
   diff       Show changes between commits, commit and working tree, etc

examine the history and state
   log        Show commit logs
   branch     List, create, or delete branches
   checkout   Switch branches or restore working tree files
   merge      Join two or more development histories together`,
          stderr: '',
          exitCode: 0,
        };
      }

      const subcommand = args[0];
      const subArgs = args.slice(1);

      // --- git init ---
      if (subcommand === 'init') {
        const targetDir = subArgs[0] ? resolve(subArgs[0], shellState) : shellState.cwd;
        const gitDir = targetDir === '/' ? '/.git' : `${targetDir}/.git`;

        vfs.createDirectory(gitDir, true);
        vfs.writeFile(`${gitDir}/HEAD`, 'ref: refs/heads/main\n');
        vfs.writeFile(
          `${gitDir}/config`,
          '[core]\n\trepositoryformatversion = 0\n\tfilemode = true\n\tbare = false\n[user]\n\tname = user\n\temail = user@linux-box\n'
        );
        vfs.writeFile(`${gitDir}/commits.json`, '[]');
        vfs.writeFile(`${gitDir}/staging.json`, JSON.stringify({ staged: {}, deleted: [] }));
        vfs.writeFile(`${gitDir}/branches.json`, JSON.stringify(['main']));

        return {
          stdout: `Initialized empty Git repository in ${gitDir}/`,
          stderr: '',
          exitCode: 0,
        };
      }

      // --- git clone ---
      if (subcommand === 'clone') {
        if (subArgs.length === 0) {
          return { stdout: '', stderr: 'fatal: You must specify a repository to clone.', exitCode: 128 };
        }
        const repoUrl = subArgs[0];
        let defaultName = repoUrl.split('/').pop()?.replace(/\.git$/, '') || 'repo';
        const targetDirName = subArgs[1] || defaultName;
        const targetPath = resolve(targetDirName, shellState);

        vfs.createDirectory(targetPath, true);
        const gitDir = `${targetPath}/.git`;
        vfs.createDirectory(gitDir, true);
        vfs.writeFile(`${gitDir}/HEAD`, 'ref: refs/heads/main\n');
        vfs.writeFile(`${gitDir}/branches.json`, JSON.stringify(['main']));
        vfs.writeFile(`${gitDir}/staging.json`, JSON.stringify({ staged: {}, deleted: [] }));

        if (repoUrl.includes('webapp')) {
          // Pre-populate webapp repository
          vfs.writeFile(
            `${targetPath}/package.json`,
            JSON.stringify(
              {
                name: 'webapp',
                version: '1.0.0',
                description: 'Production Node.js service',
                main: 'server.js',
                scripts: { start: 'node server.js' },
              },
              null,
              2
            )
          );
          vfs.writeFile(
            `${targetPath}/server.js`,
            `const http = require('http');\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, { 'Content-Type': 'text/plain' });\n  res.end('Webapp v1.0 running\\n');\n});\nserver.listen(8080, () => console.log('Listening on port 8080'));\n`
          );
          vfs.writeFile(`${targetPath}/README.md`, '# Production Webapp\nNode.js production service.\n');
          vfs.writeFile(`${targetPath}/.gitignore`, 'node_modules/\n.env\n*.log\n');

          const initialTree = {
            'package.json': vfs.getNode(`${targetPath}/package.json`)?.content || '',
            'server.js': vfs.getNode(`${targetPath}/server.js`)?.content || '',
            'README.md': vfs.getNode(`${targetPath}/README.md`)?.content || '',
            '.gitignore': 'node_modules/\n.env\n*.log\n',
          };

          const commits: GitCommit[] = [
            {
              hash: '1a2b3c4',
              author: 'user <user@linux-box>',
              date: formatDate(new Date(Date.now() - 86400000 * 2)),
              message: 'feat: initial commit',
              branch: 'main',
              tree: initialTree,
            },
            {
              hash: '5d6e7f8',
              author: 'user <user@linux-box>',
              date: formatDate(new Date(Date.now() - 86400000)),
              message: 'fix: add production server configuration',
              branch: 'main',
              tree: initialTree,
              parent: '1a2b3c4',
            },
          ];
          vfs.writeFile(`${gitDir}/commits.json`, JSON.stringify(commits, null, 2));
        } else if (repoUrl.includes('audit-tools')) {
          vfs.writeFile(`${targetPath}/audit.sh`, '#!/bin/bash\necho "Running security audit..."\n');
          vfs.writeFile(`${targetPath}/rules.json`, '{"version": 1, "strict": true}\n');
          vfs.writeFile(`${targetPath}/README.md`, '# Security Audit Tools\n');

          const commits: GitCommit[] = [
            {
              hash: '8f9e0a1',
              author: 'sec-team <sec@linux-box>',
              date: formatDate(new Date()),
              message: 'Initial security rules',
              branch: 'main',
              tree: {
                'audit.sh': '#!/bin/bash\necho "Running security audit..."\n',
                'rules.json': '{"version": 1, "strict": true}\n',
                'README.md': '# Security Audit Tools\n',
              },
            },
          ];
          vfs.writeFile(`${gitDir}/commits.json`, JSON.stringify(commits, null, 2));
        } else {
          vfs.writeFile(`${targetPath}/README.md`, `# ${targetDirName}\nCloned from ${repoUrl}\n`);
          vfs.writeFile(`${gitDir}/commits.json`, '[]');
        }

        return {
          stdout: `Cloning into '${targetDirName}'...
remote: Enumerating objects: 6, done.
remote: Counting objects: 100% (6/6), done.
remote: Compressing objects: 100% (4/4), done.
remote: Total 6 (delta 1), reused 6 (delta 1)
Receiving objects: 100% (6/6), done.`,
          stderr: '',
          exitCode: 0,
        };
      }

      // Check if we are inside a Git repo
      const repoRoot = findRepoRoot(shellState.cwd, vfs);
      if (!repoRoot) {
        return {
          stdout: '',
          stderr: 'fatal: not a git repository (or any of the parent directories): .git',
          exitCode: 128,
        };
      }

      const gitDir = `${repoRoot}/.git`;
      const headNode = vfs.getNode(`${gitDir}/HEAD`, true);
      let activeBranch = 'main';
      if (headNode?.content?.startsWith('ref: refs/heads/')) {
        activeBranch = headNode.content.replace('ref: refs/heads/', '').trim();
      }

      const loadCommits = (): GitCommit[] => {
        try {
          const n = vfs.getNode(`${gitDir}/commits.json`, true);
          return n?.content ? JSON.parse(n.content) : [];
        } catch {
          return [];
        }
      };

      const loadStaging = (): GitStaging => {
        try {
          const n = vfs.getNode(`${gitDir}/staging.json`, true);
          return n?.content ? JSON.parse(n.content) : { staged: {}, deleted: [] };
        } catch {
          return { staged: {}, deleted: [] };
        }
      };

      const saveStaging = (s: GitStaging) => {
        vfs.writeFile(`${gitDir}/staging.json`, JSON.stringify(s, null, 2));
      };

      const loadBranches = (): string[] => {
        try {
          const n = vfs.getNode(`${gitDir}/branches.json`, true);
          return n?.content ? JSON.parse(n.content) : ['main'];
        } catch {
          return ['main'];
        }
      };

      const saveBranches = (b: string[]) => {
        vfs.writeFile(`${gitDir}/branches.json`, JSON.stringify(b, null, 2));
      };

      // --- git status ---
      if (subcommand === 'status') {
        const commits = loadCommits();
        const branchCommits = commits.filter(c => c.branch === activeBranch);
        const headTree = branchCommits.length > 0 ? branchCommits[branchCommits.length - 1].tree : {};
        const staging = loadStaging();
        const workingFiles = getAllRepoFiles(repoRoot, repoRoot, vfs);

        const stagedFiles: string[] = Object.keys(staging.staged);
        const stagedDeleted: string[] = staging.deleted || [];

        const modifiedUnstaged: string[] = [];
        const deletedUnstaged: string[] = [];
        const untracked: string[] = [];

        // Check working tree files
        for (const [relPath, content] of Object.entries(workingFiles)) {
          if (staging.staged[relPath] !== undefined) {
            if (staging.staged[relPath] !== content) {
              modifiedUnstaged.push(relPath);
            }
          } else if (headTree[relPath] !== undefined) {
            if (headTree[relPath] !== content) {
              modifiedUnstaged.push(relPath);
            }
          } else {
            untracked.push(relPath);
          }
        }

        // Check for files deleted in working tree but in HEAD
        for (const relPath of Object.keys(headTree)) {
          if (workingFiles[relPath] === undefined && !stagedDeleted.includes(relPath)) {
            deletedUnstaged.push(relPath);
          }
        }

        let out = `On branch ${activeBranch}\n`;

        if (branchCommits.length === 0) {
          out += '\nNo commits yet\n';
        }

        if (stagedFiles.length > 0 || stagedDeleted.length > 0) {
          out += '\nChanges to be committed:\n  (use "git restore --staged <file>..." to unstage)\n';
          for (const f of stagedFiles) {
            const isNew = headTree[f] === undefined;
            out += `\t<span style="color:#4ade80">${isNew ? 'new file:   ' : 'modified:   '}${f}</span>\n`;
          }
          for (const f of stagedDeleted) {
            out += `\t<span style="color:#4ade80">deleted:    ${f}</span>\n`;
          }
        }

        if (modifiedUnstaged.length > 0 || deletedUnstaged.length > 0) {
          out += '\nChanges not staged for commit:\n  (use "git add <file>..." to update what will be committed)\n';
          for (const f of modifiedUnstaged) {
            out += `\t<span style="color:#f87171">modified:   ${f}</span>\n`;
          }
          for (const f of deletedUnstaged) {
            out += `\t<span style="color:#f87171">deleted:    ${f}</span>\n`;
          }
        }

        if (untracked.length > 0) {
          out += '\nUntracked files:\n  (use "git add <file>..." to include in what will be committed)\n';
          for (const f of untracked) {
            out += `\t<span style="color:#f87171">${f}</span>\n`;
          }
        }

        if (
          stagedFiles.length === 0 &&
          stagedDeleted.length === 0 &&
          modifiedUnstaged.length === 0 &&
          deletedUnstaged.length === 0 &&
          untracked.length === 0
        ) {
          out += 'nothing to commit, working tree clean';
        }

        return { stdout: out.trimEnd(), stderr: '', exitCode: 0 };
      }

      // --- git add ---
      if (subcommand === 'add') {
        if (subArgs.length === 0) {
          return { stdout: '', stderr: 'Nothing specified, nothing added.', exitCode: 0 };
        }
        const staging = loadStaging();
        const workingFiles = getAllRepoFiles(repoRoot, repoRoot, vfs);

        if (subArgs[0] === '.' || subArgs[0] === '-A' || subArgs[0] === '*') {
          for (const [relPath, content] of Object.entries(workingFiles)) {
            staging.staged[relPath] = content;
          }
          saveStaging(staging);
          return { stdout: '', stderr: '', exitCode: 0 };
        }

        for (const fileArg of subArgs) {
          const fullPath = resolve(fileArg, shellState);
          const relPath = fullPath.startsWith(repoRoot)
            ? fullPath.slice(repoRoot.length).replace(/^\//, '')
            : fileArg;

          const node = vfs.getNode(fullPath, true);
          if (node && node.type === 'file') {
            staging.staged[relPath] = node.content ?? '';
            // Remove from deleted list if present
            staging.deleted = staging.deleted.filter(d => d !== relPath);
          } else if (!node) {
            // Deleted file
            staging.deleted.push(relPath);
            delete staging.staged[relPath];
          }
        }

        saveStaging(staging);
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      // --- git commit ---
      if (subcommand === 'commit') {
        let message = '';
        for (let i = 0; i < subArgs.length; i++) {
          if (subArgs[i] === '-m' && subArgs[i + 1]) {
            message = subArgs[i + 1];
            break;
          }
        }
        if (!message) {
          return { stdout: '', stderr: 'error: switch `m\' requires a value', exitCode: 1 };
        }

        const staging = loadStaging();
        const stagedKeys = Object.keys(staging.staged);
        const deletedKeys = staging.deleted || [];

        if (stagedKeys.length === 0 && deletedKeys.length === 0) {
          return {
            stdout: 'On branch ' + activeBranch + '\nnothing to commit, working tree clean',
            stderr: '',
            exitCode: 1,
          };
        }

        const commits = loadCommits();
        const branchCommits = commits.filter(c => c.branch === activeBranch);
        const prevCommit = branchCommits.length > 0 ? branchCommits[branchCommits.length - 1] : undefined;
        const newTree: Record<string, string> = prevCommit ? { ...prevCommit.tree } : {};

        for (const [relPath, content] of Object.entries(staging.staged)) {
          newTree[relPath] = content;
        }
        for (const relPath of deletedKeys) {
          delete newTree[relPath];
        }

        const hash = Math.random().toString(16).substring(2, 9);
        const newCommit: GitCommit = {
          hash,
          author: `${shellState.env['USER'] || 'user'} <${shellState.env['USER'] || 'user'}@linux-box>`,
          date: formatDate(new Date()),
          message,
          branch: activeBranch,
          tree: newTree,
          parent: prevCommit?.hash,
        };

        commits.push(newCommit);
        vfs.writeFile(`${gitDir}/commits.json`, JSON.stringify(commits, null, 2));

        // Clear staging
        saveStaging({ staged: {}, deleted: [] });

        const count = stagedKeys.length + deletedKeys.length;
        return {
          stdout: `[${activeBranch} ${hash}] ${message}\n ${count} file${count > 1 ? 's' : ''} changed`,
          stderr: '',
          exitCode: 0,
        };
      }

      // --- git log ---
      if (subcommand === 'log') {
        const commits = loadCommits();
        const branchCommits = commits.filter(c => c.branch === activeBranch).reverse();
        if (branchCommits.length === 0) {
          return { stdout: '', stderr: `fatal: your current branch '${activeBranch}' does not have any commits yet`, exitCode: 128 };
        }

        const isOneLine = subArgs.includes('--oneline');
        let count = branchCommits.length;
        const nIndex = subArgs.findIndex(a => a === '-n' || a.startsWith('-n'));
        if (nIndex !== -1) {
          const val = subArgs[nIndex] === '-n' ? parseInt(subArgs[nIndex + 1], 10) : parseInt(subArgs[nIndex].slice(2), 10);
          if (!isNaN(val)) count = val;
        }

        const selected = branchCommits.slice(0, count);

        if (isOneLine) {
          const lines = selected.map(c => `${c.hash} ${c.message}`);
          return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
        }

        const out = selected
          .map((c, idx) => {
            const headTag = idx === 0 ? ` (HEAD -> ${activeBranch})` : '';
            return `commit ${c.hash}${headTag}\nAuthor: ${c.author}\nDate:   ${c.date}\n\n    ${c.message}\n`;
          })
          .join('\n');

        return { stdout: out.trimEnd(), stderr: '', exitCode: 0 };
      }

      // --- git branch ---
      if (subcommand === 'branch') {
        const branches = loadBranches();
        if (subArgs.length === 0) {
          const out = branches
            .map(b => (b === activeBranch ? `* <span style="color:#4ade80">${b}</span>` : `  ${b}`))
            .join('\n');
          return { stdout: out, stderr: '', exitCode: 0 };
        }

        if (subArgs[0] === '-d' || subArgs[0] === '-D') {
          const toDelete = subArgs[1];
          if (!toDelete) return { stdout: '', stderr: 'fatal: branch name required', exitCode: 1 };
          if (toDelete === activeBranch) {
            return { stdout: '', stderr: `error: Cannot delete branch '${toDelete}' checked out`, exitCode: 1 };
          }
          const updated = branches.filter(b => b !== toDelete);
          saveBranches(updated);
          return { stdout: `Deleted branch ${toDelete}.`, stderr: '', exitCode: 0 };
        }

        const newBranch = subArgs[0];
        if (branches.includes(newBranch)) {
          return { stdout: '', stderr: `fatal: a branch named '${newBranch}' already exists`, exitCode: 128 };
        }
        branches.push(newBranch);
        saveBranches(branches);
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      // --- git checkout ---
      if (subcommand === 'checkout') {
        if (subArgs.length === 0) {
          return { stdout: '', stderr: 'fatal: you must specify a branch or file to checkout', exitCode: 1 };
        }

        const branches = loadBranches();
        const commits = loadCommits();

        if (subArgs[0] === '-b') {
          const newBranch = subArgs[1];
          if (!newBranch) {
            return { stdout: '', stderr: 'fatal: missing branch name', exitCode: 1 };
          }
          if (branches.includes(newBranch)) {
            return { stdout: '', stderr: `fatal: a branch named '${newBranch}' already exists`, exitCode: 128 };
          }
          branches.push(newBranch);
          saveBranches(branches);
          vfs.writeFile(`${gitDir}/HEAD`, `ref: refs/heads/${newBranch}\n`);
          return { stdout: `Switched to a new branch '${newBranch}'`, stderr: '', exitCode: 0 };
        }

        const target = subArgs[0];
        if (branches.includes(target)) {
          // Switch active branch
          vfs.writeFile(`${gitDir}/HEAD`, `ref: refs/heads/${target}\n`);

          // Restore files from target branch's latest commit
          const targetCommits = commits.filter(c => c.branch === target);
          if (targetCommits.length > 0) {
            const targetTree = targetCommits[targetCommits.length - 1].tree;
            for (const [relPath, content] of Object.entries(targetTree)) {
              vfs.writeFile(`${repoRoot}/${relPath}`, content);
            }
          }
          return { stdout: `Switched to branch '${target}'`, stderr: '', exitCode: 0 };
        }

        // Restore file from HEAD
        const branchCommits = commits.filter(c => c.branch === activeBranch);
        if (branchCommits.length > 0) {
          const headTree = branchCommits[branchCommits.length - 1].tree;
          if (headTree[target] !== undefined) {
            vfs.writeFile(`${repoRoot}/${target}`, headTree[target]);
            return { stdout: `Updated 1 path from the index`, stderr: '', exitCode: 0 };
          }
        }

        return { stdout: '', stderr: `error: pathspec '${target}' did not match any file(s) known to git`, exitCode: 1 };
      }

      // --- git diff ---
      if (subcommand === 'diff') {
        const commits = loadCommits();
        const branchCommits = commits.filter(c => c.branch === activeBranch);
        const headTree = branchCommits.length > 0 ? branchCommits[branchCommits.length - 1].tree : {};
        const staging = loadStaging();
        const workingFiles = getAllRepoFiles(repoRoot, repoRoot, vfs);

        const diffs: string[] = [];
        for (const [relPath, workingContent] of Object.entries(workingFiles)) {
          const baseContent = staging.staged[relPath] !== undefined ? staging.staged[relPath] : headTree[relPath];
          if (baseContent !== undefined && baseContent !== workingContent) {
            diffs.push(`diff --git a/${relPath} b/${relPath}
--- a/${relPath}
+++ b/${relPath}
@@ -1,${baseContent.split('\n').length} +1,${workingContent.split('\n').length} @@
${baseContent.split('\n').map(l => `-${l}`).join('\n')}
${workingContent.split('\n').map(l => `+${l}`).join('\n')}`);
          }
        }

        return { stdout: diffs.join('\n\n'), stderr: '', exitCode: 0 };
      }

      // --- git merge ---
      if (subcommand === 'merge') {
        const targetBranch = subArgs[0];
        if (!targetBranch) {
          return { stdout: '', stderr: 'fatal: No remote for the current branch.', exitCode: 1 };
        }
        const branches = loadBranches();
        if (!branches.includes(targetBranch)) {
          return { stdout: '', stderr: `merge: ${targetBranch} - not something we can merge`, exitCode: 1 };
        }

        const commits = loadCommits();
        const targetCommits = commits.filter(c => c.branch === targetBranch);
        if (targetCommits.length === 0) {
          return { stdout: 'Already up to date.', stderr: '', exitCode: 0 };
        }

        const targetTree = targetCommits[targetCommits.length - 1].tree;
        for (const [relPath, content] of Object.entries(targetTree)) {
          vfs.writeFile(`${repoRoot}/${relPath}`, content);
        }

        // Add a merge commit
        const hash = Math.random().toString(16).substring(2, 9);
        commits.push({
          hash,
          author: `${shellState.env['USER'] || 'user'} <${shellState.env['USER'] || 'user'}@linux-box>`,
          date: formatDate(new Date()),
          message: `Merge branch '${targetBranch}' into ${activeBranch}`,
          branch: activeBranch,
          tree: targetTree,
        });
        vfs.writeFile(`${gitDir}/commits.json`, JSON.stringify(commits, null, 2));

        return {
          stdout: `Updating ${activeBranch}...\nFast-forward\nMerge made by the 'ort' strategy.`,
          stderr: '',
          exitCode: 0,
        };
      }

      return {
        stdout: '',
        stderr: `git: '${subcommand}' is not a git command. See 'git --help'.`,
        exitCode: 1,
      };
    },
  });
}
