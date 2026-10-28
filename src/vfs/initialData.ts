import type { VFSNode } from '../types';

const FIXED_DATE = new Date('2024-01-15T10:00:00');

/** Helper to create a file node */
function file(
  name: string,
  content: string,
  permissions: string = 'rw-r--r--',
  owner: string = 'user',
  group: string = 'user',
): VFSNode {
  return {
    name,
    type: 'file',
    content,
    permissions,
    owner,
    group,
    size: new Blob([content]).size,
    createdAt: new Date(FIXED_DATE),
    updatedAt: new Date(FIXED_DATE),
  };
}

/** Helper to create a directory node */
function dir(
  name: string,
  children: VFSNode[],
  permissions: string = 'rwxr-xr-x',
  owner: string = 'user',
  group: string = 'user',
): VFSNode {
  const childMap = new Map<string, VFSNode>();
  for (const child of children) {
    childMap.set(child.name, child);
  }
  return {
    name,
    type: 'dir',
    children: childMap,
    permissions,
    owner,
    group,
    size: 4096,
    createdAt: new Date(FIXED_DATE),
    updatedAt: new Date(FIXED_DATE),
  };
}

/** Helper to create an executable file (755) owned by root */
function binFile(name: string): VFSNode {
  return file(name, '', 'rwxr-xr-x', 'root', 'root');
}

const SYSLOG_CONTENT = `Oct 28 10:15:32 linux-box kernel: [    0.000000] Linux version 6.5.0-44-generic (buildd@lcy02-amd64-116)
Oct 28 10:15:32 linux-box kernel: [    0.000000] Command line: BOOT_IMAGE=/vmlinuz-6.5.0-44
Oct 28 10:15:32 linux-box kernel: [    0.523411] ACPI: Core revision 20230628
Oct 28 10:15:33 linux-box systemd[1]: Started Journal Service.
Oct 28 10:15:33 linux-box systemd[1]: Starting Create Volatile Files and Directories...
Oct 28 10:15:34 linux-box systemd[1]: Started Network Manager.
Oct 28 10:15:34 linux-box NetworkManager[892]: <info>  [1698487534] NetworkManager (1.44.2) starting...
Oct 28 10:15:35 linux-box systemd[1]: Started Login Service.
Oct 28 10:15:35 linux-box systemd[1]: Reached target Multi-User System.
Oct 28 10:16:01 linux-box CRON[1423]: (root) CMD (test -x /usr/sbin/anacron)
Oct 28 10:17:15 linux-box kernel: [  103.241523] usb 2-1: new high-speed USB device number 3
Oct 28 10:17:15 linux-box kernel: [  103.392541] usb-storage 2-1:1.0: USB Mass Storage device detected
Oct 28 10:20:44 linux-box systemd[1]: Starting Daily apt download activities...
Oct 28 10:20:45 linux-box systemd[1]: apt-daily.service: Deactivated successfully.
Oct 28 10:25:01 linux-box CRON[2156]: (user) CMD (/home/user/scripts/backup.sh)
Oct 28 10:30:12 linux-box kernel: [  880.124553] WARNING: CPU 0: possible deadlock detected
Oct 28 10:30:12 linux-box kernel: [  880.124560] WARNING: CPU 0: lock held for too long
Oct 28 10:35:22 linux-box systemd[1]: Starting Cleanup of Temporary Directories...
Oct 28 10:35:22 linux-box systemd[1]: systemd-tmpfiles-clean.service: Deactivated successfully.
Oct 28 10:40:01 linux-box CRON[2789]: (root) CMD (/usr/lib/php/sessionclean)
Oct 28 10:45:33 linux-box NetworkManager[892]: <warn>  [1698489933] device (eth0): link timed out.
Oct 28 10:45:34 linux-box NetworkManager[892]: <info>  [1698489934] device (eth0): link connected
Oct 28 10:50:17 linux-box kernel: [  2077.891234] ERROR: Out of memory: Killed process 3421 (chrome)
Oct 28 10:50:17 linux-box kernel: [  2077.891240] Out of memory: oom_score_adj 200
Oct 28 10:55:01 linux-box CRON[3502]: (root) CMD (command -v debian-sa1 > /dev/null)
Oct 28 11:00:00 linux-box systemd[1]: Starting logrotate.service - Rotate log files...
Oct 28 11:00:01 linux-box systemd[1]: logrotate.service: Deactivated successfully.
Oct 28 11:05:44 linux-box sshd[3891]: Server listening on 0.0.0.0 port 22.
Oct 28 11:10:22 linux-box systemd[1]: Started Daily man-db regeneration.
Oct 28 11:15:01 linux-box CRON[4102]: (root) CMD (test -x /usr/sbin/anacron)
`;

const AUTH_LOG_CONTENT = `Oct 28 10:15:33 linux-box systemd-logind[901]: New seat seat0.
Oct 28 10:15:33 linux-box systemd-logind[901]: Watching system buttons on /dev/input/event0
Oct 28 10:15:35 linux-box sshd[1102]: Server listening on 0.0.0.0 port 22.
Oct 28 10:15:35 linux-box sshd[1102]: Server listening on :: port 22.
Oct 28 10:18:42 linux-box sshd[1534]: Accepted publickey for user from 192.168.1.100 port 52341
Oct 28 10:18:42 linux-box sshd[1534]: pam_unix(sshd:session): session opened for user user(uid=1000)
Oct 28 10:18:42 linux-box systemd-logind[901]: New session 3 of user user.
Oct 28 10:25:17 linux-box sudo: user : TTY=pts/0 ; PWD=/home/user ; USER=root ; COMMAND=/usr/bin/apt update
Oct 28 10:25:17 linux-box sudo: pam_unix(sudo:session): session opened for user root(uid=0) by user(uid=1000)
Oct 28 10:30:55 linux-box sshd[2341]: Failed password for invalid user admin from 10.0.0.55 port 44321
Oct 28 10:30:55 linux-box sshd[2341]: WARNING: authentication failure; logname= uid=0 euid=0
Oct 28 10:30:58 linux-box sshd[2341]: Failed password for invalid user admin from 10.0.0.55 port 44321
Oct 28 10:31:01 linux-box sshd[2341]: Failed password for invalid user admin from 10.0.0.55 port 44321
Oct 28 10:31:01 linux-box sshd[2341]: error: maximum authentication attempts exceeded for admin from 10.0.0.55
Oct 28 10:31:01 linux-box sshd[2341]: Disconnecting invalid user admin 10.0.0.55 port 44321
Oct 28 10:45:22 linux-box sshd[2890]: Accepted password for user from 192.168.1.105 port 61234
Oct 28 10:45:22 linux-box sshd[2890]: pam_unix(sshd:session): session opened for user user(uid=1000)
Oct 28 11:00:15 linux-box sudo: user : TTY=pts/1 ; PWD=/home/user ; USER=root ; COMMAND=/usr/bin/systemctl restart nginx
Oct 28 11:05:44 linux-box sshd[2890]: pam_unix(sshd:session): session closed for user user
Oct 28 11:05:44 linux-box systemd-logind[901]: Session 5 logged out. Waiting for processes to exit.
`;

/**
 * Create the initial file system tree with a realistic Linux directory structure.
 */
export function createInitialFileSystem(): VFSNode {
  // /home/user/Documents
  const documents = dir('Documents', [
    file(
      'notes.txt',
      'Meeting notes from 2024-03-15\n- Discussed Q2 roadmap\n- Action items assigned\n- Follow up next week\n',
    ),
    file(
      'todo.md',
      '# TODO List\n\n- [x] Set up development environment\n- [ ] Review pull requests\n- [ ] Write documentation\n- [ ] Deploy to staging\n- [ ] Update dependencies\n',
    ),
    file(
      'secret.log',
      'ACCESS_KEY=sk_live_abc123\nDB_PASSWORD=super_secret_42\nAPI_TOKEN=tok_9f8e7d6c5b4a\n',
      'rw-------',
    ),
  ]);

  // /home/user/projects
  const projects = dir('projects', [
    file(
      'deploy.sh',
      '#!/bin/bash\n\n# Deployment script\necho "Starting deployment..."\ncd /var/www/app\ngit pull origin main\nnpm install\nnpm run build\nsudo systemctl restart app\necho "Deployment complete!"\n',
      'rwxr-xr-x',
    ),
    file(
      'config.json',
      '{\n  "app_name": "linux-sim",\n  "version": "1.0.0",\n  "port": 3000,\n  "database": {\n    "host": "localhost",\n    "port": 5432,\n    "name": "myapp_db"\n  },\n  "debug": false\n}\n',
    ),
  ]);

  // /home/user/Downloads
  const downloads = dir('Downloads', []);

  // /home/user
  const userHome = dir('user', [
    documents,
    projects,
    downloads,
    file(
      '.bashrc',
      "# ~/.bashrc\nexport PATH=$PATH:/usr/local/bin\nexport EDITOR=nano\nalias ll='ls -la'\nalias gs='git status'\n\n# Custom prompt\nPS1='\\u@\\h:\\w\\$ '\n",
    ),
    file(
      '.profile',
      '# ~/.profile\n# User specific environment\nexport LANG=en_US.UTF-8\n',
    ),
  ]);

  // /home
  const home = dir('home', [userHome], 'rwxr-xr-x', 'root', 'root');

  // /etc
  const etc = dir(
    'etc',
    [
      file(
        'passwd',
        'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:User:/home/user:/bin/bash\nnobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin\n',
        'rw-r--r--',
        'root',
        'root',
      ),
      file(
        'hosts',
        '127.0.0.1\tlocalhost\n127.0.1.1\tlinux-box\n::1\t\tlocalhost ip6-localhost\n',
        'rw-r--r--',
        'root',
        'root',
      ),
      file(
        'os-release',
        'NAME="LinuxSim OS"\nVERSION="24.04 LTS"\nID=linuxsim\nPRETTY_NAME="LinuxSim OS 24.04 LTS"\nVERSION_ID="24.04"\nHOME_URL="https://linuxsim.dev"\n',
        'rw-r--r--',
        'root',
        'root',
      ),
    ],
    'rwxr-xr-x',
    'root',
    'root',
  );

  // /var/log
  const log = dir(
    'log',
    [
      file('syslog', SYSLOG_CONTENT, 'rw-r-----', 'root', 'root'),
      file('auth.log', AUTH_LOG_CONTENT, 'rw-r-----', 'root', 'root'),
    ],
    'rwxr-xr-x',
    'root',
    'root',
  );

  const varDir = dir('var', [log], 'rwxr-xr-x', 'root', 'root');

  // /bin
  const binDir = dir(
    'bin',
    [
      binFile('ls'),
      binFile('cat'),
      binFile('grep'),
      binFile('mkdir'),
      binFile('cp'),
      binFile('mv'),
      binFile('rm'),
      binFile('chmod'),
      binFile('chown'),
      binFile('bash'),
      binFile('sh'),
      binFile('echo'),
      binFile('date'),
    ],
    'rwxr-xr-x',
    'root',
    'root',
  );

  // /tmp
  const tmpDir = dir('tmp', [], 'rwxrwxrwt', 'root', 'root');

  // /root
  const rootHome = dir('root', [], 'rwx------', 'root', 'root');

  // / (root directory)
  const root = dir(
    '/',
    [home, etc, varDir, binDir, tmpDir, rootHome],
    'rwxr-xr-x',
    'root',
    'root',
  );

  return root;
}
