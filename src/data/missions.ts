import type { Mission } from '../types';
import type { VirtualFileSystem } from '../vfs/fileSystem';
import { isServiceRunning } from '../shell/commands/sysadmin';

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

  // ── Expert (16-25): SysAdmin & Scripting ──────────────────────

  {
    id: 'mission-16',
    title: 'Column Extraction',
    description:
      'Use `cut` or `awk` on /etc/passwd to extract all usernames and save them to ~/users.txt.',
    difficulty: 'expert',
    hint: "cut -d: -f1 /etc/passwd > ~/users.txt   or   awk -F: '{print $1}' /etc/passwd > ~/users.txt",
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/users.txt', true);
      if (!node || node.type !== 'file' || !node.content) return false;
      const content = node.content;
      return content.includes('root') && content.includes('user') && !content.includes('/bin/bash');
    },
  },

  {
    id: 'mission-17',
    title: 'Stream Editing',
    description:
      'Use `sed` to replace all instances of WARN with WARNING in /var/log/syslog and save to ~/cleaned.log.',
    difficulty: 'expert',
    hint: "sed 's/WARN/WARNING/g' /var/log/syslog > ~/cleaned.log",
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/cleaned.log', true);
      if (!node || node.type !== 'file' || !node.content) return false;
      const lines = node.content.split('\n');
      return lines.length > 5 && node.content.includes('WARNING');
    },
  },

  {
    id: 'mission-18',
    title: 'Symbolic Links',
    description:
      'Create a symbolic link at ~/logs pointing to /var/log using `ln -s`.',
    difficulty: 'expert',
    hint: 'ln -s /var/log ~/logs',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/logs', false);
      if (!node) return false;
      return node.type === 'symlink' && (node.target === '/var/log' || node.target?.includes('var/log') === true);
    },
  },

  {
    id: 'mission-19',
    title: 'Archive & Backup',
    description:
      'Bundle /home/user/projects into ~/backup.tar.gz using `tar`.',
    difficulty: 'expert',
    hint: 'tar -czvf ~/backup.tar.gz ~/projects',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/backup.tar.gz', true);
      if (!node || node.type !== 'file' || !node.content) return false;
      return node.content.startsWith('TAR_ARCHIVE_V1:') && node.content.includes('projects');
    },
  },

  {
    id: 'mission-20',
    title: 'Service Recovery',
    description:
      'Diagnose why `curl http://localhost:80` fails, start the nginx service via `sudo systemctl start nginx`, and verify its status.',
    difficulty: 'expert',
    hint: 'sudo systemctl start nginx && systemctl status nginx',
    completed: false,
    validator: (_vfs: VirtualFileSystem, history: string[]): boolean => {
      const isRunning = isServiceRunning('nginx');
      const hasSystemctlCmd = history.some(cmd => cmd.includes('systemctl') && cmd.includes('nginx'));
      return isRunning && hasSystemctlCmd;
    },
  },

  {
    id: 'mission-21',
    title: 'Package Management & JSON',
    description:
      'Install jq using `sudo apt install jq`, fetch https://api.linuxsim.local/users with `curl`, and extract the names to ~/api_users.txt.',
    difficulty: 'expert',
    hint: "sudo apt install jq && curl -s https://api.linuxsim.local/users | jq '.[].name' > ~/api_users.txt",
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const node = vfs.getNode('/home/user/api_users.txt', true);
      if (!node || node.type !== 'file' || !node.content) return false;
      return node.content.includes('Linus Torvalds') && node.content.includes('Dennis Ritchie');
    },
  },

  {
    id: 'mission-22',
    title: 'Writing a Bash Script',
    description:
      'Create ~/sys_check.sh, make it executable (`chmod +x`), and have it output the current user and uptime into ~/report.txt.',
    difficulty: 'expert',
    hint: "echo -e '#!/bin/bash\\nwhoami > ~/report.txt\\nuptime >> ~/report.txt' > ~/sys_check.sh && chmod +x ~/sys_check.sh && ./sys_check.sh",
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const scriptNode = vfs.getNode('/home/user/sys_check.sh', false);
      const reportNode = vfs.getNode('/home/user/report.txt', true);
      if (!scriptNode || scriptNode.type !== 'file') return false;
      if (!scriptNode.permissions.includes('x')) return false;
      if (!reportNode || !reportNode.content) return false;
      return reportNode.content.length > 5;
    },
  },

  {
    id: 'mission-23',
    title: 'Bash Loops & Args',
    description:
      'Write and run a script ~/greet.sh that takes an argument $1 and echoes "Hello, $1".',
    difficulty: 'expert',
    hint: 'echo \'echo "Hello, $1"\' > ~/greet.sh && bash ~/greet.sh World',
    completed: false,
    validator: (vfs: VirtualFileSystem, history: string[]): boolean => {
      const scriptNode = vfs.getNode('/home/user/greet.sh', true);
      if (!scriptNode || !scriptNode.content) return false;
      const hasArgPattern = scriptNode.content.includes('$1') || scriptNode.content.includes('Hello');
      const hasRunCmd = history.some(cmd => cmd.includes('greet.sh'));
      return hasArgPattern && hasRunCmd;
    },
  },

  {
    id: 'mission-24',
    title: 'Persistent Environment',
    description:
      "Add custom alias `alias ports='netstat -tuln'` to ~/.bashrc.",
    difficulty: 'expert',
    hint: "echo \"alias ports='netstat -tuln'\" >> ~/.bashrc",
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const bashrc = vfs.getNode('/home/user/.bashrc', true);
      if (!bashrc || !bashrc.content) return false;
      return bashrc.content.includes('alias ports=');
    },
  },

  {
    id: 'mission-25',
    title: 'Security Audit',
    description:
      'Inspect open ports with `netstat -tuln` and save the output to ~/audit.txt.',
    difficulty: 'expert',
    hint: 'netstat -tuln > ~/audit.txt',
    completed: false,
    validator: (vfs: VirtualFileSystem, _history: string[]): boolean => {
      const auditNode = vfs.getNode('/home/user/audit.txt', true);
      if (!auditNode || !auditNode.content) return false;
      return auditNode.content.includes('Active Internet connections') || auditNode.content.includes('127.0.0.53:53') || auditNode.content.includes('LISTEN');
    },
  },
];
