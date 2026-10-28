import { registry } from '../commandRegistry';
import type { CommandResult } from '../../types';
import { getRunningServicesList } from './sysadmin';
import { resolveHostname } from './networkCrypto';
import { getStorageState } from './kernelStorage';

export function registerSystemCommands() {
  // neofetch
  registry.register({
    name: 'neofetch',
    description: 'Display system information with ASCII art',
    usage: 'neofetch',
    flags: [],
    handler: (_args, _flags, _shellState, vfs) => {
      const c1 = '#60a5fa';
      const c2 = '#4ade80';
      const c3 = '#c084fc';
      const c4 = '#fbbf24';
      const c5 = '#f87171';
      const c6 = '#22d3ee';
      const white = '#e2e8f0';

      // Count files in VFS
      const allFiles = vfs.findNodes('/', (n) => n.type === 'file');
      const allDirs = vfs.findNodes('/', (n) => n.type === 'dir');

      const uptime = Math.floor((Date.now() - new Date().setHours(0, 0, 0, 0)) / 60000);
      const hours = Math.floor(uptime / 60);
      const mins = uptime % 60;

      const art = [
        `<span style="color:${c1}">        .--.        </span>`,
        `<span style="color:${c1}">       |o_o |       </span>`,
        `<span style="color:${c1}">       |:_/ |       </span>`,
        `<span style="color:${c1}">      //   \\ \\      </span>`,
        `<span style="color:${c1}">     (|     | )     </span>`,
        `<span style="color:${c1}">    /'\\_   _/\`\\     </span>`,
        `<span style="color:${c1}">    \\___)=(___/     </span>`,
      ];

      const info = [
        `<span style="color:${c2};font-weight:bold">user</span><span style="color:${white}">@</span><span style="color:${c3};font-weight:bold">linux-box</span>`,
        `<span style="color:${white}">─────────────────</span>`,
        `<span style="color:${c4}">OS</span><span style="color:${white}">:       LinuxSim OS 24.04 LTS</span>`,
        `<span style="color:${c4}">Host</span><span style="color:${white}">:     Virtual Machine</span>`,
        `<span style="color:${c4}">Kernel</span><span style="color:${white}">:   6.5.0-sim</span>`,
        `<span style="color:${c4}">Uptime</span><span style="color:${white}">:   ${hours}h ${mins}m</span>`,
        `<span style="color:${c4}">Shell</span><span style="color:${white}">:    bash 5.2.15</span>`,
        `<span style="color:${c4}">Terminal</span><span style="color:${white}">: LinuxSim Terminal</span>`,
        `<span style="color:${c4}">CPU</span><span style="color:${white}">:      Virtual CPU @ 3.6GHz</span>`,
        `<span style="color:${c4}">Memory</span><span style="color:${white}">:   1248MiB / 8192MiB</span>`,
        `<span style="color:${c4}">VFS</span><span style="color:${white}">:      ${allFiles.length} files, ${allDirs.length} dirs</span>`,
        ``,
        `<span style="color:${c5}">█</span><span style="color:${c4}">█</span><span style="color:${c2}">█</span><span style="color:${c6}">█</span><span style="color:${c1}">█</span><span style="color:${c3}">█</span><span style="color:${white}">█</span><span style="color:#64748b">█</span>`,
      ];

      const lines: string[] = [];
      const maxLines = Math.max(art.length, info.length);
      for (let i = 0; i < maxLines; i++) {
        const artLine = i < art.length ? art[i] : '                    ';
        const infoLine = i < info.length ? info[i] : '';
        lines.push(`${artLine}   ${infoLine}`);
      }

      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // uname
  registry.register({
    name: 'uname',
    description: 'Print system information',
    usage: 'uname [-a]',
    flags: [{ flag: '-a', description: 'Print all information' }],
    handler: (_args, flags) => {
      if (flags['a']) {
        return { stdout: 'Linux linux-box 6.5.0-sim #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux', stderr: '', exitCode: 0 };
      }
      return { stdout: 'Linux', stderr: '', exitCode: 0 };
    },
  });

  // hostname
  registry.register({
    name: 'hostname',
    description: 'Print system hostname',
    usage: 'hostname',
    flags: [],
    handler: () => ({ stdout: 'linux-box', stderr: '', exitCode: 0 }),
  });

  // date
  registry.register({
    name: 'date',
    description: 'Display current date and time',
    usage: 'date',
    flags: [],
    handler: () => {
      const now = new Date();
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formatted = `${days[now.getDay()]} ${months[now.getMonth()]} ${String(now.getDate()).padStart(2, ' ')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} IST ${now.getFullYear()}`;
      return { stdout: formatted, stderr: '', exitCode: 0 };
    },
  });

  // uptime
  registry.register({
    name: 'uptime',
    description: 'Show how long the system has been running',
    usage: 'uptime',
    flags: [],
    handler: () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const uptimeH = Math.floor(Math.random() * 24) + 1;
      const users = 1;
      return {
        stdout: ` ${h}:${m}:00 up ${uptimeH}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')},  ${users} user,  load average: 0.12, 0.08, 0.05`,
        stderr: '',
        exitCode: 0,
      };
    },
  });

  // cal
  registry.register({
    name: 'cal',
    description: 'Display a calendar',
    usage: 'cal',
    flags: [],
    handler: () => {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const today = now.getDate();
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

      const title = `     ${months[month]} ${year}`;
      const header = 'Su Mo Tu We Th Fr Sa';

      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      let calStr = title + '\n' + header + '\n';
      let line = '   '.repeat(firstDay);

      for (let d = 1; d <= daysInMonth; d++) {
        const dayStr = String(d).padStart(2, ' ');
        if (d === today) {
          line += `<span style="background:#60a5fa;color:#0f111a;font-weight:bold">${dayStr}</span> `;
        } else {
          line += dayStr + ' ';
        }
        if ((firstDay + d) % 7 === 0) {
          calStr += line.trimEnd() + '\n';
          line = '';
        }
      }
      if (line.trim()) calStr += line.trimEnd();

      return { stdout: calStr, stderr: '', exitCode: 0 };
    },
  });

  // df
  registry.register({
    name: 'df',
    description: 'Report file system disk space usage',
    usage: 'df [-h]',
    flags: [{ flag: '-h', description: 'Human-readable sizes' }],
    handler: () => {
      const storage = getStorageState();
      const sdb = storage.devices.find((d) => d.name === 'sdb');
      const sdb1 = sdb?.children?.find((c) => c.name === 'sdb1');

      const lines = [
        'Filesystem      Size  Used Avail Use% Mounted on',
        '/dev/sda1        50G   12G   35G  26% /',
        'tmpfs           4.0G  156M  3.9G   4% /tmp',
        '/dev/sda2        20G  5.2G   14G  28% /home',
      ];

      if (sdb1?.mountpoint) {
        lines.push(`/dev/sdb1        20G   44M   19G   1% ${sdb1.mountpoint}`);
      }

      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // du
  registry.register({
    name: 'du',
    description: 'Estimate file space usage',
    usage: 'du [-s] [-h] [path]',
    flags: [
      { flag: '-s', description: 'Display only total for each argument' },
      { flag: '-h', description: 'Human-readable sizes' },
    ],
    handler: (args, _flags, shellState, vfs) => {
      const targetPath = args[0]
        ? (() => { const p = args[0]; return p.startsWith('/') ? p : p.startsWith('~') ? (shellState.env['HOME'] || '/home/user') + p.slice(1) : shellState.cwd + '/' + p; })()
        : shellState.cwd;

      const node = vfs.getNode(targetPath);
      if (!node) {
        return { stdout: '', stderr: `du: cannot access '${args[0] || targetPath}': No such file or directory`, exitCode: 1 };
      }

      const size = vfs.getSize(node);
      const sizeK = Math.ceil(size / 1024);
      return { stdout: `${sizeK}K\t${args[0] || '.'}`, stderr: '', exitCode: 0 };
    },
  });

  // free
  registry.register({
    name: 'free',
    description: 'Display amount of free and used memory',
    usage: 'free [-m]',
    flags: [{ flag: '-m', description: 'Display in megabytes' }],
    handler: () => {
      const output = [
        '              total        used        free      shared  buff/cache   available',
        'Mem:           8192        1248        4512         156        2432        6580',
        'Swap:          2048          64        1984',
      ].join('\n');
      return { stdout: output, stderr: '', exitCode: 0 };
    },
  });

  // ps
  registry.register({
    name: 'ps',
    description: 'Report process status',
    usage: 'ps [aux]',
    flags: [],
    handler: (_args, flags) => {
      const runningServices = getRunningServicesList();

      const lines = [
        '  PID TTY          TIME CMD',
        '    1 ?        00:00:01 systemd',
        '  892 ?        00:00:02 NetworkManager',
        ...runningServices.map(s => ` ${String(s.pid).padStart(4)} ?        00:00:01 ${s.name}`),
        ' 1023 pts/0    00:00:00 bash',
        ' 1102 pts/0    00:00:00 ps',
      ];

      if (flags['a'] || flags['u'] || flags['x']) {
        const auxLines = [
          'USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND',
          'root         1  0.0  0.1 171236 12304 ?        Ss   10:15   0:01 /sbin/init',
          'root       892  0.0  0.2 549612 20480 ?        Ssl  10:15   0:02 /usr/sbin/NetworkManager',
          ...runningServices.map(s =>
            `${s.user.padEnd(8)}  ${String(s.pid).padStart(4)}  0.1  0.3  68924  8192 ?        Ss   10:15   0:00 ${s.command}`
          ),
          'user      1023  0.0  0.0  25540  5748 pts/0    Ss   10:18   0:00 -bash',
          'user      1102  0.0  0.0  44396  3456 pts/0    R+   10:25   0:00 ps aux',
        ];
        return { stdout: auxLines.join('\n'), stderr: '', exitCode: 0 };
      }

      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // top/htop
  registry.register({
    name: 'top',
    description: 'Display system processes',
    usage: 'top',
    flags: [],
    handler: () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const runningServices = getRunningServicesList();

      const lines = [
        `top - ${h}:${m}:00 up 5:32,  1 user,  load average: 0.12, 0.08, 0.05`,
        'Tasks:  86 total,   1 running,  85 sleeping,   0 stopped,   0 zombie',
        '%Cpu(s):  2.3 us,  1.0 sy,  0.0 ni, 96.4 id,  0.2 wa,  0.0 hi,  0.1 si',
        'MiB Mem :   8192.0 total,   4512.0 free,   1248.0 used,   2432.0 buff/cache',
        'MiB Swap:   2048.0 total,   1984.0 free,     64.0 used.   6580.0 avail Mem',
        '',
        '  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND',
        '  892 root      20   0  549612  20480  15360 S   1.2   0.2   0:02.34 NetworkMa+',
        '    1 root      20   0  171236  12304   8960 S   0.0   0.1   0:01.12 systemd',
        ...runningServices.map(s =>
          ` ${String(s.pid).padStart(4)} ${s.user.padEnd(9)} 20   0   72304   5636   4864 S   0.1   0.1   0:00.12 ${s.name}`
        ),
        ' 1023 user      20   0   25540   5748   4608 S   0.0   0.0   0:00.22 bash',
        ' 1102 user      20   0   44396   3456   3072 R   0.0   0.0   0:00.01 top',
      ];
      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  registry.register({
    name: 'htop',
    description: 'Interactive process viewer',
    usage: 'htop',
    flags: [],
    handler: () => {
      // Reuse top output with htop header
      const lines = [
        '  CPU[|||                    2.3%]   Tasks: 86, 1 running',
        '  Mem[|||||||||           1.2G/8.0G]   Load average: 0.12 0.08 0.05',
        '  Swp[|                  64M/2.0G]   Uptime: 05:32:00',
        '',
        '  PID USER     PRI  NI  VIRT   RES   SHR S CPU%  MEM%   TIME+  Command',
        '  892 root      20   0  536M  20.0M 15.0M S  1.2   0.2  0:02.3 /usr/sbin/NetworkManager',
        '    1 root      20   0  167M  12.0M  8.7M S  0.0   0.1  0:01.1 /sbin/init',
        '  421 root      20   0 70.6M  5.5M  4.7M S  0.0   0.0  0:00.4 sshd: /usr/sbin/sshd',
        ' 1023 user      20   0 24.9M  5.6M  4.5M S  0.0   0.0  0:00.2 -bash',
      ];
      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // kill
  registry.register({
    name: 'kill',
    description: 'Send signal to a process or background job',
    usage: 'kill [%job_id | pid]',
    flags: [],
    handler: (args, _flags, shellState) => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'kill: usage: kill <pid> or kill %<job>', exitCode: 1 };
      }
      const target = args[0];

      // Check background jobs
      if (shellState.jobs && shellState.jobs.length > 0) {
        let cleanId: number | null = null;
        if (target.startsWith('%')) {
          cleanId = parseInt(target.slice(1), 10);
        } else if (/^\d+$/.test(target)) {
          cleanId = parseInt(target, 10);
        }

        if (cleanId !== null) {
          const jobIndex = shellState.jobs.findIndex(j => j.id === cleanId || j.pid === cleanId);
          if (jobIndex !== -1) {
            const [job] = shellState.jobs.splice(jobIndex, 1);
            return { stdout: `[${job.id}]+  Terminated: 15          ${job.command}`, stderr: '', exitCode: 0 };
          }
        }
      }

      // Check simulated services
      const runningServices = getRunningServicesList();
      const srv = runningServices.find(s => String(s.pid) === target || s.name === target);
      if (srv) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: `kill: (${target}): No such process`, exitCode: 1 };
    },
  });

  // ping
  registry.register({
    name: 'ping',
    description: 'Send ICMP echo requests to a host',
    usage: 'ping <host>',
    flags: [],
    handler: async (args, _flags, _shellState, vfs, _stdin, context): Promise<CommandResult> => {
      if (!context) return { stdout: '', stderr: 'ping: no context', exitCode: 1 };
      const host = args[0];
      if (!host) return { stdout: '', stderr: 'ping: usage error: Destination address required', exitCode: 1 };

      let aborted = false;
      context.onCtrlC(() => { aborted = true; });
      context.setRunning(true);

      const resolved = resolveHostname(host, vfs);
      const ip = resolved.ip;
      context.addLine('output', `PING ${host} (${ip}): 56 data bytes`);

      let sent = 0;
      for (let i = 0; i < 4; i++) {
        if (aborted) break;
        await new Promise(r => setTimeout(r, 1000));
        if (aborted) break;
        const time = (10 + Math.random() * 50).toFixed(1);
        context.addLine('output', `64 bytes from ${ip}: icmp_seq=${i} ttl=56 time=${time} ms`);
        sent++;
      }

      context.addLine('output', '');
      context.addLine('output', `--- ${host} ping statistics ---`);
      const loss = sent < 4 ? ((4 - sent) / 4 * 100).toFixed(1) : '0.0';
      context.addLine('output', `4 packets transmitted, ${sent} packets received, ${loss}% packet loss`);
      context.setRunning(false);
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });
}
