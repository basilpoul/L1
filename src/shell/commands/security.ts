import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import type { ShellState, CommandResult } from '../../types';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

// ==================== UFW STATE ====================
export interface UfwRule {
  id: number;
  port: number;
  proto: 'tcp' | 'udp' | 'any';
  action: 'ALLOW' | 'DENY';
  from: string;
}

export interface UfwState {
  enabled: boolean;
  defaultIncoming: 'deny';
  defaultOutgoing: 'allow';
  rules: UfwRule[];
}

const UFW_STORAGE_KEY = 'linuxsim_ufw';

const DEFAULT_UFW_STATE: UfwState = {
  enabled: false,
  defaultIncoming: 'deny',
  defaultOutgoing: 'allow',
  rules: [
    { id: 1, port: 22, proto: 'tcp', action: 'ALLOW', from: 'Anywhere' },
  ],
};

export function getUfwState(): UfwState {
  try {
    const raw = localStorage.getItem(UFW_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load ufw state', e);
  }
  return DEFAULT_UFW_STATE;
}

export function saveUfwState(state: UfwState) {
  try {
    localStorage.setItem(UFW_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save ufw state', e);
  }
}

// ==================== REMOTE PROD-NODE SIMULATION ====================
export const REMOTE_PROD_FILES: Record<string, string> = {
  '/home/admin/flag.txt': 'FLAG{pwn_th3_pr0d_s3rv3r_2026}\n',
  '/etc/nginx/nginx.conf': 'worker_processes auto;\nevents { worker_connections 1024; }\nhttp {\n    server {\n        listen 80;\n        server_name prod-node;\n    }\n}\n',
  '/var/log/prod.log': '[2026-10-28 12:00:00] INFO: Remote production server initialized\n[2026-10-28 12:05:00] WARN: High CPU spike detected on core 2\n[2026-10-28 12:10:00] INFO: Backup routine completed successfully.\n',
  '/home/admin/.bashrc': 'export PS1="admin@prod-node:\\w\\$ "\nalias ll="ls -la"\n',
};

// ==================== COMMAND REGISTRATIONS ====================

export function registerSecurityCommands() {
  // --- useradd ---
  registry.register({
    name: 'useradd',
    description: 'Create a new user or update default new user information',
    usage: 'useradd [-m] [-s <shell>] <username>',
    flags: [
      { flag: '-m', description: 'Create user home directory' },
      { flag: '-s', description: 'Login shell' },
    ],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      const isRoot = shellState.isRoot || shellState.env['USER'] === 'root';
      if (!isRoot) {
        return { stdout: '', stderr: 'useradd: Permission denied (are you root?)', exitCode: 1 };
      }

      let createHome = false;
      let shell = '/bin/bash';
      let username = '';

      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-m' || args[i] === '--create-home') {
          createHome = true;
        } else if (args[i] === '-s' && args[i + 1]) {
          shell = args[++i];
        } else if (!args[i].startsWith('-') && !username) {
          username = args[i];
        }
      }

      if (!username) {
        return { stdout: '', stderr: 'useradd: missing username\nUsage: useradd [-m] [-s shell] <username>', exitCode: 1 };
      }

      // Check /etc/passwd
      const passwdNode = vfs.getNode('/etc/passwd', true);
      let passwdContent = passwdNode?.content || 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:Linux User:/home/user:/bin/bash\n';

      if (passwdContent.includes(`${username}:`)) {
        return { stdout: '', stderr: `useradd: user '${username}' already exists`, exitCode: 9 };
      }

      // Find next available UID (>= 1001)
      const uids = passwdContent.split('\n')
        .map(l => l.split(':')[2])
        .filter(Boolean)
        .map(Number)
        .filter(n => !isNaN(n));
      const nextUid = Math.max(1000, ...uids) + 1;

      const newPasswdLine = `${username}:x:${nextUid}:${nextUid}:${username}:/home/${username}:${shell}\n`;
      vfs.writeFile('/etc/passwd', passwdContent + newPasswdLine);

      // Append to /etc/group
      const groupNode = vfs.getNode('/etc/group', true);
      let groupContent = groupNode?.content || 'root:x:0:\nsudo:x:27:user\nuser:x:1000:\n';
      groupContent += `${username}:x:${nextUid}:\n`;
      vfs.writeFile('/etc/group', groupContent);

      if (createHome) {
        const homePath = `/home/${username}`;
        vfs.createDirectory(homePath, true);
        const homeNode = vfs.getNode(homePath);
        if (homeNode) {
          homeNode.owner = username;
          homeNode.group = username;
          homeNode.permissions = 'rwxr-xr-x';
        }
        vfs.writeFile(`${homePath}/.bashrc`, `# .bashrc for ${username}\nexport PS1="${username}@linux-box:\\w\\$ "\nalias ll='ls -la'\n`);
      }

      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // --- userdel ---
  registry.register({
    name: 'userdel',
    description: 'Delete a user account and related files',
    usage: 'userdel [-r] <username>',
    flags: [
      { flag: '-r', description: 'Remove home directory and mail spool' },
    ],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      const isRoot = shellState.isRoot || shellState.env['USER'] === 'root';
      if (!isRoot) {
        return { stdout: '', stderr: 'userdel: Permission denied (are you root?)', exitCode: 1 };
      }

      let removeHome = false;
      let username = '';
      for (const a of args) {
        if (a === '-r') removeHome = true;
        else if (!username) username = a;
      }

      if (!username) {
        return { stdout: '', stderr: 'userdel: missing username', exitCode: 1 };
      }

      const passwdNode = vfs.getNode('/etc/passwd', true);
      if (!passwdNode?.content || !passwdNode.content.includes(`${username}:`)) {
        return { stdout: '', stderr: `userdel: user '${username}' does not exist`, exitCode: 6 };
      }

      // Remove from /etc/passwd
      const updatedPasswd = passwdNode.content.split('\n').filter(l => !l.startsWith(`${username}:`)).join('\n');
      vfs.writeFile('/etc/passwd', updatedPasswd);

      // Remove from /etc/group
      const groupNode = vfs.getNode('/etc/group', true);
      if (groupNode?.content) {
        const updatedGroup = groupNode.content.split('\n').filter(l => !l.startsWith(`${username}:`)).join('\n');
        vfs.writeFile('/etc/group', updatedGroup);
      }

      if (removeHome) {
        vfs.deleteNode(`/home/${username}`, true);
      }

      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // --- passwd ---
  registry.register({
    name: 'passwd',
    description: 'Change user password',
    usage: 'passwd [username]',
    flags: [],
    handler: (args, _flags, shellState): CommandResult => {
      const targetUser = args[0] || shellState.env['USER'] || 'user';
      return {
        stdout: `New password: \nRetype new password: \npasswd: password updated successfully for ${targetUser}`,
        stderr: '',
        exitCode: 0,
      };
    },
  });

  // --- su ---
  registry.register({
    name: 'su',
    description: 'Change user ID or become superuser',
    usage: 'su [-] [username]',
    flags: [
      { flag: '-', description: 'Provide an environment similar to what the user would expect had the user logged in directly' },
    ],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      let isLogin = false;
      let targetUser = 'root';

      for (const a of args) {
        if (a === '-' || a === '--login' || a === '-l') {
          isLogin = true;
        } else if (!a.startsWith('-')) {
          targetUser = a;
        }
      }

      // Check /etc/passwd
      const passwdNode = vfs.getNode('/etc/passwd', true);
      const passwd = passwdNode?.content || 'root:x:0:0:root:/root:/bin/bash\nuser:x:1000:1000:Linux User:/home/user:/bin/bash\n';
      const userLine = passwd.split('\n').find(l => l.startsWith(`${targetUser}:`));

      if (targetUser !== 'root' && targetUser !== 'user' && !userLine) {
        return { stdout: '', stderr: `su: user ${targetUser} does not exist`, exitCode: 1 };
      }

      // Save previous state to userStack
      if (!shellState.userStack) {
        shellState.userStack = [];
      }
      shellState.userStack.push({
        user: shellState.env['USER'] || 'user',
        home: shellState.env['HOME'] || '/home/user',
        isRoot: shellState.isRoot,
      });

      // Switch user
      shellState.env['USER'] = targetUser;
      shellState.isRoot = (targetUser === 'root');

      let homeDir = targetUser === 'root' ? '/root' : `/home/${targetUser}`;
      if (userLine) {
        const parts = userLine.split(':');
        if (parts[5]) homeDir = parts[5];
      }

      if (isLogin) {
        shellState.env['HOME'] = homeDir;
        shellState.cwd = homeDir;
        shellState.env['PWD'] = homeDir;
      }

      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // --- usermod ---
  registry.register({
    name: 'usermod',
    description: 'Modify a user account',
    usage: 'usermod -aG <group> <username>',
    flags: [
      { flag: '-aG', description: 'Append the user to the supplementary group(s)' },
    ],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      const isRoot = shellState.isRoot || shellState.env['USER'] === 'root';
      if (!isRoot) {
        return { stdout: '', stderr: 'usermod: Permission denied', exitCode: 1 };
      }
      let group = '';
      let user = '';
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-aG' || args[i] === '-G') {
          group = args[++i];
        } else if (!args[i].startsWith('-')) {
          user = args[i];
        }
      }
      if (!group || !user) {
        return { stdout: '', stderr: 'usermod: missing group or username', exitCode: 1 };
      }

      const groupNode = vfs.getNode('/etc/group', true);
      let content = groupNode?.content || 'root:x:0:\nsudo:x:27:user\n';
      const lines = content.split('\n');
      let found = false;
      const updated = lines.map(line => {
        if (line.startsWith(`${group}:`)) {
          found = true;
          const parts = line.split(':');
          const members = parts[3] ? parts[3].split(',').filter(Boolean) : [];
          if (!members.includes(user)) members.push(user);
          parts[3] = members.join(',');
          return parts.join(':');
        }
        return line;
      });

      if (!found) {
        updated.push(`${group}:x:1099:${user}`);
      }
      vfs.writeFile('/etc/group', updated.join('\n'));
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // --- groups ---
  registry.register({
    name: 'groups',
    description: 'Print group memberships for user',
    usage: 'groups [username]',
    flags: [],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      const targetUser = args[0] || shellState.env['USER'] || 'user';
      const groupNode = vfs.getNode('/etc/group', true);
      const content = groupNode?.content || 'root:x:0:\nsudo:x:27:user\nuser:x:1000:\n';

      const userGroups: string[] = [];
      for (const line of content.split('\n')) {
        const parts = line.split(':');
        if (parts[0]) {
          const gName = parts[0];
          const members = parts[3] ? parts[3].split(',') : [];
          if (gName === targetUser || members.includes(targetUser)) {
            userGroups.push(gName);
          }
        }
      }

      if (userGroups.length === 0) userGroups.push(targetUser);
      return { stdout: `${targetUser} : ${userGroups.join(' ')}`, stderr: '', exitCode: 0 };
    },
  });

  // --- ufw ---
  registry.register({
    name: 'ufw',
    description: 'Program for managing a netfilter firewall',
    usage: 'ufw [status|enable|disable|allow|deny|delete] [args]',
    flags: [],
    handler: (args, _flags, shellState): CommandResult => {
      const isRoot = shellState.isRoot || shellState.env['USER'] === 'root';
      if (!isRoot) {
        return { stdout: '', stderr: 'ufw: Permission denied (must be root)', exitCode: 1 };
      }

      if (args.length === 0) {
        return { stdout: 'Usage: ufw status [numbered|verbose] | enable | disable | allow <port> | deny <port> | delete <number>', stderr: '', exitCode: 1 };
      }

      const sub = args[0].toLowerCase();
      const ufw = getUfwState();

      if (sub === 'status') {
        if (!ufw.enabled) {
          return { stdout: 'Status: inactive', stderr: '', exitCode: 0 };
        }

        let out = 'Status: active\n\n     To                         Action      From\n     --                         ------      ----\n';
        ufw.rules.forEach((rule, idx) => {
          const num = `[${idx + 1}]`.padEnd(5);
          const portStr = `${rule.port}/${rule.proto}`.padEnd(27);
          const actStr = `${rule.action} IN`.padEnd(12);
          out += `${num}${portStr}${actStr}${rule.from}\n`;
        });
        return { stdout: out.trimEnd(), stderr: '', exitCode: 0 };
      }

      if (sub === 'enable') {
        ufw.enabled = true;
        saveUfwState(ufw);
        return { stdout: 'Firewall is active and enabled on system startup', stderr: '', exitCode: 0 };
      }

      if (sub === 'disable') {
        ufw.enabled = false;
        saveUfwState(ufw);
        return { stdout: 'Firewall stopped and disabled on system startup', stderr: '', exitCode: 0 };
      }

      if (sub === 'allow' || sub === 'deny') {
        const portArg = args[1];
        if (!portArg) {
          return { stdout: '', stderr: `ufw ${sub}: missing port specification`, exitCode: 1 };
        }
        let port = parseInt(portArg, 10);
        let proto: 'tcp' | 'udp' | 'any' = 'any';
        if (portArg.includes('/')) {
          const [pStr, pr] = portArg.split('/');
          port = parseInt(pStr, 10);
          if (pr === 'tcp' || pr === 'udp') proto = pr;
        }

        if (isNaN(port)) {
          return { stdout: '', stderr: `ufw: invalid port '${portArg}'`, exitCode: 1 };
        }

        const nextId = Math.max(0, ...ufw.rules.map(r => r.id)) + 1;
        ufw.rules.push({
          id: nextId,
          port,
          proto,
          action: sub.toUpperCase() as 'ALLOW' | 'DENY',
          from: 'Anywhere',
        });
        saveUfwState(ufw);
        return { stdout: 'Rule added\nRule added (v6)', stderr: '', exitCode: 0 };
      }

      if (sub === 'delete') {
        const num = parseInt(args[1], 10);
        if (isNaN(num) || num < 1 || num > ufw.rules.length) {
          return { stdout: '', stderr: `ufw delete: invalid rule number '${args[1]}'`, exitCode: 1 };
        }
        ufw.rules.splice(num - 1, 1);
        saveUfwState(ufw);
        return { stdout: 'Rule deleted\nRule deleted (v6)', stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: `ufw: unknown command '${sub}'`, exitCode: 1 };
    },
  });

  // --- ssh ---
  registry.register({
    name: 'ssh',
    description: 'OpenSSH SSH client (remote login program)',
    usage: 'ssh [user@]hostname [command]',
    flags: [],
    handler: (args, _flags, shellState): CommandResult => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'usage: ssh [-46AaCfGgKkMNnqsTtVvXxYy] [-B bind_interface] [user@]hostname [command]', exitCode: 1 };
      }

      const target = args[0];
      let user = 'admin';
      let host = '10.0.0.5';

      if (target.includes('@')) {
        [user, host] = target.split('@');
      } else {
        host = target;
      }

      if (host !== '10.0.0.5' && host !== 'prod-node') {
        return { stdout: '', stderr: `ssh: connect to host ${host} port 22: Connection timed out`, exitCode: 255 };
      }

      // Check firewall
      const ufw = getUfwState();
      if (ufw.enabled) {
        const sshRule = ufw.rules.find(r => r.port === 22 && r.action === 'DENY');
        if (sshRule) {
          return { stdout: '', stderr: `ssh: connect to host ${host} port 22: Connection refused by firewall`, exitCode: 255 };
        }
      }

      // If a command was supplied directly, e.g. ssh admin@10.0.0.5 "cat /home/admin/flag.txt"
      if (args.length > 1) {
        const cmd = args.slice(1).join(' ').replace(/^["']|["']$/g, '');
        if (cmd === 'cat /home/admin/flag.txt' || cmd === 'cat flag.txt') {
          return { stdout: REMOTE_PROD_FILES['/home/admin/flag.txt'], stderr: '', exitCode: 0 };
        }
        if (cmd === 'uname -a') {
          return { stdout: 'Linux prod-node 5.15.0-89-generic #99-Ubuntu SMP Mon Dec 4 12:00:00 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux', stderr: '', exitCode: 0 };
        }
        return { stdout: `[prod-node]: ${cmd} executed successfully`, stderr: '', exitCode: 0 };
      }

      // Enter interactive remote session
      shellState.remoteSession = {
        host: '10.0.0.5',
        hostname: 'prod-node',
        user: user || 'admin',
        cwd: '/home/admin',
      };

      return {
        stdout: `The authenticity of host '${host} (${host})' can't be established.
ECDSA key fingerprint is SHA256:d8a2bf6e901a884efc71b3e9e1...
Connected to ${host}.
Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-89-generic x86_64) on prod-node
Last login: Wed Oct 28 10:14:22 2026 from 10.0.0.1`,
        stderr: '',
        exitCode: 0,
      };
    },
  });

  // --- scp ---
  registry.register({
    name: 'scp',
    description: 'Secure copy (remote file copy program)',
    usage: 'scp <source> <destination>',
    flags: [],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      if (args.length < 2) {
        return { stdout: '', stderr: 'usage: scp [-346ABCOpqRrsTv] [-c cipher] [-F ssh_config] source ... target', exitCode: 1 };
      }

      const src = args[0];
      const dst = args[1];

      // Check firewall
      const ufw = getUfwState();
      if (ufw.enabled) {
        const sshRule = ufw.rules.find(r => r.port === 22 && r.action === 'DENY');
        if (sshRule) {
          return { stdout: '', stderr: 'scp: connect to host 10.0.0.5 port 22: Connection refused by firewall', exitCode: 1 };
        }
      }

      // Remote to Local: scp admin@10.0.0.5:/home/admin/flag.txt ~/flag.txt
      if (src.includes(':') && (src.includes('10.0.0.5') || src.includes('prod-node'))) {
        const remoteFilePath = src.split(':')[1];
        const remoteContent = REMOTE_PROD_FILES[remoteFilePath];

        if (remoteContent === undefined) {
          return { stdout: '', stderr: `scp: ${remoteFilePath}: No such file or directory`, exitCode: 1 };
        }

        const localPath = resolve(dst, shellState);
        vfs.writeFile(localPath, remoteContent);

        const fileName = remoteFilePath.split('/').pop() || 'file';
        const bytes = remoteContent.length;
        return {
          stdout: `${fileName.padEnd(25)} 100%   ${bytes}B    ${(bytes * 1.2).toFixed(1)}KB/s   00:00`,
          stderr: '',
          exitCode: 0,
        };
      }

      // Local to Remote: scp local.txt admin@10.0.0.5:/home/admin/local.txt
      if (dst.includes(':') && (dst.includes('10.0.0.5') || dst.includes('prod-node'))) {
        const localPath = resolve(src, shellState);
        const node = vfs.getNode(localPath, true);
        if (!node || node.type !== 'file') {
          return { stdout: '', stderr: `scp: ${src}: No such file or directory`, exitCode: 1 };
        }

        const remoteFilePath = dst.split(':')[1];
        REMOTE_PROD_FILES[remoteFilePath] = node.content ?? '';

        const fileName = src.split('/').pop() || 'file';
        const bytes = (node.content ?? '').length;
        return {
          stdout: `${fileName.padEnd(25)} 100%   ${bytes}B    ${(bytes * 1.5).toFixed(1)}KB/s   00:00`,
          stderr: '',
          exitCode: 0,
        };
      }

      return { stdout: '', stderr: 'scp: either source or destination must be a valid remote host (e.g. admin@10.0.0.5:/path)', exitCode: 1 };
    },
  });
}
