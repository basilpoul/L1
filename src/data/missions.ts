import type { Mission } from '../types';
import { VirtualFileSystem } from '../vfs/fileSystem';

/**
 * 15 progressive missions that teach Linux fundamentals.
 * Each validator receives the VFS instance and the shell command history.
 */
export const missions: Mission[] = [
  // ── Beginner (1-5) ─────────────────────────────────────────────

  {
    id: 'mission-01',
    title: 'Hello Terminal',
    description:
      'Run your first command: type `whoami` to see who you are.',
    difficulty: 'beginner',
    hint: 'Just type whoami and press Enter.',
    completed: false,
    validator: (_vfs: VirtualFileSystem, history: string[]): boolean => {
      return history.some((cmd) => cmd.trim() === 'whoami');
    },
  },

  {
    id: 'mission-02',
    title: 'Where Am I?',
    description:
      'Use `pwd` to find your current directory, then `ls` to list its contents.',
    difficulty: 'beginner',
    hint: 'Run pwd first, then run ls.',
    completed: false,
    validator: (_vfs: VirtualFileSystem, history: string[]): boolean => {
      const hasPwd = history.some((cmd) => cmd.trim() === 'pwd');
      const hasLs = history.some((cmd) => cmd.trim().startsWith('ls'));
      return hasPwd && hasLs;
    },
  },

  {
    id: 'mission-03',
    title: 'Explorer',
    description:
      'Navigate to /var/log using `cd` and list the files there.',
    difficulty: 'beginner',
    hint: 'Type cd /var/log then ls.',
    completed: false,
    validator: (_vfs: VirtualFileSystem, history: string[]): boolean => {
      // Find a 'cd' that targets /var/log, then a subsequent 'ls'
      const cdIdx = history.findIndex(
        (cmd) =>
          cmd.trim().startsWith('cd ') && cmd.includes('/var/log'),
      );
      if (cdIdx === -1) return false;
      const hasSubsequentLs = history
        .slice(cdIdx + 1)
        .some((cmd) => cmd.trim().startsWith('ls'));
      return hasSubsequentLs;
    },
  },

  {
    id: 'mission-04',
    title: 'File Creator',
    description:
      "Create a new directory called 'practice' in your home folder, then create a file called 'hello.txt' inside it using `touch`.",
    difficulty: 'beginner',
    hint: 'Run mkdir ~/practice then touch ~/practice/hello.txt.',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/practice/hello.txt');
      return node !== null && node.type === 'file';
    },
  },

  {
    id: 'mission-05',
    title: 'Writer',
    description:
      'Write "Hello, Linux!" to a file using echo "Hello, Linux!" > ~/practice/greeting.txt',
    difficulty: 'beginner',
    hint: 'Type exactly: echo "Hello, Linux!" > ~/practice/greeting.txt',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/practice/greeting.txt');
      if (!node || node.type !== 'file') return false;
      return (node.content ?? '').includes('Hello, Linux!');
    },
  },

  // ── Intermediate (6-10) ────────────────────────────────────────

  {
    id: 'mission-06',
    title: 'Log Detective',
    description:
      'Navigate to /var/log and find all ERROR lines in syslog, then save them to ~/errors.txt.',
    difficulty: 'intermediate',
    hint: 'Try: grep ERROR /var/log/syslog > ~/errors.txt',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/errors.txt');
      if (!node || node.type !== 'file' || !node.content) return false;
      const lines = node.content.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) return false;
      // Every non-empty line must contain ERROR
      return lines.every((line) => line.includes('ERROR'));
    },
  },

  {
    id: 'mission-07',
    title: 'File Manager',
    description:
      "Copy /home/user/Documents/notes.txt to /home/user/Downloads/ and rename it to 'backup_notes.txt'.",
    difficulty: 'intermediate',
    hint: 'Try: cp ~/Documents/notes.txt ~/Downloads/backup_notes.txt',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const backup = vfs.getNode('/home/user/Downloads/backup_notes.txt');
      const original = vfs.getNode('/home/user/Documents/notes.txt');
      if (!backup || !original) return false;
      if (backup.type !== 'file' || original.type !== 'file') return false;
      return backup.content === original.content;
    },
  },

  {
    id: 'mission-08',
    title: 'Permission Master',
    description:
      'Create a script file ~/myscript.sh with some content and make it executable using chmod.',
    difficulty: 'intermediate',
    hint: 'Try: echo "#!/bin/bash" > ~/myscript.sh && chmod +x ~/myscript.sh',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/myscript.sh');
      if (!node || node.type !== 'file') return false;
      // Check that the owner execute bit is set
      const perms = node.permissions;
      // permissions string like 'rwxr-xr-x' – index 2 is owner execute
      return perms[2] === 'x' || perms[2] === 's';
    },
  },

  {
    id: 'mission-09',
    title: 'Pipe Wizard',
    description:
      'Use pipes to count the number of ERROR lines in /var/log/syslog (hint: grep ERROR /var/log/syslog | wc -l).',
    difficulty: 'intermediate',
    hint: 'Type: grep ERROR /var/log/syslog | wc -l',
    completed: false,
    validator: (_vfs: VirtualFileSystem, history: string[]): boolean => {
      return history.some(
        (cmd) =>
          cmd.includes('grep') && cmd.includes('wc') && cmd.includes('|'),
      );
    },
  },

  {
    id: 'mission-10',
    title: 'Directory Builder',
    description:
      'Create a nested directory structure ~/projects/webapp/src/components using mkdir -p.',
    difficulty: 'intermediate',
    hint: 'Type: mkdir -p ~/projects/webapp/src/components',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/projects/webapp/src/components');
      return node !== null && node.type === 'dir';
    },
  },

  // ── Advanced (11-15) ───────────────────────────────────────────

  {
    id: 'mission-11',
    title: 'System Admin',
    description:
      'Use `chmod 600` on secret.log to restrict access, then verify with `ls -l`.',
    difficulty: 'advanced',
    hint: 'Type: chmod 600 ~/Documents/secret.log && ls -l ~/Documents/secret.log',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/Documents/secret.log');
      if (!node || node.type !== 'file') return false;
      return node.permissions === 'rw-------';
    },
  },

  {
    id: 'mission-12',
    title: 'Text Surgeon',
    description:
      'Sort the lines in /etc/passwd alphabetically and save to ~/sorted_users.txt.',
    difficulty: 'advanced',
    hint: 'Try: sort /etc/passwd > ~/sorted_users.txt',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/sorted_users.txt');
      if (!node || node.type !== 'file' || !node.content) return false;
      const lines = node.content.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) return false;
      const sorted = [...lines].sort();
      return lines.every((line, i) => line === sorted[i]);
    },
  },

  {
    id: 'mission-13',
    title: 'Log Analyzer',
    description:
      'Find all unique WARNING messages in auth.log, sort them, and save to ~/warnings.txt.',
    difficulty: 'advanced',
    hint: 'Try: grep WARNING /var/log/auth.log | sort -u > ~/warnings.txt',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/warnings.txt');
      if (!node || node.type !== 'file' || !node.content) return false;
      const lines = node.content.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length === 0) return false;
      // All lines must contain WARNING
      const allWarnings = lines.every((line) => line.includes('WARNING'));
      // Lines must be unique
      const unique = new Set(lines);
      const areUnique = unique.size === lines.length;
      // Lines must be sorted
      const sorted = [...lines].sort();
      const areSorted = lines.every((line, i) => line === sorted[i]);
      return allWarnings && areUnique && areSorted;
    },
  },

  {
    id: 'mission-14',
    title: 'Cleanup Crew',
    description:
      'Remove the entire /home/user/Downloads directory recursively, then recreate it empty.',
    difficulty: 'advanced',
    hint: 'Try: rm -r ~/Downloads && mkdir ~/Downloads',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/Downloads');
      if (!node || node.type !== 'dir') return false;
      // Directory must be empty (no children, or children map size 0)
      const children = node.children;
      if (!children) return true; // no children map means empty
      return children.size === 0;
    },
  },

  {
    id: 'mission-15',
    title: 'Config Editor',
    description:
      'Use nano to edit config.json and change the port from 3000 to 8080, then save.',
    difficulty: 'advanced',
    hint: 'Type: nano ~/projects/config.json — then change "port": 3000 to "port": 8080 and save with Ctrl+S.',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/projects/config.json');
      if (!node || node.type !== 'file' || !node.content) return false;
      return node.content.includes('"port": 8080');
    },
  },
];
