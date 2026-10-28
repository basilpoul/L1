import { registry } from '../commandRegistry';
import type { CommandResult } from '../../types';

export interface DockerImage {
  repository: string;
  tag: string;
  imageId: string;
  created: string;
  size: string;
}

export interface DockerContainer {
  id: string; // 12-char hex
  name: string;
  image: string;
  command: string;
  created: string;
  status: 'running' | 'exited';
  ports: { hostPort: number; containerPort: number }[];
  env: Record<string, string>;
  logs: string[];
}

export interface DockerState {
  images: DockerImage[];
  containers: DockerContainer[];
}

const DOCKER_STORAGE_KEY = 'linuxsim_docker';

export const IMAGE_CATALOG: DockerImage[] = [
  { repository: 'nginx', tag: 'latest', imageId: 'e784f47281f6', created: '2 weeks ago', size: '142MB' },
  { repository: 'redis', tag: 'alpine', imageId: '70d1396b27d4', created: '3 weeks ago', size: '32.4MB' },
  { repository: 'postgres', tag: '15', imageId: '4b304c8f58d1', created: '1 month ago', size: '379MB' },
  { repository: 'ubuntu', tag: '22.04', imageId: 'a8780b506fa4', created: '2 weeks ago', size: '77.8MB' },
  { repository: 'hello-world', tag: 'latest', imageId: 'd2c94e258dcb', created: '3 months ago', size: '13.3kB' },
  { repository: 'node', tag: '20-alpine', imageId: '8a2b53f6190c', created: '1 week ago', size: '174MB' },
];

const DEFAULT_DOCKER_STATE: DockerState = {
  images: [
    { repository: 'nginx', tag: 'latest', imageId: 'e784f47281f6', created: '2 weeks ago', size: '142MB' },
    { repository: 'ubuntu', tag: '22.04', imageId: 'a8780b506fa4', created: '2 weeks ago', size: '77.8MB' },
  ],
  containers: [],
};

export function getDockerState(): DockerState {
  try {
    const raw = localStorage.getItem(DOCKER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        images: parsed.images || DEFAULT_DOCKER_STATE.images,
        containers: parsed.containers || [],
      };
    }
  } catch (e) {
    console.error('Failed to load docker state', e);
  }
  return DEFAULT_DOCKER_STATE;
}

export function saveDockerState(state: DockerState) {
  try {
    localStorage.setItem(DOCKER_STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save docker state', e);
  }
}

function genHex(length: number): string {
  let res = '';
  while (res.length < length) {
    res += Math.random().toString(16).substring(2);
  }
  return res.substring(0, length);
}

const ADJECTIVES = ['brave', 'clever', 'tender', 'keen', 'practical', 'vigorous', 'zen', 'zenith'];
const NAMES = ['torvalds', 'hopper', 'lovelace', 'ritchie', 'thompson', 'turing', 'knuth', 'stallman'];

function randomContainerName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  return `${adj}_${name}`;
}

export function registerDockerCommands() {
  registry.register({
    name: 'docker',
    description: 'A self-sufficient runtime for containers',
    usage: 'docker <command> [args]',
    flags: [],
    handler: (args): CommandResult => {
      if (args.length === 0) {
        return {
          stdout: `Usage:  docker [OPTIONS] COMMAND

A self-sufficient runtime for containers

Common Commands:
  run         Create and run a new container from an image
  exec        Execute a command in a running container
  ps          List containers
  images      List images
  pull        Download an image from a registry
  rmi         Remove one or more images
  stop        Stop one or more running containers
  start       Start one or more stopped containers
  restart     Restart one or more containers
  rm          Remove one or more containers
  logs        Fetch the logs of a container`,
          stderr: '',
          exitCode: 0,
        };
      }

      const subcommand = args[0];
      const subArgs = args.slice(1);
      const state = getDockerState();

      // --- docker images ---
      if (subcommand === 'images') {
        let out = 'REPOSITORY          TAG       IMAGE ID       CREATED        SIZE\n';
        for (const img of state.images) {
          out += `${img.repository.padEnd(20)}${img.tag.padEnd(10)}${img.imageId.padEnd(15)}${img.created.padEnd(15)}${img.size}\n`;
        }
        return { stdout: out.trimEnd(), stderr: '', exitCode: 0 };
      }

      // --- docker pull ---
      if (subcommand === 'pull') {
        const target = subArgs[0];
        if (!target) return { stdout: '', stderr: 'docker pull requires an image name', exitCode: 1 };

        const [repo, tag = 'latest'] = target.split(':');
        const found = IMAGE_CATALOG.find(i => i.repository === repo && i.tag === tag);

        if (!found) {
          return {
            stdout: '',
            stderr: `Error response from daemon: pull access denied for ${target}, repository does not exist or may require 'docker login'`,
            exitCode: 1,
          };
        }

        // Add to images if not present
        if (!state.images.some(i => i.repository === repo && i.tag === tag)) {
          state.images.push(found);
          saveDockerState(state);
        }

        const out = `${tag}: Pulling from library/${repo}
7125e4df90e9: Pull complete
Digest: sha256:${genHex(32)}
Status: Downloaded newer image for ${repo}:${tag}
docker.io/library/${repo}:${tag}`;
        return { stdout: out, stderr: '', exitCode: 0 };
      }

      // --- docker rmi ---
      if (subcommand === 'rmi') {
        const target = subArgs[0];
        if (!target) return { stdout: '', stderr: 'docker rmi requires an image name or ID', exitCode: 1 };

        const [repo, tag] = target.split(':');
        const initCount = state.images.length;
        state.images = state.images.filter(img => {
          if (img.imageId.startsWith(target)) return false;
          if (tag) return !(img.repository === repo && img.tag === tag);
          return img.repository !== repo;
        });

        if (state.images.length === initCount) {
          return { stdout: '', stderr: `Error: No such image: ${target}`, exitCode: 1 };
        }

        saveDockerState(state);
        return { stdout: `Untagged: ${target}\nDeleted: sha256:${genHex(32)}`, stderr: '', exitCode: 0 };
      }

      // --- docker run ---
      if (subcommand === 'run') {
        let isDetached = false;
        let containerName = '';
        const ports: { hostPort: number; containerPort: number }[] = [];
        const envVars: Record<string, string> = {};
        let imageArg = '';
        const commandArgs: string[] = [];

        for (let i = 0; i < subArgs.length; i++) {
          const arg = subArgs[i];
          if (arg === '-d' || arg === '--detach') {
            isDetached = true;
          } else if (arg === '-p' || arg === '--publish') {
            const p = subArgs[++i];
            if (p) {
              const [h, c] = p.split(':').map(Number);
              if (!isNaN(h) && !isNaN(c)) {
                ports.push({ hostPort: h, containerPort: c });
              }
            }
          } else if (arg === '--name') {
            containerName = subArgs[++i] || '';
          } else if (arg.startsWith('--name=')) {
            containerName = arg.slice(7);
          } else if (arg === '-e' || arg === '--env') {
            const e = subArgs[++i];
            if (e && e.includes('=')) {
              const [k, v] = e.split('=');
              envVars[k] = v;
            }
          } else if (!imageArg && !arg.startsWith('-')) {
            imageArg = arg;
          } else if (imageArg) {
            commandArgs.push(arg);
          }
        }

        if (!imageArg) {
          return { stdout: '', stderr: 'docker run requires at least 1 image argument', exitCode: 1 };
        }

        const [repo, tag = 'latest'] = imageArg.split(':');
        const img = state.images.find(i => i.repository === repo && (tag ? i.tag === tag : true))
          || IMAGE_CATALOG.find(i => i.repository === repo && (tag ? i.tag === tag : true));

        if (!img) {
          return {
            stdout: '',
            stderr: `Unable to find image '${imageArg}' locally\ndocker: Error response from daemon: repository ${repo} not found`,
            exitCode: 125,
          };
        }

        // Auto-pull image if missing from local state
        if (!state.images.some(i => i.repository === img.repository && i.tag === img.tag)) {
          state.images.push(img);
        }

        const containerId = genHex(12);
        const name = containerName || randomContainerName();

        let defaultCmd = 'sh';
        let defaultLogs: string[] = [];
        let isExitedImmediately = false;

        if (img.repository === 'nginx') {
          defaultCmd = '/docker-entrypoint.sh nginx -g "daemon off;"';
          defaultLogs = [
            '/docker-entrypoint.sh: /docker-entrypoint.d/ is not empty, will attempt to perform configuration',
            '/docker-entrypoint.sh: Configuration complete; ready for start up',
            `2026/10/28 12:00:00 [notice] 1#1: using the "epoll" event method`,
            `2026/10/28 12:00:00 [notice] 1#1: nginx/1.25.3`,
            `2026/10/28 12:00:00 [notice] 1#1: built by gcc 12.2.0 (Debian 12.2.0-14)`,
            `2026/10/28 12:00:00 [notice] 1#1: start worker processes`,
          ];
        } else if (img.repository === 'redis') {
          defaultCmd = 'docker-entrypoint.sh redis-server';
          defaultLogs = [
            '1:M 28 Oct 2026 12:00:00.000 * Running mode=standalone, port=6379.',
            '1:M 28 Oct 2026 12:00:00.001 # Server initialized',
            '1:M 28 Oct 2026 12:00:00.002 * Ready to accept connections tcp',
          ];
        } else if (img.repository === 'postgres') {
          defaultCmd = 'docker-entrypoint.sh postgres';
          defaultLogs = [
            'PostgreSQL database server initialized.',
            '2026-10-28 12:00:00 UTC [1] LOG:  starting PostgreSQL 15.4',
            '2026-10-28 12:00:00 UTC [1] LOG:  listening on IPv4 address "0.0.0.0", port 5432',
          ];
        } else if (img.repository === 'hello-world') {
          defaultCmd = '/hello';
          defaultLogs = [
            'Hello from Docker!',
            'This message shows that your installation appears to be working correctly.',
            '',
            'To generate this message, Docker took the following steps:',
            ' 1. The Docker client contacted the Docker daemon.',
            ' 2. The Docker daemon pulled the "hello-world" image from Docker Hub.',
            ' 3. The Docker daemon created a new container from that image which runs the executable that outputs the text you are currently reading.',
            ' 4. The Docker daemon streamed that output to the Docker client, which sent it to your terminal.',
          ];
          isExitedImmediately = true;
        } else if (img.repository === 'node') {
          defaultCmd = 'node server.js';
          defaultLogs = [
            '> webapp@1.0.0 start',
            '> node server.js',
            'Server running and listening on port 8080',
          ];
        } else {
          defaultCmd = '/bin/bash';
          defaultLogs = [`[container ${containerId} started]`];
        }

        const newContainer: DockerContainer = {
          id: containerId,
          name,
          image: `${img.repository}:${img.tag}`,
          command: commandArgs.length > 0 ? commandArgs.join(' ') : defaultCmd,
          created: 'Just now',
          status: isExitedImmediately ? 'exited' : 'running',
          ports,
          env: envVars,
          logs: defaultLogs,
        };

        state.containers.unshift(newContainer);
        saveDockerState(state);

        if (isDetached) {
          return { stdout: containerId, stderr: '', exitCode: 0 };
        } else {
          return { stdout: defaultLogs.join('\n'), stderr: '', exitCode: 0 };
        }
      }

      // --- docker ps ---
      if (subcommand === 'ps') {
        const showAll = subArgs.includes('-a') || subArgs.includes('--all');
        const list = showAll ? state.containers : state.containers.filter(c => c.status === 'running');

        let out = 'CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS         PORTS                  NAMES\n';
        for (const c of list) {
          const portsStr = c.ports.map(p => `0.0.0.0:${p.hostPort}->${p.containerPort}/tcp`).join(', ') || '';
          const statusStr = c.status === 'running' ? 'Up 2 minutes' : 'Exited (0) 5 minutes ago';
          const cmdStr = `"${c.command.slice(0, 20)}"`;

          out += `${c.id.padEnd(15)}${c.image.padEnd(15)}${cmdStr.padEnd(25)}${c.created.padEnd(16)}${statusStr.padEnd(15)}${portsStr.padEnd(23)}${c.name}\n`;
        }
        return { stdout: out.trimEnd(), stderr: '', exitCode: 0 };
      }

      // --- docker stop ---
      if (subcommand === 'stop') {
        const target = subArgs[0];
        if (!target) return { stdout: '', stderr: 'docker stop requires at least 1 argument', exitCode: 1 };

        const c = state.containers.find(cnt => cnt.name === target || cnt.id.startsWith(target));
        if (!c) return { stdout: '', stderr: `Error response from daemon: No such container: ${target}`, exitCode: 1 };

        c.status = 'exited';
        saveDockerState(state);
        return { stdout: c.name, stderr: '', exitCode: 0 };
      }

      // --- docker start ---
      if (subcommand === 'start') {
        const target = subArgs[0];
        if (!target) return { stdout: '', stderr: 'docker start requires at least 1 argument', exitCode: 1 };

        const c = state.containers.find(cnt => cnt.name === target || cnt.id.startsWith(target));
        if (!c) return { stdout: '', stderr: `Error response from daemon: No such container: ${target}`, exitCode: 1 };

        c.status = 'running';
        saveDockerState(state);
        return { stdout: c.name, stderr: '', exitCode: 0 };
      }

      // --- docker restart ---
      if (subcommand === 'restart') {
        const target = subArgs[0];
        if (!target) return { stdout: '', stderr: 'docker restart requires at least 1 argument', exitCode: 1 };

        const c = state.containers.find(cnt => cnt.name === target || cnt.id.startsWith(target));
        if (!c) return { stdout: '', stderr: `Error response from daemon: No such container: ${target}`, exitCode: 1 };

        c.status = 'running';
        saveDockerState(state);
        return { stdout: c.name, stderr: '', exitCode: 0 };
      }

      // --- docker rm ---
      if (subcommand === 'rm') {
        const force = subArgs.includes('-f') || subArgs.includes('--force');
        const target = subArgs.filter(a => !a.startsWith('-'))[0];
        if (!target) return { stdout: '', stderr: 'docker rm requires at least 1 container argument', exitCode: 1 };

        const c = state.containers.find(cnt => cnt.name === target || cnt.id.startsWith(target));
        if (!c) return { stdout: '', stderr: `Error response from daemon: No such container: ${target}`, exitCode: 1 };

        if (c.status === 'running' && !force) {
          return {
            stdout: '',
            stderr: `Error response from daemon: You cannot remove a running container ${c.id}. Stop the container before attempting removal or force remove`,
            exitCode: 1,
          };
        }

        state.containers = state.containers.filter(cnt => cnt !== c);
        saveDockerState(state);
        return { stdout: c.name, stderr: '', exitCode: 0 };
      }

      // --- docker logs ---
      if (subcommand === 'logs') {
        const target = subArgs[0];
        if (!target) return { stdout: '', stderr: 'docker logs requires at least 1 container argument', exitCode: 1 };

        const c = state.containers.find(cnt => cnt.name === target || cnt.id.startsWith(target));
        if (!c) return { stdout: '', stderr: `Error response from daemon: No such container: ${target}`, exitCode: 1 };

        return { stdout: c.logs.join('\n'), stderr: '', exitCode: 0 };
      }

      // --- docker exec ---
      if (subcommand === 'exec') {
        if (subArgs.length < 2) {
          return { stdout: '', stderr: 'docker exec requires container and command', exitCode: 1 };
        }
        const target = subArgs[0];
        const cmd = subArgs.slice(1).join(' ');

        const c = state.containers.find(cnt => cnt.name === target || cnt.id.startsWith(target));
        if (!c) return { stdout: '', stderr: `Error: No such container: ${target}`, exitCode: 1 };
        if (c.status !== 'running') {
          return { stdout: '', stderr: `Error response from daemon: Container ${c.id} is not running`, exitCode: 1 };
        }

        if (cmd === 'uname -a') {
          return {
            stdout: `Linux ${c.name} 6.5.0-generic #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`,
            stderr: '',
            exitCode: 0,
          };
        }
        if (cmd.includes('ls /usr/share/nginx/html')) {
          return { stdout: '50x.html  index.html', stderr: '', exitCode: 0 };
        }
        if (cmd.includes('node -v')) {
          return { stdout: 'v20.11.0', stderr: '', exitCode: 0 };
        }
        if (cmd.includes('python3 --version')) {
          return { stdout: 'Python 3.10.12', stderr: '', exitCode: 0 };
        }

        return {
          stdout: `[${c.name}]: Executed '${cmd}' successfully`,
          stderr: '',
          exitCode: 0,
        };
      }

      return {
        stdout: '',
        stderr: `docker: '${subcommand}' is not a docker command. See 'docker --help'`,
        exitCode: 1,
      };
    },
  });
}
