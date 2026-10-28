import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import type { ShellState, CommandResult } from '../../types';
import type { VirtualFileSystem } from '../../vfs/fileSystem';

const SYS_STORAGE_KEY = 'linux-sim-sysadmin';

export interface ServiceState {
  name: string;
  description: string;
  port?: number;
  pid: number;
  status: 'running' | 'stopped';
  enabled: boolean;
  user: string;
  command: string;
}

interface SysAdminState {
  installedPackages: string[];
  services: Record<string, ServiceState>;
}

const DEFAULT_STATE: SysAdminState = {
  installedPackages: ['bash', 'coreutils', 'grep', 'sed', 'tar', 'nano', 'systemd', 'net-tools', 'iputils-ping'],
  services: {
    nginx: {
      name: 'nginx',
      description: 'A high performance web server and reverse proxy server',
      port: 80,
      pid: 1401,
      status: 'stopped',
      enabled: true,
      user: 'www-data',
      command: 'nginx: master process /usr/sbin/nginx -g daemon on;',
    },
    ssh: {
      name: 'ssh',
      description: 'OpenBSD Secure Shell server',
      port: 22,
      pid: 421,
      status: 'running',
      enabled: true,
      user: 'root',
      command: '/usr/sbin/sshd -D',
    },
    postgresql: {
      name: 'postgresql',
      description: 'PostgreSQL RDBMS server',
      port: 5432,
      pid: 2205,
      status: 'stopped',
      enabled: false,
      user: 'postgres',
      command: '/usr/lib/postgresql/16/bin/postgres -D /var/lib/postgresql/16/main',
    },
    redis: {
      name: 'redis',
      description: 'Advanced key-value store daemon',
      port: 6379,
      pid: 3102,
      status: 'stopped',
      enabled: false,
      user: 'redis',
      command: '/usr/bin/redis-server 127.0.0.1:6379',
    },
    cron: {
      name: 'cron',
      description: 'Regular background program processing daemon',
      pid: 890,
      status: 'running',
      enabled: true,
      user: 'root',
      command: '/usr/sbin/cron -f',
    },
  },
};

export function getSysAdminState(): SysAdminState {
  try {
    const raw = localStorage.getItem(SYS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge with defaults in case of missing keys
      return {
        installedPackages: parsed.installedPackages || DEFAULT_STATE.installedPackages,
        services: { ...DEFAULT_STATE.services, ...(parsed.services || {}) },
      };
    }
  } catch (e) {
    console.error('Failed to load sysadmin state', e);
  }
  return DEFAULT_STATE;
}

export function saveSysAdminState(state: SysAdminState) {
  try {
    localStorage.setItem(SYS_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save sysadmin state', e);
  }
}

export function isServiceRunning(serviceName: string): boolean {
  const state = getSysAdminState();
  return state.services[serviceName]?.status === 'running';
}

export function getRunningServicesList(): ServiceState[] {
  const state = getSysAdminState();
  return Object.values(state.services).filter(s => s.status === 'running');
}

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

export function registerSysadminCommands() {
  // ─── apt / apt-get ─────────────────────────────────────────────
  const aptHandler = (args: string[], _flags: any, shellState: ShellState): CommandResult => {
    if (args.length === 0) {
      return {
        stdout: 'apt 2.7.14 (amd64)\nUsage: apt [options] command\n\nMost used commands:\n  list - list packages based on package names\n  update - update list of available packages\n  install - install packages\n  remove - remove packages',
        stderr: '',
        exitCode: 0,
      };
    }

    const subcmd = args[0];
    const sysState = getSysAdminState();

    if (subcmd === 'update') {
      const output = [
        'Hit:1 http://archive.ubuntu.com/ubuntu noble InRelease',
        'Get:2 http://archive.ubuntu.com/ubuntu noble-updates InRelease [126 kB]',
        'Get:3 http://security.ubuntu.com/ubuntu noble-security InRelease [126 kB]',
        'Fetched 252 kB in 1s (314 kB/s)',
        'Reading package lists... Done',
        'Building dependency tree... Done',
        'All packages are up to date.',
      ].join('\n');
      return { stdout: output, stderr: '', exitCode: 0 };
    }

    if (subcmd === 'list') {
      if (args.includes('--installed')) {
        const lines = sysState.installedPackages.map(pkg => `${pkg}/now 1.0.0 amd64 [installed]`);
        return { stdout: `Listing... Done\n${lines.join('\n')}`, stderr: '', exitCode: 0 };
      }
      return { stdout: 'Listing... Done\nUse apt list --installed', stderr: '', exitCode: 0 };
    }

    if (subcmd === 'install') {
      const pkgsToInstall = args.slice(1).filter(p => !p.startsWith('-'));
      if (pkgsToInstall.length === 0) {
        return { stdout: '', stderr: 'apt: missing package name', exitCode: 1 };
      }

      if (!shellState.isRoot) {
        return { stdout: '', stderr: 'E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\nE: Unable to acquire the dpkg frontend lock, are you root?', exitCode: 100 };
      }

      const available = ['jq', 'nmap', 'cowsay', 'figlet', 'cmatrix', 'htop', 'curl', 'wget', 'git', 'neofetch'];
      const installed: string[] = [];
      const notFound: string[] = [];

      for (const pkg of pkgsToInstall) {
        if (available.includes(pkg)) {
          if (!sysState.installedPackages.includes(pkg)) {
            sysState.installedPackages.push(pkg);
            installed.push(pkg);
          }
        } else {
          notFound.push(pkg);
        }
      }

      saveSysAdminState(sysState);

      if (notFound.length > 0) {
        return {
          stdout: '',
          stderr: `E: Unable to locate package ${notFound.join(', ')}`,
          exitCode: 100,
        };
      }

      const output = [
        'Reading package lists... Done',
        'Building dependency tree... Done',
        'The following NEW packages will be installed:',
        `  ${pkgsToInstall.join(' ')}`,
        `0 upgraded, ${pkgsToInstall.length} newly installed, 0 to remove and 0 not upgraded.`,
        `Unpacking ${pkgsToInstall.join(', ')}...`,
        `Setting up ${pkgsToInstall.join(', ')}...`,
        'Processing triggers for man-db (2.12.0-4build2) ...',
      ].join('\n');

      return { stdout: output, stderr: '', exitCode: 0 };
    }

    if (subcmd === 'remove') {
      const pkgsToRemove = args.slice(1).filter(p => !p.startsWith('-'));
      if (pkgsToRemove.length === 0) {
        return { stdout: '', stderr: 'apt: missing package name', exitCode: 1 };
      }
      if (!shellState.isRoot) {
        return { stdout: '', stderr: 'E: Permission denied (must be root)', exitCode: 100 };
      }

      sysState.installedPackages = sysState.installedPackages.filter(p => !pkgsToRemove.includes(p));
      saveSysAdminState(sysState);

      return {
        stdout: `Reading package lists... Done\nRemoving ${pkgsToRemove.join(' ')}...\nProcessing triggers... Done`,
        stderr: '',
        exitCode: 0,
      };
    }

    return { stdout: '', stderr: `E: Invalid operation ${subcmd}`, exitCode: 100 };
  };

  registry.register({
    name: 'apt',
    description: 'Command-line package manager',
    usage: 'apt [update | install <pkg> | remove <pkg> | list --installed]',
    flags: [],
    handler: aptHandler,
  });

  registry.register({
    name: 'apt-get',
    description: 'APT package handling utility',
    usage: 'apt-get [update | install <pkg> | remove <pkg>]',
    flags: [],
    handler: aptHandler,
  });

  // ─── cowsay easter egg ─────────────────────────────────────────
  registry.register({
    name: 'cowsay',
    description: 'Generates an ASCII picture of a cow with a message',
    usage: 'cowsay <message>',
    flags: [],
    handler: (args): CommandResult => {
      const sysState = getSysAdminState();
      if (!sysState.installedPackages.includes('cowsay')) {
        return {
          stdout: '',
          stderr: 'Command \'cowsay\' not found, but can be installed with:\nsudo apt install cowsay',
          exitCode: 127,
        };
      }
      const text = args.join(' ') || 'Moo! Linux is awesome!';
      const border = '-'.repeat(text.length + 2);
      const cow = [
        ` ${border}`,
        `< ${text} >`,
        ` ${border}`,
        '        \\   ^__^',
        '         \\  (oo)\\_______',
        '            (__)\\       )\\/\\',
        '                ||----w |',
        '                ||     ||',
      ].join('\n');
      return { stdout: cow, stderr: '', exitCode: 0 };
    },
  });

  // ─── figlet easter egg ─────────────────────────────────────────
  registry.register({
    name: 'figlet',
    description: 'Display large ASCII text banners',
    usage: 'figlet <text>',
    flags: [],
    handler: (args): CommandResult => {
      const sysState = getSysAdminState();
      if (!sysState.installedPackages.includes('figlet')) {
        return {
          stdout: '',
          stderr: 'Command \'figlet\' not found, but can be installed with:\nsudo apt install figlet',
          exitCode: 127,
        };
      }
      const text = args.join(' ') || 'LINUX';
      // Simple mock ASCII banner for common words
      const banner = [
        ' _     ___ _   _ _   _ _  __',
        '| |   |_ _| \\ | | | | \\ \\/ /',
        '| |    | ||  \\| | | | |\\  / ',
        '| |___ | || |\\  | |_| |/  \\ ',
        '|_____|___|_| \\_|\\___//_/\\_\\',
        ` >> ${text.toUpperCase()} <<`,
      ].join('\n');
      return { stdout: banner, stderr: '', exitCode: 0 };
    },
  });

  // ─── systemctl ─────────────────────────────────────────────────
  registry.register({
    name: 'systemctl',
    description: 'Control the systemd system and service manager',
    usage: 'systemctl [status|start|stop|restart|enable|disable] <service>',
    flags: [],
    handler: (args, _flags, shellState): CommandResult => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'systemctl: missing command', exitCode: 1 };
      }

      const subcmd = args[0];
      const targetService = args[1]?.replace('.service', '');
      const sysState = getSysAdminState();

      if (!targetService) {
        // List units
        const header = '  UNIT                    LOAD   ACTIVE SUB     DESCRIPTION';
        const rows = Object.values(sysState.services).map(s => {
          const activeStr = s.status === 'running' ? 'active sub' : 'inactive dead';
          return `  ${(s.name + '.service').padEnd(24)} loaded ${activeStr.padEnd(11)} ${s.description}`;
        });
        return { stdout: `${header}\n${rows.join('\n')}`, stderr: '', exitCode: 0 };
      }

      const service = sysState.services[targetService];
      if (!service) {
        return {
          stdout: '',
          stderr: `Unit ${targetService}.service could not be found.`,
          exitCode: 4,
        };
      }

      if (subcmd === 'status') {
        const isRun = service.status === 'running';
        const circle = isRun ? '<span style="color:#4ade80">●</span>' : '<span style="color:#f87171">○</span>';
        const activeText = isRun
          ? `<span style="color:#4ade80;font-weight:bold">active (running)</span> since Wed 2026-10-28 10:15:32 IST; 5h ago`
          : `<span style="color:#f87171;font-weight:bold">inactive (dead)</span>`;

        const lines = [
          `${circle} ${service.name}.service - ${service.description}`,
          `     Loaded: loaded (/lib/systemd/system/${service.name}.service; ${service.enabled ? 'enabled' : 'disabled'}; vendor preset: enabled)`,
          `     Active: ${activeText}`,
          `   Main PID: ${isRun ? service.pid : 0} (${service.name})`,
          `      Tasks: ${isRun ? 2 : 0} (limit: 4915)`,
          `     Memory: ${isRun ? '14.2M' : '0B'}`,
          `        CPU: ${isRun ? '124ms' : '0ms'}`,
          `     CGroup: /system.slice/${service.name}.service`,
          ...(isRun ? [`             └─${service.pid} ${service.command}`] : []),
        ];

        return { stdout: lines.join('\n'), stderr: '', exitCode: isRun ? 0 : 3 };
      }

      // Mutating subcommands require sudo / root
      if (['start', 'stop', 'restart', 'enable', 'disable'].includes(subcmd)) {
        if (!shellState.isRoot) {
          return {
            stdout: '',
            stderr: `==== AUTHENTICATING FOR org.freedesktop.systemd1.manage-units ===\nAuthentication is required to ${subcmd} '${targetService}.service'.\nPolkit authorization failed (try sudo).`,
            exitCode: 1,
          };
        }

        if (subcmd === 'start') {
          service.status = 'running';
        } else if (subcmd === 'stop') {
          service.status = 'stopped';
        } else if (subcmd === 'restart') {
          service.status = 'running';
          service.pid = Math.floor(Math.random() * 2000) + 1000;
        } else if (subcmd === 'enable') {
          service.enabled = true;
        } else if (subcmd === 'disable') {
          service.enabled = false;
        }

        saveSysAdminState(sysState);
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: `systemctl: Unknown command verb ${subcmd}`, exitCode: 1 };
    },
  });

  // ─── netstat & ss ──────────────────────────────────────────────
  const netstatHandler = (_args: string[]): CommandResult => {
    const sysState = getSysAdminState();
    const activeServices = Object.values(sysState.services).filter(s => s.status === 'running' && s.port);

    const header = [
      'Active Internet connections (only servers)',
      'Proto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name',
      'tcp        0      0 127.0.0.53:53           0.0.0.0:*               LISTEN      892/systemd-resolve',
    ];

    for (const s of activeServices) {
      const addr = s.name === 'nginx' || s.name === 'ssh' ? `0.0.0.0:${s.port}` : `127.0.0.1:${s.port}`;
      header.push(`tcp        0      0 ${addr.padEnd(23)} 0.0.0.0:*               LISTEN      ${s.pid}/${s.name}`);
    }

    return { stdout: header.join('\n'), stderr: '', exitCode: 0 };
  };

  registry.register({
    name: 'netstat',
    description: 'Print network connections and routing tables',
    usage: 'netstat -tuln',
    flags: [
      { flag: '-t', description: 'Show TCP ports' },
      { flag: '-u', description: 'Show UDP ports' },
      { flag: '-l', description: 'Show only listening sockets' },
      { flag: '-n', description: 'Show numerical addresses' },
    ],
    handler: netstatHandler,
  });

  registry.register({
    name: 'ss',
    description: 'Another utility to investigate sockets',
    usage: 'ss -tuln',
    flags: [
      { flag: '-t', description: 'Show TCP' },
      { flag: '-u', description: 'Show UDP' },
      { flag: '-l', description: 'Display listening sockets' },
      { flag: '-n', description: 'Do not try to resolve service names' },
    ],
    handler: netstatHandler,
  });

  // ─── curl & wget ───────────────────────────────────────────────
  const MOCK_USERS = [
    { id: 1, name: 'Linus Torvalds', role: 'Kernel Architect', active: true },
    { id: 2, name: 'Dennis Ritchie', role: 'C Creator', active: false },
    { id: 3, name: 'Ken Thompson', role: 'Unix Architect', active: true },
    { id: 4, name: 'Ada Lovelace', role: 'First Programmer', active: false },
    { id: 5, name: 'Grace Hopper', role: 'Compiler Pioneer', active: false },
  ];

  const curlHandler = (args: string[], flags: any, shellState: ShellState, vfs: VirtualFileSystem): CommandResult => {
    let headersOnly = !!flags['I'];
    let outputFile = typeof flags['o'] === 'string' ? flags['o'] : '';
    let targetUrl = '';

    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === '-s') {
        // silent mode flag accepted
      } else if (a === '-I') headersOnly = true;
      else if (a === '-o' && i + 1 < args.length) {
        outputFile = args[i + 1];
        i++;
      } else if (!a.startsWith('-')) {
        targetUrl = a;
      }
    }

    if (!targetUrl) {
      return { stdout: '', stderr: 'curl: try \'curl --help\' for more information', exitCode: 2 };
    }

    // Router for local simulated addresses
    const isLocalhost80 =
      targetUrl === 'http://localhost' ||
      targetUrl === 'http://localhost:80' ||
      targetUrl === 'http://127.0.0.1' ||
      targetUrl === 'http://127.0.0.1:80' ||
      targetUrl === 'localhost:80' ||
      targetUrl === 'localhost';

    if (isLocalhost80) {
      const nginxRunning = isServiceRunning('nginx');
      if (!nginxRunning) {
        return {
          stdout: '',
          stderr: 'curl: (7) Failed to connect to localhost port 80 after 1 ms: Connection refused',
          exitCode: 7,
        };
      }

      const html = `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto; font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, the nginx web server is successfully installed and working.</p>
</body>
</html>`;

      if (headersOnly) {
        return {
          stdout: 'HTTP/1.1 200 OK\nServer: nginx/1.24.0\nDate: Wed, 28 Oct 2026 10:15:32 GMT\nContent-Type: text/html\nContent-Length: 615\nConnection: keep-alive',
          stderr: '',
          exitCode: 0,
        };
      }

      if (outputFile) {
        const dest = resolve(outputFile, shellState);
        vfs.writeFile(dest, html);
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      return { stdout: html, stderr: '', exitCode: 0 };
    }

    // API users endpoint
    if (targetUrl.includes('api.linuxsim.local/users')) {
      const jsonOutput = JSON.stringify(MOCK_USERS, null, 2);
      if (headersOnly) {
        return {
          stdout: 'HTTP/1.1 200 OK\nServer: LinuxSim-API/1.0\nContent-Type: application/json\nContent-Length: 620\nConnection: keep-alive',
          stderr: '',
          exitCode: 0,
        };
      }
      if (outputFile) {
        const dest = resolve(outputFile, shellState);
        vfs.writeFile(dest, jsonOutput);
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return { stdout: jsonOutput, stderr: '', exitCode: 0 };
    }

    // API status endpoint
    if (targetUrl.includes('api.linuxsim.local/status')) {
      const statusObj = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        load: [0.12, 0.08, 0.05],
        services: {
          nginx: isServiceRunning('nginx') ? 'up' : 'down',
          ssh: isServiceRunning('ssh') ? 'up' : 'down',
        },
      };
      const jsonOutput = JSON.stringify(statusObj, null, 2);
      if (outputFile) {
        const dest = resolve(outputFile, shellState);
        vfs.writeFile(dest, jsonOutput);
        return { stdout: '', stderr: '', exitCode: 0 };
      }
      return { stdout: jsonOutput, stderr: '', exitCode: 0 };
    }

    // Fallback for general mock endpoints
    const fallback = `{"url": "${targetUrl}", "status": 200, "message": "Simulated response from ${targetUrl}"}`;
    if (outputFile) {
      const dest = resolve(outputFile, shellState);
      vfs.writeFile(dest, fallback);
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    return { stdout: fallback, stderr: '', exitCode: 0 };
  };

  registry.register({
    name: 'curl',
    description: 'Transfer data from or to a server',
    usage: 'curl [-s] [-I] [-o <file>] <url>',
    flags: [
      { flag: '-s', description: 'Silent or quiet mode' },
      { flag: '-I', description: 'Show document info/headers only' },
      { flag: '-o', description: 'Write output to file instead of stdout' },
    ],
    handler: curlHandler,
  });

  registry.register({
    name: 'wget',
    description: 'Non-interactive network downloader',
    usage: 'wget [-O <file>] <url>',
    flags: [
      { flag: '-O', description: 'Write documents to FILE' },
    ],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      let outputFile = '';
      let url = '';
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '-O' && i + 1 < args.length) {
          outputFile = args[i + 1];
          i++;
        } else if (!args[i].startsWith('-')) {
          url = args[i];
        }
      }
      if (!url) return { stdout: '', stderr: 'wget: missing URL', exitCode: 1 };
      const out = outputFile || url.split('/').pop() || 'index.html';
      return curlHandler(['-o', out, url], {}, shellState, vfs);
    },
  });

  // ─── crontab ───────────────────────────────────────────────────
  registry.register({
    name: 'crontab',
    description: 'Maintain crontab files for individual users',
    usage: 'crontab [-l | -r | <file>]',
    flags: [
      { flag: '-l', description: 'Display current crontab' },
      { flag: '-r', description: 'Remove current crontab' },
    ],
    handler: (args, flags, shellState, vfs): CommandResult => {
      const isList = !!flags['l'] || args.includes('-l');
      const isRemove = !!flags['r'] || args.includes('-r');
      const crontabPath = '/etc/crontab';

      if (isList) {
        const node = vfs.getNode(crontabPath, true);
        if (!node || !node.content) {
          return { stdout: 'no crontab for user', stderr: '', exitCode: 0 };
        }
        return { stdout: node.content, stderr: '', exitCode: 0 };
      }

      if (isRemove) {
        vfs.writeFile(crontabPath, '');
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      const cleanArgs = args.filter(a => !a.startsWith('-'));
      if (cleanArgs.length > 0) {
        const inputPath = resolve(cleanArgs[0], shellState);
        const node = vfs.getNode(inputPath, true);
        if (!node) {
          return { stdout: '', stderr: `crontab: ${cleanArgs[0]}: No such file or directory`, exitCode: 1 };
        }
        vfs.writeFile(crontabPath, node.content ?? '');
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: 'crontab: usage: crontab [-l | -r | <filename>]', exitCode: 1 };
    },
  });
}
