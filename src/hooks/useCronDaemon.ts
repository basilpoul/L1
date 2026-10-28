import { useEffect } from 'react';
import type { VirtualFileSystem } from '../vfs/fileSystem';
import { getSysAdminState } from '../shell/commands/sysadmin';

export function useCronDaemon(vfs: VirtualFileSystem, refreshVFS: () => void) {
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const sysState = getSysAdminState();
        if (sysState.services.cron?.status !== 'running') {
          return;
        }

        const crontabNode = vfs.getNode('/etc/crontab', true);
        if (!crontabNode || !crontabNode.content) {
          return;
        }

        const lines = crontabNode.content.split('\n');
        let executedAny = false;

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;

          // Parse cron line: e.g. "* * * * * root command" or "* * * * * command"
          const parts = trimmed.split(/\s+/);
          if (parts.length >= 6) {
            let user = 'root';
            let cmd = '';
            if (parts.length >= 7 && (parts[5] === 'root' || parts[5] === 'user')) {
              user = parts[5];
              cmd = parts.slice(6).join(' ');
            } else {
              cmd = parts.slice(5).join(' ');
            }

            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
            const pid = Math.floor(Math.random() * 8000 + 1000);
            const syslogEntry = `${timestamp} linux-box CRON[${pid}]: (${user}) CMD (${cmd})\n`;

            // Append to /var/log/syslog
            const syslogNode = vfs.getNode('/var/log/syslog', true);
            const currentSyslog = syslogNode?.content || '';
            vfs.writeFile('/var/log/syslog', currentSyslog + syslogEntry);

            // If the command redirects output e.g. echo "heartbeat" >> /var/log/cron.log
            if (cmd.includes('>>')) {
              const [val, destFile] = cmd.split('>>').map(s => s.trim().replace(/^["']|["']$/g, ''));
              if (destFile) {
                const targetNode = vfs.getNode(destFile, true);
                const cur = targetNode?.content || '';
                vfs.writeFile(destFile, cur + (val.replace(/^echo\s+/, '') + '\n'));
              }
            } else if (cmd.includes('>')) {
              const [val, destFile] = cmd.split('>').map(s => s.trim().replace(/^["']|["']$/g, ''));
              if (destFile) {
                vfs.writeFile(destFile, val.replace(/^echo\s+/, '') + '\n');
              }
            }

            executedAny = true;
          }
        }

        if (executedAny) {
          refreshVFS();
        }
      } catch (err) {
        console.error('Error running cron daemon tick:', err);
      }
    }, 30000); // Ticks every 30 seconds

    return () => clearInterval(interval);
  }, [vfs, refreshVFS]);
}
