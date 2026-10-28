import { registry } from '../commandRegistry';
import type { CommandResult, ShellState, StorageState } from '../../types';
import { resolvePath } from '../../vfs/pathResolver';
import { getRunningServicesList } from './sysadmin';

const STORAGE_KEY = 'linuxsim_storage';

export const DEFAULT_STORAGE_STATE: StorageState = {
  devices: [
    {
      name: 'sda',
      majMin: '8:0',
      rm: false,
      size: '50G',
      ro: false,
      type: 'disk',
      mountpoint: null,
      children: [
        {
          name: 'sda1',
          majMin: '8:1',
          rm: false,
          size: '48G',
          ro: false,
          type: 'part',
          mountpoint: '/',
        },
        {
          name: 'sda2',
          majMin: '8:2',
          rm: false,
          size: '2G',
          ro: false,
          type: 'part',
          mountpoint: '[SWAP]',
        },
      ],
    },
    {
      name: 'sdb',
      majMin: '8:16',
      rm: false,
      size: '20G',
      ro: false,
      type: 'disk',
      mountpoint: null,
      children: [
        {
          name: 'sdb1',
          majMin: '8:17',
          rm: false,
          size: '20G',
          ro: false,
          type: 'part',
          mountpoint: null,
          fsType: 'ext4',
        },
      ],
    },
  ],
  mountedVolumes: {},
};

export function getStorageState(): StorageState {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.error('Failed to load storage state', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_STORAGE_STATE));
}

export function saveStorageState(state: StorageState) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.error('Failed to save storage state', e);
  }
}

function resolve(filepath: string, shellState: ShellState): string {
  return resolvePath(filepath, shellState.cwd, shellState.env['HOME'] || '/home/user');
}

export function registerKernelStorageCommands() {
  // ==================== LSBLK ====================
  registry.register({
    name: 'lsblk',
    description: 'List information about block devices',
    usage: 'lsblk [-a] [-f]',
    flags: [
      { flag: '-a', description: 'List all devices' },
      { flag: '-f', description: 'Output info about filesystems' },
    ],
    handler: (_args, flags): CommandResult => {
      const state = getStorageState();
      const showFs = Boolean(flags['f']);

      if (showFs) {
        const header = 'NAME   FSTYPE FSVER LABEL UUID                                 FSAVAIL FSUSE% MOUNTPOINTS';
        const lines: string[] = [header];

        for (const dev of state.devices) {
          lines.push(`${dev.name.padEnd(6)}`);
          if (dev.children) {
            dev.children.forEach((c, idx) => {
              const prefix = idx === dev.children!.length - 1 ? '└─' : '├─';
              const fstype = c.fsType || (c.name.includes('swap') ? 'swap' : 'ext4');
              const uuid = `4a9f${c.name}-81de-49c0-9d0b-${c.name}2026`;
              const avail = c.mountpoint === '/' ? '35G' : c.mountpoint ? '19G' : '';
              const use = c.mountpoint === '/' ? '26%' : c.mountpoint ? '1%' : '';
              lines.push(
                `${prefix}${c.name.padEnd(5)} ${fstype.padEnd(6)}       ${uuid.padEnd(36)} ${avail.padEnd(7)} ${use.padEnd(6)} ${c.mountpoint || ''}`
              );
            });
          }
        }
        return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
      }

      const header = 'NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINTS';
      const lines: string[] = [header];

      for (const dev of state.devices) {
        lines.push(
          `${dev.name.padEnd(6)} ${dev.majMin.padEnd(7)}  ${dev.rm ? '1' : '0'}  ${dev.size.padStart(4)}  ${dev.ro ? '1' : '0'} ${dev.type.padEnd(4)} ${dev.mountpoint || ''}`
        );
        if (dev.children) {
          dev.children.forEach((c, idx) => {
            const prefix = idx === dev.children!.length - 1 ? '└─' : '├─';
            const nameStr = `${prefix}${c.name}`;
            lines.push(
              `${nameStr.padEnd(6)} ${c.majMin.padEnd(7)}  ${c.rm ? '1' : '0'}  ${c.size.padStart(4)}  ${c.ro ? '1' : '0'} ${c.type.padEnd(4)} ${c.mountpoint || ''}`
            );
          });
        }
      }

      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // ==================== MOUNT ====================
  registry.register({
    name: 'mount',
    description: 'Mount a filesystem',
    usage: 'mount [device] [mount_point]',
    flags: [],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      const state = getStorageState();

      // If no arguments, print current mounts
      if (args.length === 0) {
        const lines = [
          'sysfs on /sys type sysfs (rw,nosuid,nodev,noexec,relatime)',
          'proc on /proc type proc (rw,nosuid,nodev,noexec,relatime)',
          'udev on /dev type devtmpfs (rw,nosuid,noexec,relatime,size=4042848k,nr_inodes=1010712,mode=755)',
          '/dev/sda1 on / type ext4 (rw,relatime,errors=remount-ro)',
          'tmpfs on /tmp type tmpfs (rw,nosuid,nodev)',
        ];
        // Add sdb1 if mounted
        const sdb = state.devices.find((d) => d.name === 'sdb');
        const sdb1 = sdb?.children?.find((c) => c.name === 'sdb1');
        if (sdb1?.mountpoint) {
          lines.push(`/dev/sdb1 on ${sdb1.mountpoint} type ext4 (rw,relatime)`);
        }
        return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
      }

      const deviceArg = args[0];
      const targetDirArg = args[1];

      if (!targetDirArg) {
        return { stdout: '', stderr: 'mount: specify mountpoint target directory', exitCode: 1 };
      }

      // Check permissions
      if (!shellState.isRoot && shellState.env['USER'] !== 'root') {
        return { stdout: '', stderr: 'mount: only root can use "--options" option (or no-options)', exitCode: 1 };
      }

      const targetPath = resolve(targetDirArg, shellState);
      const targetNode = vfs.getNode(targetPath, true);

      if (!targetNode || targetNode.type !== 'dir') {
        return { stdout: '', stderr: `mount: mount point ${targetDirArg} does not exist`, exitCode: 32 };
      }

      const sdb = state.devices.find((d) => d.name === 'sdb');
      const sdb1 = sdb?.children?.find((c) => c.name === 'sdb1');

      if (deviceArg === '/dev/sdb1' || deviceArg === 'sdb1') {
        if (!sdb1) {
          return { stdout: '', stderr: 'mount: special device /dev/sdb1 does not exist', exitCode: 32 };
        }
        if (sdb1.mountpoint) {
          return { stdout: '', stderr: `mount: /dev/sdb1 is already mounted on ${sdb1.mountpoint}`, exitCode: 32 };
        }

        sdb1.mountpoint = targetPath;
        saveStorageState(state);

        // Populate attached volume files into VFS target directory
        const lostFoundPath = `${targetPath}/lost+found`.replace(/\/+/g, '/');
        const vaultPath = `${targetPath}/vault_backup.tar.gz`.replace(/\/+/g, '/');

        if (!vfs.getNode(lostFoundPath)) {
          vfs.createDirectory(lostFoundPath);
        }
        if (!vfs.getNode(vaultPath)) {
          vfs.writeFile(vaultPath, 'TAR_ARCHIVE_V1:{"database_vault.sql":"-- Confidential database dump\\n"}');
        }

        return { stdout: '', stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: `mount: special device ${deviceArg} does not exist`, exitCode: 32 };
    },
  });

  // ==================== UMOUNT ====================
  registry.register({
    name: 'umount',
    description: 'Unmount file systems',
    usage: 'umount <mount_point | device>',
    flags: [],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'umount: missing operand', exitCode: 1 };
      }

      if (!shellState.isRoot && shellState.env['USER'] !== 'root') {
        return { stdout: '', stderr: 'umount: only root can unmount', exitCode: 1 };
      }

      const state = getStorageState();
      const targetArg = args[0];
      const targetPath = resolve(targetArg, shellState);

      const sdb = state.devices.find((d) => d.name === 'sdb');
      const sdb1 = sdb?.children?.find((c) => c.name === 'sdb1');

      if (!sdb1 || !sdb1.mountpoint) {
        return { stdout: '', stderr: `umount: ${targetArg}: not mounted`, exitCode: 32 };
      }

      if (sdb1.mountpoint === targetPath || targetArg === '/dev/sdb1' || targetArg === 'sdb1') {
        const oldMount = sdb1.mountpoint;
        sdb1.mountpoint = null;
        saveStorageState(state);

        // Hide/clean attached files
        try {
          vfs.deleteNode(`${oldMount}/vault_backup.tar.gz`);
          vfs.deleteNode(`${oldMount}/lost+found`);
        } catch {
          // Ignore
        }

        return { stdout: '', stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: `umount: ${targetArg}: not mounted`, exitCode: 32 };
    },
  });

  // ==================== FDISK ====================
  registry.register({
    name: 'fdisk',
    description: 'Manipulate disk partition table',
    usage: 'fdisk -l [device]',
    flags: [{ flag: '-l', description: 'List partition tables' }],
    handler: (): CommandResult => {
      const output = [
        'Disk /dev/sda: 50 GiB, 53687091200 bytes, 104857600 sectors',
        'Disk model: QEMU HARDDISK',
        'Units: sectors of 1 * 512 = 512 bytes',
        'Sector size (logical/physical): 512 bytes / 512 bytes',
        'I/O size (minimum/optimal): 512 bytes / 512 bytes',
        'Disklabel type: gpt',
        'Disk identifier: 7F23E4C1-8012-429B-9871-38E40B7293A1',
        '',
        'Device       Start       End   Sectors Size Type',
        '/dev/sda1     2048 100663295 100661248  48G Linux filesystem',
        '/dev/sda2 100663296 104857566   4194271   2G Linux swap',
        '',
        'Disk /dev/sdb: 20 GiB, 21474836480 bytes, 41943040 sectors',
        'Disk model: VIRTUAL EXT VOL',
        'Units: sectors of 1 * 512 = 512 bytes',
        'Sector size (logical/physical): 512 bytes / 512 bytes',
        'Disklabel type: gpt',
        '',
        'Device     Start      End  Sectors Size Type',
        '/dev/sdb1   2048 41943006 41940959  20G Linux filesystem',
      ];
      return { stdout: output.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // ==================== JOURNALCTL ====================
  registry.register({
    name: 'journalctl',
    description: 'Query the systemd journal',
    usage: 'journalctl [-u service] [-n count] [-p priority] [--no-pager]',
    flags: [
      { flag: '-u', description: 'Show logs for the specified unit' },
      { flag: '-n', description: 'Number of journal entries to show' },
      { flag: '-p', description: 'Filter by priority (err, warning, info)' },
      { flag: '--no-pager', description: 'Do not pipe output into a pager' },
    ],
    handler: (_args, flags): CommandResult => {
      const unit = typeof flags['u'] === 'string' ? flags['u'] : null;
      const count = typeof flags['n'] === 'string' ? parseInt(flags['n'], 10) : 50;

      const now = new Date();
      const monthStr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][now.getMonth()];
      const day = String(now.getDate()).padStart(2, ' ');
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ts = `${monthStr} ${day} ${h}:${m}:${s}`;

      if (unit === 'nginx') {
        const lines = [
          `${ts} linux-box systemd[1]: Starting A high performance web server and a reverse proxy server...`,
          `${ts} linux-box nginx[1240]: nginx: the configuration file /etc/nginx/nginx.conf syntax is ok`,
          `${ts} linux-box nginx[1240]: nginx: configuration file /etc/nginx/nginx.conf test is successful`,
          `${ts} linux-box systemd[1]: Started A high performance web server and a reverse proxy server.`,
          `${ts} linux-box nginx[1242]: 10.0.0.2 - - [GET / HTTP/1.1] 200 612 "-" "curl/7.88.1"`,
        ];
        return { stdout: lines.slice(-count).join('\n'), stderr: '', exitCode: 0 };
      }

      if (unit === 'ssh' || unit === 'sshd') {
        const lines = [
          `${ts} linux-box systemd[1]: Starting OpenBSD Secure Shell server...`,
          `${ts} linux-box sshd[892]: Server listening on 0.0.0.0 port 22.`,
          `${ts} linux-box sshd[892]: Server listening on :: port 22.`,
          `${ts} linux-box systemd[1]: Started OpenBSD Secure Shell server.`,
          `${ts} linux-box sshd[1020]: Accepted publickey for user from 10.0.0.2 port 54322 ssh2`,
        ];
        return { stdout: lines.slice(-count).join('\n'), stderr: '', exitCode: 0 };
      }

      // Default full journal
      const services = getRunningServicesList();
      const lines = [
        `-- Boot 7f23e4c18012429b987138e40b7293a1 --`,
        `${ts} linux-box kernel: Linux version 6.5.0-sim (buildd@linuxsim) (gcc-13) #1 SMP PREEMPT_DYNAMIC`,
        `${ts} linux-box kernel: Command line: BOOT_IMAGE=/vmlinuz-6.5.0-sim root=/dev/sda1 ro quiet splash`,
        `${ts} linux-box systemd[1]: Started Dispatch Password Requests to Console Directory Watch.`,
        `${ts} linux-box systemd[1]: Reached target Local Encrypted Volumes.`,
        `${ts} linux-box systemd[1]: Reached target Local File Systems.`,
        `${ts} linux-box systemd[1]: Started Network Name Resolution.`,
        `${ts} linux-box systemd[1]: Reached target Network.`,
        ...services.map((srv) => `${ts} linux-box systemd[1]: Started ${srv.name}.service.`),
        `${ts} linux-box systemd[1]: Startup finished in 1.42s (kernel) + 2.10s (userspace) = 3.52s.`,
      ];

      return { stdout: lines.slice(-count).join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // ==================== DMESG ====================
  registry.register({
    name: 'dmesg',
    description: 'Print or control the kernel ring buffer',
    usage: 'dmesg [-T] [-l level]',
    flags: [
      { flag: '-T', description: 'Print human-readable timestamps' },
      { flag: '-l', description: 'Restrict output to specified levels' },
    ],
    handler: (_args, flags): CommandResult => {
      const isHuman = Boolean(flags['T']);
      const prefix = isHuman ? `[${new Date().toLocaleString()}] ` : '[    0.000000] ';

      const messages = [
        `${prefix}Linux version 6.5.0-sim (gcc version 13.2.0) #1 SMP PREEMPT_DYNAMIC Mon Oct 26 12:00:00 UTC 2026`,
        `[    0.000000] Command line: BOOT_IMAGE=/vmlinuz-6.5.0-sim root=/dev/sda1 ro quiet splash`,
        `[    0.000000] KERNEL supported cpus: Intel, AMD, Hygon`,
        `[    0.004120] x86/fpu: Supporting XSAVE feature 0x001: 'x87 floating point registers'`,
        `[    0.008310] ACPI: Core revision 20230628`,
        `[    0.120442] Memory: 8192000K/8388608K available (14336K kernel code, 2304K data, 4096K rodata)`,
        `[    0.450123] pci 0000:00:00.0: [8086:1237] type 00 class 0x060000`,
        `[    0.820991] ata1.00: ATA-9: QEMU HARDDISK, 2.5+, max UDMA/100`,
        `[    1.120542] scsi 0:0:0:0: Direct-Access     QEMU     QEMU HARDDISK    2.5+ PQ: 0 ANSI: 5`,
        `[    1.420112] sd 0:0:0:0: [sda] 104857600 512-byte logical blocks: (50.0 GB/50.0 GiB)`,
        `[    1.420310]  sda: sda1 sda2`,
        `[    1.421500] sd 0:0:0:0: [sda] Attached SCSI disk`,
        `[    2.150492] scsi 1:0:0:0: Direct-Access     SIM      VIRTUAL EXT VOL  1.0  PQ: 0 ANSI: 5`,
        `[    2.150720] sd 1:0:0:0: [sdb] 41943040 512-byte logical blocks: (20.0 GB/20.0 GiB)`,
        `[    2.150900]  sdb: sdb1`,
        `[    2.151120] sd 1:0:0:0: [sdb] Attached SCSI disk`,
        `[    2.480119] EXT4-fs (sda1): mounted filesystem 4a9fsda1 with ordered data mode. Quota mode: none.`,
        `[    2.820300] e1000 0000:00:03.0 eth0: (PCI:33MHz:32-bit) 52:54:00:12:34:56`,
        `[    2.820301] e1000 0000:00:03.0 eth0: Intel(R) PRO/1000 Network Connection`,
        `[    3.102391] IPv6: ADDRCONF(NETDEV_CHANGE): eth0: link becomes ready`,
      ];

      return { stdout: messages.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // ==================== SYSCTL ====================
  registry.register({
    name: 'sysctl',
    description: 'Configure kernel parameters at runtime',
    usage: 'sysctl [-a] [-w] [variable[=value]]',
    flags: [
      { flag: '-a', description: 'Display all variables currently available' },
      { flag: '-w', description: 'Write variable value' },
    ],
    handler: (args, flags, shellState, vfs): CommandResult => {
      const confPath = '/etc/sysctl.conf';
      const confNode = vfs.getNode(confPath, true);
      let content = confNode?.content || 'net.ipv4.ip_forward = 0\nvm.swappiness = 60\nkernel.randomize_va_space = 2\n';

      // Parse current sysctl dictionary
      const params: Record<string, string> = {
        'net.ipv4.ip_forward': '0',
        'vm.swappiness': '60',
        'kernel.randomize_va_space': '2',
        'net.ipv4.tcp_syncookies': '1',
        'net.core.somaxconn': '4096',
        'fs.file-max': '9223372036854775807',
        'kernel.pid_max': '4194304',
        'vm.max_map_count': '262144',
      };

      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const k = trimmed.substring(0, eqIdx).trim();
          const v = trimmed.substring(eqIdx + 1).trim();
          params[k] = v;
        }
      }

      if (flags['a'] || args.length === 0) {
        const lines = Object.entries(params).map(([k, v]) => `${k} = ${v}`);
        return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
      }

      // sysctl -w key=val or sysctl -w key = val
      if (flags['w'] || args.some((a) => a.includes('='))) {
        if (!shellState.isRoot && shellState.env['USER'] !== 'root') {
          return { stdout: '', stderr: 'sysctl: permission denied on key writing', exitCode: 1 };
        }

        const assignArg = args.find((a) => a.includes('=')) || args.join(' ');
        const eqIdx = assignArg.indexOf('=');
        if (eqIdx === -1) {
          return { stdout: '', stderr: 'sysctl: -w requires variable=value', exitCode: 1 };
        }

        const key = assignArg.substring(0, eqIdx).replace(/^-w\s*/, '').trim();
        const val = assignArg.substring(eqIdx + 1).trim();

        params[key] = val;

        // Update /etc/sysctl.conf
        const newLines = Object.entries(params).map(([k, v]) => `${k} = ${v}`).join('\n') + '\n';
        vfs.writeFile(confPath, newLines);

        return { stdout: `${key} = ${val}`, stderr: '', exitCode: 0 };
      }

      const queryKey = args[0];
      if (params[queryKey] !== undefined) {
        return { stdout: `${queryKey} = ${params[queryKey]}`, stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: `sysctl: cannot stat /proc/sys/${queryKey.replace(/\./g, '/')}: No such file or directory`, exitCode: 1 };
    },
  });
}
