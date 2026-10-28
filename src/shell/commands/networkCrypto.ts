import { registry } from '../commandRegistry';
import { resolvePath } from '../../vfs/pathResolver';
import type { ShellState, CommandResult } from '../../types';
import type { VirtualFileSystem } from '../../vfs/fileSystem';

function resolve(p: string, s: ShellState): string {
  return resolvePath(p, s.cwd, s.env['HOME'] || '/home/user');
}

/**
 * Real-time /etc/hosts DNS Resolver
 */
export function resolveHostname(
  hostOrUrl: string,
  vfs: VirtualFileSystem
): { ip: string; hostname: string } {
  // Strip protocol, port, path if URL was passed
  let cleaned = hostOrUrl.trim().replace(/^[a-zA-Z]+:\/\//, '');
  const colonIdx = cleaned.indexOf(':');
  if (colonIdx !== -1) cleaned = cleaned.slice(0, colonIdx);
  const slashIdx = cleaned.indexOf('/');
  if (slashIdx !== -1) cleaned = cleaned.slice(0, slashIdx);

  // If already an IPv4 address, return directly
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleaned)) {
    return { ip: cleaned, hostname: cleaned };
  }

  // Read /etc/hosts from VFS
  const hostsNode = vfs.getNode('/etc/hosts', true);
  if (hostsNode && hostsNode.content) {
    const lines = hostsNode.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const ip = parts[0];
        const aliases = parts.slice(1);
        if (aliases.includes(cleaned)) {
          return { ip, hostname: cleaned };
        }
      }
    }
  }

  // Default hardcoded simulated fallbacks
  if (cleaned === 'localhost') return { ip: '127.0.0.1', hostname: 'localhost' };
  if (cleaned === 'linux-box') return { ip: '127.0.1.1', hostname: 'linux-box' };
  if (cleaned === 'prod-node' || cleaned === 'prod.internal') return { ip: '10.0.0.5', hostname: 'prod-node' };
  if (cleaned.includes('api.linuxsim.local')) return { ip: '127.0.0.1', hostname: 'api.linuxsim.local' };
  if (cleaned.includes('git.linuxsim.local')) return { ip: '10.0.0.2', hostname: 'git.linuxsim.local' };

  // Default simulated IP for any external mock domain
  let hash = 0;
  for (let i = 0; i < cleaned.length; i++) hash = (hash * 31 + cleaned.charCodeAt(i)) & 0xffffffff;
  const octet3 = Math.abs(hash % 200) + 1;
  const octet4 = Math.abs((hash >> 8) % 250) + 1;
  return { ip: `93.184.${octet3}.${octet4}`, hostname: cleaned };
}

// ==================== HASH ALGORITHMS ====================

// Pure JS SHA-256
function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  let i = 0, j = 0;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  for (i = 0; i < ascii.length; i++) {
    const code = ascii.charCodeAt(i);
    words[i >> 2] |= (code & 0xff) << (24 - (i % 4) * 8);
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32));
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength;

  for (i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = hash.slice();

    for (j = 0; j < 64; j++) {
      if (j >= 16) {
        const s0 = rightRotate(w[j - 15], 7) ^ rightRotate(w[j - 15], 18) ^ (w[j - 15] >>> 3);
        const s1 = rightRotate(w[j - 2], 17) ^ rightRotate(w[j - 2], 19) ^ (w[j - 2] >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
      }

      const s1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1 + ch + k[j] + w[j]) | 0;
      const s0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0 + maj) | 0;

      hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (j = 0; j < 8; j++) {
      hash[j] = (hash[j] + oldHash[j]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// Pure JS MD5
function md5(str: string): string {
  function safeAdd(x: number, y: number) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function bitRol(num: number, cnt: number) {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return safeAdd(bitRol(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const nblk = ((str.length + 8) >> 6) + 1;
  const blks: number[] = new Array(nblk * 16).fill(0);
  for (let i = 0; i < str.length; i++) {
    blks[i >> 2] |= (str.charCodeAt(i) & 0xff) << ((i % 4) * 8);
  }
  blks[str.length >> 2] |= 0x80 << ((str.length % 4) * 8);
  blks[nblk * 16 - 2] = str.length * 8;

  let a = 1732584193;
  let b = -271733879;
  let c = -1732584194;
  let d = 271733878;

  for (let i = 0; i < blks.length; i += 16) {
    const olda = a, oldb = b, oldc = c, oldd = d;
    a = md5ff(a, b, c, d, blks[i], 7, -680876936);
    d = md5ff(d, a, b, c, blks[i + 1], 12, -389564586);
    c = md5ff(c, d, a, b, blks[i + 2], 17, 606105819);
    b = md5ff(b, c, d, a, blks[i + 3], 22, -1044525330);
    a = md5ff(a, b, c, d, blks[i + 4], 7, -176418897);
    d = md5ff(d, a, b, c, blks[i + 5], 12, 1200080426);
    c = md5ff(c, d, a, b, blks[i + 6], 17, -1473231341);
    b = md5ff(b, c, d, a, blks[i + 7], 22, -45705983);
    a = md5ff(a, b, c, d, blks[i + 8], 7, 1770035416);
    d = md5ff(d, a, b, c, blks[i + 9], 12, -1958414417);
    c = md5ff(c, d, a, b, blks[i + 10], 17, -42063);
    b = md5ff(b, c, d, a, blks[i + 11], 22, -1990404162);
    a = md5ff(a, b, c, d, blks[i + 12], 7, 1804603682);
    d = md5ff(d, a, b, c, blks[i + 13], 12, -40341101);
    c = md5ff(c, d, a, b, blks[i + 14], 17, -1502002290);
    b = md5ff(b, c, d, a, blks[i + 15], 22, 1236535329);

    a = md5gg(a, b, c, d, blks[i + 1], 5, -165796510);
    d = md5gg(d, a, b, c, blks[i + 6], 9, -1069501632);
    c = md5gg(c, d, a, b, blks[i + 11], 14, 643717713);
    b = md5gg(b, c, d, a, blks[i], 20, -373897302);
    a = md5gg(a, b, c, d, blks[i + 5], 5, -701558691);
    d = md5gg(d, a, b, c, blks[i + 10], 9, 38016083);
    c = md5gg(c, d, a, b, blks[i + 15], 14, -660478335);
    b = md5gg(b, c, d, a, blks[i + 4], 20, -405537848);
    a = md5gg(a, b, c, d, blks[i + 9], 5, 568446438);
    d = md5gg(d, a, b, c, blks[i + 14], 9, -1019803690);
    c = md5gg(c, d, a, b, blks[i + 3], 14, -187363961);
    b = md5gg(b, c, d, a, blks[i + 8], 20, 1163531501);
    a = md5gg(a, b, c, d, blks[i + 13], 5, -1444681467);
    d = md5gg(d, a, b, c, blks[i + 2], 9, -51403784);
    c = md5gg(c, d, a, b, blks[i + 7], 14, 1735328473);
    b = md5gg(b, c, d, a, blks[i + 12], 20, -1926607734);

    a = md5hh(a, b, c, d, blks[i + 5], 4, -378558);
    d = md5hh(d, a, b, c, blks[i + 8], 11, -2022574463);
    c = md5hh(c, d, a, b, blks[i + 11], 16, 1839030562);
    b = md5hh(b, c, d, a, blks[i + 14], 23, -35309556);
    a = md5hh(a, b, c, d, blks[i + 1], 4, -1530992060);
    d = md5hh(d, a, b, c, blks[i + 4], 11, 1272893353);
    c = md5hh(c, d, a, b, blks[i + 7], 16, -155497632);
    b = md5hh(b, c, d, a, blks[i + 10], 23, -1094730640);
    a = md5hh(a, b, c, d, blks[i + 13], 4, 681279174);
    d = md5hh(d, a, b, c, blks[i], 11, -358537222);
    c = md5hh(c, d, a, b, blks[i + 3], 16, -722521979);
    b = md5hh(b, c, d, a, blks[i + 6], 23, 76029189);
    a = md5hh(a, b, c, d, blks[i + 9], 4, -640364487);
    d = md5hh(d, a, b, c, blks[i + 12], 11, -421815835);
    c = md5hh(c, d, a, b, blks[i + 15], 16, 530742520);
    b = md5hh(b, c, d, a, blks[i + 2], 23, -995338651);

    a = md5ii(a, b, c, d, blks[i], 6, -198630844);
    d = md5ii(d, a, b, c, blks[i + 7], 10, 1126891415);
    c = md5ii(c, d, a, b, blks[i + 14], 15, -1416354905);
    b = md5ii(b, c, d, a, blks[i + 5], 21, -57434055);
    a = md5ii(a, b, c, d, blks[i + 12], 6, 1700485571);
    d = md5ii(d, a, b, c, blks[i + 3], 10, -1894986606);
    c = md5ii(c, d, a, b, blks[i + 10], 15, -1051523);
    b = md5ii(b, c, d, a, blks[i + 1], 21, -2054922799);
    a = md5ii(a, b, c, d, blks[i + 8], 6, 1873313359);
    d = md5ii(d, a, b, c, blks[i + 15], 10, -30611744);
    c = md5ii(c, d, a, b, blks[i + 6], 15, -1560198380);
    b = md5ii(b, c, d, a, blks[i + 13], 21, 1309151649);
    a = md5ii(a, b, c, d, blks[i + 4], 6, -145523070);
    d = md5ii(d, a, b, c, blks[i + 11], 10, -1120210379);
    c = md5ii(c, d, a, b, blks[i + 2], 15, 718787259);
    b = md5ii(b, c, d, a, blks[i + 9], 21, -343485551);

    a = safeAdd(a, olda);
    b = safeAdd(b, oldb);
    c = safeAdd(c, oldc);
    d = safeAdd(d, oldd);
  }

  const hexDigits = '0123456789abcdef';
  let res = '';
  for (const byte of [a, b, c, d]) {
    for (let j = 0; j < 4; j++) {
      res += hexDigits.charAt((byte >> (j * 8 + 4)) & 0x0f) + hexDigits.charAt((byte >> (j * 8)) & 0x0f);
    }
  }
  return res;
}

// Generate random ASCII art box for ssh-keygen randomart
function generateRandomart(): string {
  return `+---[RSA 3072]----+
|      .o..o+o    |
|       ..+.==.   |
|        o.B+B.   |
|       o * O.o   |
|      . S * o .  |
|       . = + . . |
|        + = . E  |
|       . o . o   |
|                 |
+----[SHA256]-----+`;
}

// ==================== REGISTER COMMANDS ====================

export function registerNetworkCryptoCommands() {
  // --- ip ---
  registry.register({
    name: 'ip',
    description: 'Show / manipulate routing, network devices, interfaces and tunnels',
    usage: 'ip [addr|link|route]',
    flags: [],
    handler: (args): CommandResult => {
      const sub = args[0] || 'addr';
      if (sub === 'a' || sub === 'addr' || sub === 'address') {
        return {
          stdout: `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP group default qlen 1000
    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff
    inet 10.0.0.2/24 brd 10.0.0.255 scope global dynamic eth0
       valid_lft 86320sec preferred_lft 86320sec
3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN group default
    link/ether 02:42:e2:8a:12:34 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
       valid_lft forever preferred_lft forever`,
          stderr: '',
          exitCode: 0,
        };
      }

      if (sub === 'link' || sub === 'l') {
        return {
          stdout: `1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN mode DEFAULT group default qlen 1000\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc fq_codel state UP mode DEFAULT group default qlen 1000\n    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff
3: docker0: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state DOWN mode DEFAULT group default\n    link/ether 02:42:e2:8a:12:34 brd ff:ff:ff:ff:ff:ff`,
          stderr: '',
          exitCode: 0,
        };
      }

      if (sub === 'route' || sub === 'r') {
        return {
          stdout: `default via 10.0.0.1 dev eth0 proto dhcp metric 100\n10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.2\n172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1`,
          stderr: '',
          exitCode: 0,
        };
      }

      return { stdout: '', stderr: `Object "${sub}" is unknown, try "ip help".`, exitCode: 1 };
    },
  });

  // --- dig ---
  registry.register({
    name: 'dig',
    description: 'DNS lookup utility',
    usage: 'dig [domain] [type]',
    flags: [],
    handler: (args, _flags, _shellState, vfs): CommandResult => {
      const domain = args[0] || 'localhost';
      const resolved = resolveHostname(domain, vfs);

      const out = `; <<>> DiG 9.18.18-0ubuntu0.22.04.1-Ubuntu <<>> ${domain}
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 48921
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1

;; QUESTION SECTION:
;${domain}.			IN	A

;; ANSWER SECTION:
${domain}.		300	IN	A	${resolved.ip}

;; Query time: 1 msec
;; SERVER: 127.0.0.53#53(127.0.0.53) (UDP)
;; WHEN: ${new Date().toUTCString()}
;; MSG SIZE  rcvd: 56`;

      return { stdout: out, stderr: '', exitCode: 0 };
    },
  });

  // --- nslookup ---
  registry.register({
    name: 'nslookup',
    description: 'Query Internet name servers interactively',
    usage: 'nslookup <host>',
    flags: [],
    handler: (args, _flags, _shellState, vfs): CommandResult => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'nslookup: missing host operand', exitCode: 1 };
      }
      const host = args[0];
      const resolved = resolveHostname(host, vfs);

      return {
        stdout: `Server:\t\t127.0.0.53\nAddress:\t127.0.0.53#53\n\nNon-authoritative answer:\nName:\t${resolved.hostname}\nAddress: ${resolved.ip}`,
        stderr: '',
        exitCode: 0,
      };
    },
  });

  // --- traceroute ---
  registry.register({
    name: 'traceroute',
    description: 'Print the route packets trace to network host',
    usage: 'traceroute <host>',
    flags: [],
    handler: (args, _flags, _shellState, vfs): CommandResult => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'traceroute: missing host operand', exitCode: 1 };
      }
      const host = args[0];
      const resolved = resolveHostname(host, vfs);

      const out = `traceroute to ${host} (${resolved.ip}), 30 hops max, 60 byte packets
 1  gateway (10.0.0.1)  0.412 ms  0.388 ms  0.401 ms
 2  core-router.internal (10.0.0.254)  1.120 ms  1.095 ms  1.104 ms
 3  ${resolved.hostname} (${resolved.ip})  2.045 ms  2.012 ms  2.029 ms`;

      return { stdout: out, stderr: '', exitCode: 0 };
    },
  });

  // --- base64 ---
  registry.register({
    name: 'base64',
    description: 'Base64 encode or decode data to standard output',
    usage: 'base64 [-d] [file]',
    flags: [{ flag: '-d', description: 'Decode data' }],
    handler: (args, flags, shellState, vfs, stdin): CommandResult => {
      const isDecode = !!flags['d'] || args.includes('-d');
      const cleanArgs = args.filter(a => a !== '-d');

      let raw = stdin || '';
      if (cleanArgs.length > 0) {
        const fullPath = resolve(cleanArgs[0], shellState);
        const node = vfs.getNode(fullPath, true);
        if (!node) {
          return { stdout: '', stderr: `base64: ${cleanArgs[0]}: No such file or directory`, exitCode: 1 };
        }
        raw = node.content ?? '';
      }

      if (!raw && !stdin) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      if (isDecode) {
        try {
          const cleaned = raw.replace(/\s+/g, '');
          const decoded = atob(cleaned);
          return { stdout: decoded, stderr: '', exitCode: 0 };
        } catch {
          return { stdout: '', stderr: 'base64: invalid input', exitCode: 1 };
        }
      } else {
        const encoded = btoa(raw);
        return { stdout: encoded, stderr: '', exitCode: 0 };
      }
    },
  });

  // --- sha256sum ---
  registry.register({
    name: 'sha256sum',
    description: 'Compute and check SHA256 message digest',
    usage: 'sha256sum [-c] [file...]',
    flags: [{ flag: '-c', description: 'Read SHA256 sums from the FILEs and check them' }],
    handler: (args, flags, shellState, vfs, stdin): CommandResult => {
      const isCheck = !!flags['c'] || args.includes('-c');
      const cleanArgs = args.filter(a => a !== '-c');

      if (isCheck) {
        const checkFile = cleanArgs[0];
        if (!checkFile) return { stdout: '', stderr: 'sha256sum: missing file for -c', exitCode: 1 };
        const node = vfs.getNode(resolve(checkFile, shellState), true);
        if (!node || !node.content) return { stdout: '', stderr: `sha256sum: ${checkFile}: No such file or directory`, exitCode: 1 };

        const lines = node.content.split('\n').filter(Boolean);
        const results: string[] = [];
        for (const line of lines) {
          const parts = line.split(/\s+/);
          if (parts.length >= 2) {
            const expectedHash = parts[0];
            const targetPath = parts[1];
            const targetNode = vfs.getNode(resolve(targetPath, shellState), true);
            if (targetNode && targetNode.content !== undefined) {
              const actual = sha256(targetNode.content);
              results.push(actual === expectedHash ? `${targetPath}: OK` : `${targetPath}: FAILED`);
            } else {
              results.push(`${targetPath}: FAILED open or read`);
            }
          }
        }
        return { stdout: results.join('\n'), stderr: '', exitCode: 0 };
      }

      if (cleanArgs.length === 0) {
        const hash = sha256(stdin || '');
        return { stdout: `${hash}  -`, stderr: '', exitCode: 0 };
      }

      const out: string[] = [];
      for (const arg of cleanArgs) {
        const fullPath = resolve(arg, shellState);
        const node = vfs.getNode(fullPath, true);
        if (!node || node.type !== 'file') {
          return { stdout: '', stderr: `sha256sum: ${arg}: No such file or directory`, exitCode: 1 };
        }
        const hash = sha256(node.content ?? '');
        out.push(`${hash}  ${arg}`);
      }

      return { stdout: out.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // --- md5sum ---
  registry.register({
    name: 'md5sum',
    description: 'Compute and check MD5 message digest',
    usage: 'md5sum [file...]',
    flags: [],
    handler: (args, _flags, shellState, vfs, stdin): CommandResult => {
      if (args.length === 0) {
        const hash = md5(stdin || '');
        return { stdout: `${hash}  -`, stderr: '', exitCode: 0 };
      }
      const out: string[] = [];
      for (const arg of args) {
        const fullPath = resolve(arg, shellState);
        const node = vfs.getNode(fullPath, true);
        if (!node || node.type !== 'file') {
          return { stdout: '', stderr: `md5sum: ${arg}: No such file or directory`, exitCode: 1 };
        }
        const hash = md5(node.content ?? '');
        out.push(`${hash}  ${arg}`);
      }
      return { stdout: out.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // --- openssl ---
  registry.register({
    name: 'openssl',
    description: 'OpenSSL command line tool',
    usage: 'openssl [command] [args]',
    flags: [],
    handler: (args): CommandResult => {
      if (args.length === 0) {
        return { stdout: 'OpenSSL 3.0.2 15 Mar 2022 (Library: OpenSSL 3.0.2)', stderr: '', exitCode: 0 };
      }

      if (args[0] === 'version') {
        return { stdout: 'OpenSSL 3.0.2 15 Mar 2022 (Library: OpenSSL 3.0.2)', stderr: '', exitCode: 0 };
      }

      if (args[0] === 'rand') {
        const isBase64 = args.includes('-base64');
        const numIdx = args.findIndex(a => /^\d+$/.test(a));
        const byteCount = numIdx !== -1 ? parseInt(args[numIdx], 10) : 16;

        let bytes = '';
        for (let i = 0; i < byteCount; i++) {
          bytes += String.fromCharCode(Math.floor(Math.random() * 256));
        }

        if (isBase64) {
          return { stdout: btoa(bytes), stderr: '', exitCode: 0 };
        }
        let hex = '';
        for (let i = 0; i < bytes.length; i++) {
          hex += bytes.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return { stdout: hex, stderr: '', exitCode: 0 };
      }

      return { stdout: `OpenSSL: '${args[0]}' is an unsupported subcommand in simulator`, stderr: '', exitCode: 1 };
    },
  });

  // --- ssh-keygen ---
  registry.register({
    name: 'ssh-keygen',
    description: 'Authentication key generation, management and conversion',
    usage: 'ssh-keygen [-t rsa|ed25519]',
    flags: [],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      let keyType = 'rsa';
      const tIdx = args.indexOf('-t');
      if (tIdx !== -1 && args[tIdx + 1]) {
        keyType = args[tIdx + 1];
      }

      const home = shellState.env['HOME'] || '/home/user';
      const sshDir = `${home}/.ssh`;
      vfs.createDirectory(sshDir, true, shellState.env['USER'] || 'user');

      const privKeyPath = `${sshDir}/id_${keyType}`;
      const pubKeyPath = `${sshDir}/id_${keyType}.pub`;

      const privKeyContent = `-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlwAAAAdzc2gtcn\nNhAAAAAwEAAQAAAYEA3Xv9x7K9...==\n-----END OPENSSH PRIVATE KEY-----\n`;
      const pubKeyContent = `ssh-${keyType} AAAAB3NzaC1yc2EAAAADAQABAAABgQDde/3... ${shellState.env['USER'] || 'user'}@linux-box\n`;

      vfs.writeFile(privKeyPath, privKeyContent);
      const privNode = vfs.getNode(privKeyPath);
      if (privNode) privNode.permissions = 'rw-------';

      vfs.writeFile(pubKeyPath, pubKeyContent);
      const pubNode = vfs.getNode(pubKeyPath);
      if (pubNode) pubNode.permissions = 'rw-r--r--';

      const randomart = generateRandomart();
      const out = `Generating public/private ${keyType} key pair.
Your identification has been saved in ${privKeyPath}
Your public key has been saved in ${pubKeyPath}
The key fingerprint is:
SHA256:d8a2bf6e901a884efc71b3e9e1... ${shellState.env['USER'] || 'user'}@linux-box
The key's randomart image is:
${randomart}`;

      return { stdout: out, stderr: '', exitCode: 0 };
    },
  });

  // --- ssh-copy-id ---
  registry.register({
    name: 'ssh-copy-id',
    description: 'Use locally available keys to authorise logins on a remote machine',
    usage: 'ssh-copy-id <user>@<host>',
    flags: [],
    handler: (args, _flags, shellState, vfs): CommandResult => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'Usage: ssh-copy-id [-i [identity_file]] [user@]machine', exitCode: 1 };
      }
      const target = args[0];
      const home = shellState.env['HOME'] || '/home/user';
      const pubNode = vfs.getNode(`${home}/.ssh/id_rsa.pub`, true) || vfs.getNode(`${home}/.ssh/id_ed25519.pub`, true);

      if (!pubNode) {
        return {
          stdout: '',
          stderr: '/usr/bin/ssh-copy-id: ERROR: No identities found',
          exitCode: 1,
        };
      }

      return {
        stdout: `/usr/bin/ssh-copy-id: INFO: Source of key(s) to be installed: "${pubNode.name}"
/usr/bin/ssh-copy-id: INFO: attempting to log into '${target}' to add key
Number of key(s) added: 1

Now try logging into the machine, with:   "ssh '${target}'"
and check to make sure that only the key(s) you wanted were added.`,
        stderr: '',
        exitCode: 0,
      };
    },
  });
}
