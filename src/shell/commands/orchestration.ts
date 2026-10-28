import { registry } from '../commandRegistry';
import type {
  CommandResult,
  ShellState,
  K8sClusterState,
  K8sDeployment,
  K8sService,
} from '../../types';
import { resolvePath } from '../../vfs/pathResolver';
import { getDockerState, saveDockerState, type DockerContainer } from './docker';

const K8S_STORAGE_KEY = 'linuxsim_k8s';

export const DEFAULT_K8S_STATE: K8sClusterState = {
  nodes: [
    {
      name: 'linux-box-control-plane',
      status: 'Ready',
      roles: 'control-plane',
      age: '5d',
      version: 'v1.30.0',
      internalIP: '10.0.0.2',
    },
  ],
  namespaces: ['default', 'kube-system', 'kube-public', 'kube-node-lease'],
  deployments: [],
  pods: [],
  services: [
    {
      name: 'kubernetes',
      namespace: 'default',
      type: 'ClusterIP',
      clusterIP: '10.96.0.1',
      externalIP: '<none>',
      ports: '443/TCP',
      age: '5d',
      selector: {},
    },
  ],
};

export function getK8sState(): K8sClusterState {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(K8S_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          nodes: parsed.nodes || DEFAULT_K8S_STATE.nodes,
          namespaces: parsed.namespaces || DEFAULT_K8S_STATE.namespaces,
          deployments: parsed.deployments || [],
          pods: parsed.pods || [],
          services: parsed.services || DEFAULT_K8S_STATE.services,
        };
      }
    }
  } catch (e) {
    console.error('Failed to load k8s state', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_K8S_STATE));
}

export function saveK8sState(state: K8sClusterState) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(K8S_STORAGE_KEY, JSON.stringify(state));
    }
  } catch (e) {
    console.error('Failed to save k8s state', e);
  }
}

function resolve(filepath: string, shellState: ShellState): string {
  return resolvePath(filepath, shellState.cwd, shellState.env['HOME'] || '/home/user');
}

function genRandomId(length: number): string {
  const chars = 'bcdfghjklmnpqrstvwxyz0123456789';
  let res = '';
  for (let i = 0; i < length; i++) {
    res += chars[Math.floor(Math.random() * chars.length)];
  }
  return res;
}

/**
 * Simple lightweight YAML parser for K8s manifests & docker-compose
 */
function parseSimpleYaml(content: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = content.split('\n');

  let currentSection = '';
  let subSection = '';

  for (let rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line || line.trim().startsWith('#')) continue;

    const indent = rawLine.length - rawLine.trimStart().length;
    const trimmed = line.trim();

    if (indent === 0 && trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      currentSection = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      subSection = '';
      result[currentSection] = val ? val.replace(/['"]/g, '') : {};
    } else if (indent === 2 && currentSection && trimmed.includes(':')) {
      const idx = trimmed.indexOf(':');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      subSection = key;
      if (typeof result[currentSection] !== 'object') {
        result[currentSection] = {};
      }
      result[currentSection][key] = val ? val.replace(/['"]/g, '') : {};
    } else if (indent >= 4 && currentSection) {
      if (trimmed.startsWith('-') && trimmed.includes(':')) {
        const itemStr = trimmed.substring(1).trim();
        const idx = itemStr.indexOf(':');
        const k = itemStr.substring(0, idx).trim();
        const v = itemStr.substring(idx + 1).trim().replace(/['"]/g, '');
        if (subSection && typeof result[currentSection][subSection] === 'object') {
          if (!Array.isArray(result[currentSection][subSection])) {
            result[currentSection][subSection] = [];
          }
          result[currentSection][subSection].push({ [k]: v });
        }
      } else if (trimmed.includes(':')) {
        const idx = trimmed.indexOf(':');
        const k = trimmed.substring(0, idx).trim();
        const v = trimmed.substring(idx + 1).trim().replace(/['"]/g, '');
        if (subSection && typeof result[currentSection][subSection] === 'object') {
          result[currentSection][subSection][k] = v;
        }
      }
    }
  }

  return result;
}

export function registerOrchestrationCommands() {
  // ==================== KUBECTL ====================
  registry.register({
    name: 'kubectl',
    description: 'Kubernetes command-line tool for controlling clusters',
    usage: 'kubectl [command] [type] [name] [flags]',
    flags: [
      { flag: '-n', description: 'Namespace' },
      { flag: '-o', description: 'Output format (e.g. wide, yaml, json)' },
      { flag: '-f', description: 'Filename or URL to files for resource spec' },
      { flag: '--replicas', description: 'Number of replicas for deployment' },
      { flag: '--all-namespaces', description: 'If present, list resources across all namespaces' },
    ],
    handler: (args, flags, shellState, vfs): CommandResult => {
      const state = getK8sState();
      const subcommand = args[0];

      if (!subcommand || subcommand === 'help') {
        const lines = [
          'kubectl controls the Kubernetes cluster manager.',
          '',
          'Basic Commands (Beginner):',
          '  create         Create a resource from a file or from stdin',
          '  apply          Apply a configuration to a resource by file name',
          '',
          'Basic Commands (Intermediate):',
          '  get            Display one or many resources (nodes, pods, deployments, svc)',
          '  describe       Show detailed state of one or more resources',
          '  logs           Print the logs for a container in a pod',
          '',
          'Deploy Commands:',
          '  scale          Set a new size for a Deployment',
          '',
          'Cluster Management Commands:',
          '  delete         Delete resources by file names, stdin, resources and names',
          '',
          'Use "kubectl <command> --help" for more information about a given command.',
        ];
        return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
      }

      // ---------- kubectl get ----------
      if (subcommand === 'get') {
        const resourceType = args[1]?.toLowerCase();
        if (!resourceType) {
          return {
            stdout: '',
            stderr: 'error: You must specify the type of resource to get. Try "kubectl get --help".',
            exitCode: 1,
          };
        }

        const isWide = flags['o'] === 'wide';
        const targetName = args[2];

        // nodes
        if (resourceType === 'nodes' || resourceType === 'node' || resourceType === 'no') {
          if (isWide) {
            const header = 'NAME                      STATUS   ROLES           AGE   VERSION   INTERNAL-IP   OS-IMAGE                KERNEL-VERSION   CONTAINER-RUNTIME';
            const rows = state.nodes.map(
              (n) => `${n.name.padEnd(25)} ${n.status.padEnd(8)} ${n.roles.padEnd(15)} ${n.age.padEnd(5)} ${n.version.padEnd(9)} ${n.internalIP.padEnd(13)} LinuxSim OS 24.04 LTS   6.5.0-sim        containerd://1.7.12`
            );
            return { stdout: [header, ...rows].join('\n'), stderr: '', exitCode: 0 };
          }
          const header = 'NAME                      STATUS   ROLES           AGE   VERSION';
          const rows = state.nodes.map(
            (n) => `${n.name.padEnd(25)} ${n.status.padEnd(8)} ${n.roles.padEnd(15)} ${n.age.padEnd(5)} ${n.version}`
          );
          return { stdout: [header, ...rows].join('\n'), stderr: '', exitCode: 0 };
        }

        // pods
        if (resourceType === 'pods' || resourceType === 'pod' || resourceType === 'po') {
          let pods = state.pods;
          if (targetName) {
            pods = pods.filter((p) => p.name === targetName);
            if (pods.length === 0) {
              return { stdout: '', stderr: `Error from server (NotFound): pods "${targetName}" not found`, exitCode: 1 };
            }
          }
          if (pods.length === 0) {
            return { stdout: 'No resources found in default namespace.', stderr: '', exitCode: 0 };
          }

          if (isWide) {
            const header = 'NAME                               READY   STATUS    RESTARTS   AGE     IP            NODE                      NOMINATED NODE   READINESS GATES';
            const rows = pods.map((p) =>
              `${p.name.padEnd(34)} ${p.ready.padEnd(7)} ${p.status.padEnd(9)} ${String(p.restarts).padEnd(10)} ${p.age.padEnd(7)} ${p.ip.padEnd(13)} ${p.node.padEnd(25)} <none>           <none>`
            );
            return { stdout: [header, ...rows].join('\n'), stderr: '', exitCode: 0 };
          }

          const header = 'NAME                               READY   STATUS    RESTARTS   AGE';
          const rows = pods.map((p) =>
            `${p.name.padEnd(34)} ${p.ready.padEnd(7)} ${p.status.padEnd(9)} ${String(p.restarts).padEnd(10)} ${p.age}`
          );
          return { stdout: [header, ...rows].join('\n'), stderr: '', exitCode: 0 };
        }

        // deployments
        if (resourceType === 'deployments' || resourceType === 'deployment' || resourceType === 'deploy') {
          let deploys = state.deployments;
          if (targetName) {
            deploys = deploys.filter((d) => d.name === targetName);
            if (deploys.length === 0) {
              return { stdout: '', stderr: `Error from server (NotFound): deployments.apps "${targetName}" not found`, exitCode: 1 };
            }
          }
          if (deploys.length === 0) {
            return { stdout: 'No resources found in default namespace.', stderr: '', exitCode: 0 };
          }

          if (isWide) {
            const header = 'NAME      READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS   IMAGES         SELECTOR';
            const rows = deploys.map((d) =>
              `${d.name.padEnd(9)} ${d.ready.padEnd(7)} ${String(d.upToDate).padEnd(12)} ${String(d.available).padEnd(11)} ${d.age.padEnd(5)} ${d.name.padEnd(12)} ${d.image.padEnd(14)} app=${d.name}`
            );
            return { stdout: [header, ...rows].join('\n'), stderr: '', exitCode: 0 };
          }

          const header = 'NAME      READY   UP-TO-DATE   AVAILABLE   AGE';
          const rows = deploys.map((d) =>
            `${d.name.padEnd(9)} ${d.ready.padEnd(7)} ${String(d.upToDate).padEnd(12)} ${String(d.available).padEnd(11)} ${d.age}`
          );
          return { stdout: [header, ...rows].join('\n'), stderr: '', exitCode: 0 };
        }

        // services
        if (resourceType === 'services' || resourceType === 'service' || resourceType === 'svc') {
          let svcs = state.services;
          if (targetName) {
            svcs = svcs.filter((s) => s.name === targetName);
            if (svcs.length === 0) {
              return { stdout: '', stderr: `Error from server (NotFound): services "${targetName}" not found`, exitCode: 1 };
            }
          }

          const header = 'NAME             TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE';
          const rows = svcs.map((s) =>
            `${s.name.padEnd(16)} ${s.type.padEnd(11)} ${s.clusterIP.padEnd(15)} ${s.externalIP.padEnd(13)} ${s.ports.padEnd(16)} ${s.age}`
          );
          return { stdout: [header, ...rows].join('\n'), stderr: '', exitCode: 0 };
        }

        // all
        if (resourceType === 'all') {
          const sections: string[] = [];

          // Pods
          if (state.pods.length > 0) {
            sections.push('NAME                               READY   STATUS    RESTARTS   AGE');
            for (const p of state.pods) {
              sections.push(`pod/${p.name.padEnd(30)} ${p.ready.padEnd(7)} ${p.status.padEnd(9)} ${String(p.restarts).padEnd(10)} ${p.age}`);
            }
            sections.push('');
          }

          // Services
          sections.push('NAME                 TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE');
          for (const s of state.services) {
            sections.push(`service/${s.name.padEnd(11)} ${s.type.padEnd(11)} ${s.clusterIP.padEnd(15)} ${s.externalIP.padEnd(13)} ${s.ports.padEnd(16)} ${s.age}`);
          }
          sections.push('');

          // Deployments
          if (state.deployments.length > 0) {
            sections.push('NAME                     READY   UP-TO-DATE   AVAILABLE   AGE');
            for (const d of state.deployments) {
              sections.push(`deployment.apps/${d.name.padEnd(8)} ${d.ready.padEnd(7)} ${String(d.upToDate).padEnd(12)} ${String(d.available).padEnd(11)} ${d.age}`);
            }
          }

          return { stdout: sections.join('\n'), stderr: '', exitCode: 0 };
        }

        return { stdout: '', stderr: `error: the server doesn't have a resource type "${resourceType}"`, exitCode: 1 };
      }

      // ---------- kubectl apply -f ----------
      if (subcommand === 'apply') {
        const fileArg = typeof flags['f'] === 'string' ? flags['f'] : args[1] === '-f' ? args[2] : null;
        if (!fileArg) {
          return { stdout: '', stderr: 'error: must specify one of -f and -k', exitCode: 1 };
        }

        const fullPath = resolve(fileArg, shellState);
        const node = vfs.getNode(fullPath, true);
        if (!node || !node.content) {
          return { stdout: '', stderr: `error: the path "${fileArg}" cannot be accessed: No such file or directory`, exitCode: 1 };
        }

        const outputs: string[] = [];
        const rawDocs = node.content.split(/^---$/m);

        for (const doc of rawDocs) {
          const trimmedDoc = doc.trim();
          if (!trimmedDoc) continue;

          // Simple regex/parsing of Kubernetes YAML
          const kindMatch = trimmedDoc.match(/kind:\s*([A-Za-z0-9]+)/i);
          const nameMatch = trimmedDoc.match(/metadata:\s*(?:[\r\n]+\s+name:\s*([A-Za-z0-9_-]+))/i) || trimmedDoc.match(/name:\s*([A-Za-z0-9_-]+)/i);
          const replicasMatch = trimmedDoc.match(/replicas:\s*(\d+)/i);
          const imageMatch = trimmedDoc.match(/image:\s*([A-Za-z0-9_:./-]+)/i);
          const portMatch = trimmedDoc.match(/port:\s*(\d+)/i);
          const nodePortMatch = trimmedDoc.match(/nodePort:\s*(\d+)/i);

          const kind = kindMatch ? kindMatch[1] : 'Deployment';
          const name = nameMatch ? nameMatch[1] : 'app';

          if (kind.toLowerCase() === 'deployment') {
            const replicas = replicasMatch ? parseInt(replicasMatch[1], 10) : 2;
            const image = imageMatch ? imageMatch[1] : 'nginx:latest';

            const existingIdx = state.deployments.findIndex((d) => d.name === name);
            const deployObj: K8sDeployment = {
              name,
              namespace: 'default',
              ready: `${replicas}/${replicas}`,
              upToDate: replicas,
              available: replicas,
              age: '10s',
              image,
              replicas,
            };

            if (existingIdx !== -1) {
              state.deployments[existingIdx] = deployObj;
              outputs.push(`deployment.apps/${name} configured`);
            } else {
              state.deployments.push(deployObj);
              outputs.push(`deployment.apps/${name} created`);
            }

            // Sync pods
            state.pods = state.pods.filter((p) => p.deployment !== name);
            const hash = genRandomId(5);
            for (let i = 0; i < replicas; i++) {
              const podSuffix = genRandomId(5);
              const podName = `${name}-${hash}-${podSuffix}`;
              state.pods.push({
                name: podName,
                namespace: 'default',
                ready: '1/1',
                status: 'Running',
                restarts: 0,
                age: '10s',
                ip: `10.244.0.${10 + i}`,
                node: 'linux-box-control-plane',
                deployment: name,
                image,
              });
            }
          } else if (kind.toLowerCase() === 'service') {
            const port = portMatch ? portMatch[1] : '80';
            const nodePort = nodePortMatch ? nodePortMatch[1] : '30080';
            const svcTypeMatch = trimmedDoc.match(/type:\s*([A-Za-z]+)/i);
            const svcType = (svcTypeMatch ? svcTypeMatch[1] : 'NodePort') as any;

            const existingIdx = state.services.findIndex((s) => s.name === name);
            const svcObj: K8sService = {
              name,
              namespace: 'default',
              type: svcType,
              clusterIP: `10.96.142.${Math.floor(Math.random() * 200 + 10)}`,
              externalIP: '<none>',
              ports: `${port}:${nodePort}/TCP`,
              age: '10s',
              selector: { app: name },
            };

            if (existingIdx !== -1) {
              state.services[existingIdx] = svcObj;
              outputs.push(`service/${name} configured`);
            } else {
              state.services.push(svcObj);
              outputs.push(`service/${name} created`);
            }
          } else if (kind.toLowerCase() === 'pod') {
            const image = imageMatch ? imageMatch[1] : 'nginx:latest';
            state.pods.push({
              name,
              namespace: 'default',
              ready: '1/1',
              status: 'Running',
              restarts: 0,
              age: '10s',
              ip: `10.244.0.${Math.floor(Math.random() * 200 + 20)}`,
              node: 'linux-box-control-plane',
              image,
            });
            outputs.push(`pod/${name} created`);
          }
        }

        saveK8sState(state);
        return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
      }

      // ---------- kubectl scale ----------
      if (subcommand === 'scale') {
        const resourceType = args[1]?.toLowerCase();
        const targetName = args[2];
        const replicaArg = typeof flags['replicas'] === 'string'
          ? flags['replicas']
          : args.find((a) => a.startsWith('--replicas='))?.split('=')[1];

        if (resourceType !== 'deployment' && resourceType !== 'deploy') {
          return { stdout: '', stderr: 'error: only deployments can be scaled in this cluster', exitCode: 1 };
        }
        if (!targetName || !replicaArg) {
          return { stdout: '', stderr: 'error: Must specify deployment name and --replicas=<count>', exitCode: 1 };
        }

        const count = parseInt(replicaArg, 10);
        if (isNaN(count) || count < 0) {
          return { stdout: '', stderr: `error: invalid replicas count "${replicaArg}"`, exitCode: 1 };
        }

        const deploy = state.deployments.find((d) => d.name === targetName);
        if (!deploy) {
          return { stdout: '', stderr: `Error from server (NotFound): deployments.apps "${targetName}" not found`, exitCode: 1 };
        }

        deploy.replicas = count;
        deploy.ready = `${count}/${count}`;
        deploy.available = count;
        deploy.upToDate = count;

        const currentPods = state.pods.filter((p) => p.deployment === targetName);
        if (currentPods.length < count) {
          // Add pods
          const diff = count - currentPods.length;
          const hash = genRandomId(5);
          for (let i = 0; i < diff; i++) {
            state.pods.push({
              name: `${targetName}-${hash}-${genRandomId(5)}`,
              namespace: 'default',
              ready: '1/1',
              status: 'Running',
              restarts: 0,
              age: '1s',
              ip: `10.244.0.${20 + currentPods.length + i}`,
              node: 'linux-box-control-plane',
              deployment: targetName,
              image: deploy.image,
            });
          }
        } else if (currentPods.length > count) {
          // Terminate excess pods
          const toRemove = currentPods.length - count;
          let removed = 0;
          state.pods = state.pods.filter((p) => {
            if (p.deployment === targetName && removed < toRemove) {
              removed++;
              return false;
            }
            return true;
          });
        }

        saveK8sState(state);
        return { stdout: `deployment.apps/${targetName} scaled`, stderr: '', exitCode: 0 };
      }

      // ---------- kubectl delete ----------
      if (subcommand === 'delete') {
        const resourceType = args[1]?.toLowerCase();
        const targetName = args[2];

        if (!resourceType || !targetName) {
          return { stdout: '', stderr: 'error: resource type and name required', exitCode: 1 };
        }

        if (resourceType === 'pod' || resourceType === 'po' || resourceType === 'pods') {
          const podIdx = state.pods.findIndex((p) => p.name === targetName);
          if (podIdx === -1) {
            return { stdout: '', stderr: `Error from server (NotFound): pods "${targetName}" not found`, exitCode: 1 };
          }

          const pod = state.pods[podIdx];
          const deploymentName = pod.deployment;

          // Remove the pod
          state.pods.splice(podIdx, 1);

          // Self-healing: if pod belongs to a deployment, spawn a replacement pod!
          if (deploymentName) {
            const hash = genRandomId(5);
            const newPodName = `${deploymentName}-${hash}-${genRandomId(5)}`;
            const deploy = state.deployments.find((d) => d.name === deploymentName);
            state.pods.push({
              name: newPodName,
              namespace: 'default',
              ready: '1/1',
              status: 'Running',
              restarts: 0,
              age: '1s',
              ip: `10.244.0.${Math.floor(Math.random() * 200 + 30)}`,
              node: 'linux-box-control-plane',
              deployment: deploymentName,
              image: deploy?.image || 'nginx:latest',
            });
          }

          saveK8sState(state);
          return { stdout: `pod "${targetName}" deleted`, stderr: '', exitCode: 0 };
        }

        if (resourceType === 'deployment' || resourceType === 'deploy') {
          const deployIdx = state.deployments.findIndex((d) => d.name === targetName);
          if (deployIdx === -1) {
            return { stdout: '', stderr: `Error from server (NotFound): deployments.apps "${targetName}" not found`, exitCode: 1 };
          }
          state.deployments.splice(deployIdx, 1);
          state.pods = state.pods.filter((p) => p.deployment !== targetName);
          saveK8sState(state);
          return { stdout: `deployment.apps "${targetName}" deleted`, stderr: '', exitCode: 0 };
        }

        if (resourceType === 'service' || resourceType === 'svc') {
          const svcIdx = state.services.findIndex((s) => s.name === targetName);
          if (svcIdx === -1) {
            return { stdout: '', stderr: `Error from server (NotFound): services "${targetName}" not found`, exitCode: 1 };
          }
          state.services.splice(svcIdx, 1);
          saveK8sState(state);
          return { stdout: `service "${targetName}" deleted`, stderr: '', exitCode: 0 };
        }

        return { stdout: '', stderr: `error: cannot delete resource type "${resourceType}"`, exitCode: 1 };
      }

      // ---------- kubectl describe ----------
      if (subcommand === 'describe') {
        const resourceType = args[1]?.toLowerCase();
        const targetName = args[2];

        if (!resourceType || !targetName) {
          return { stdout: '', stderr: 'error: describe requires type and name', exitCode: 1 };
        }

        if (resourceType === 'node' || resourceType === 'nodes') {
          const nodeObj = state.nodes.find((n) => n.name === targetName);
          if (!nodeObj) {
            return { stdout: '', stderr: `Error from server (NotFound): nodes "${targetName}" not found`, exitCode: 1 };
          }

          const desc = [
            `Name:               ${nodeObj.name}`,
            `Roles:              ${nodeObj.roles}`,
            'Labels:             beta.kubernetes.io/arch=amd64',
            '                    beta.kubernetes.io/os=linux',
            '                    kubernetes.io/hostname=linux-box-control-plane',
            '                    node-role.kubernetes.io/control-plane=',
            'Status:             Ready',
            'Addresses:',
            `  InternalIP:       ${nodeObj.internalIP}`,
            '  Hostname:         linux-box-control-plane',
            'Capacity:',
            '  cpu:              4',
            '  ephemeral-storage: 49263072Ki',
            '  memory:           8167428Ki',
            '  pods:             110',
            'System Info:',
            '  Machine ID:       sim-69a4-2026',
            '  Kernel Version:   6.5.0-sim',
            '  OS Image:         LinuxSim OS 24.04 LTS',
            '  Container Runtime: containerd://1.7.12',
            `  Kubelet Version:  ${nodeObj.version}`,
            'Events:             <none>',
          ];
          return { stdout: desc.join('\n'), stderr: '', exitCode: 0 };
        }

        if (resourceType === 'pod' || resourceType === 'pods' || resourceType === 'po') {
          const podObj = state.pods.find((p) => p.name === targetName);
          if (!podObj) {
            return { stdout: '', stderr: `Error from server (NotFound): pods "${targetName}" not found`, exitCode: 1 };
          }

          const desc = [
            `Name:             ${podObj.name}`,
            `Namespace:        ${podObj.namespace}`,
            `Priority:         0`,
            `Service Account:  default`,
            `Node:             ${podObj.node}/${podObj.ip}`,
            `Status:           ${podObj.status}`,
            `IP:               ${podObj.ip}`,
            `Containers:`,
            `  app:`,
            `    Container ID:   containerd://sim-${genRandomId(12)}`,
            `    Image:          ${podObj.image || 'nginx:latest'}`,
            `    Port:           80/TCP`,
            `    State:          Running`,
            `    Ready:          True`,
            `    Restart Count:  ${podObj.restarts}`,
            `Conditions:`,
            `  Type              Status`,
            `  Initialized       True`,
            `  Ready             True`,
            `  ContainersReady   True`,
            `  PodScheduled      True`,
            `Events:`,
            `  Type    Reason     Age   From               Message`,
            `  ----    ------     ----  ----               -------`,
            `  Normal  Scheduled  ${podObj.age}   default-scheduler  Successfully assigned default/${podObj.name} to ${podObj.node}`,
            `  Normal  Pulling    ${podObj.age}   kubelet            Pulling image "${podObj.image || 'nginx:latest'}"`,
            `  Normal  Pulled     ${podObj.age}   kubelet            Successfully pulled image "${podObj.image || 'nginx:latest'}"`,
            `  Normal  Created    ${podObj.age}   kubelet            Created container app`,
            `  Normal  Started    ${podObj.age}   kubelet            Started container app`,
          ];
          return { stdout: desc.join('\n'), stderr: '', exitCode: 0 };
        }

        if (resourceType === 'deployment' || resourceType === 'deploy') {
          const deployObj = state.deployments.find((d) => d.name === targetName);
          if (!deployObj) {
            return { stdout: '', stderr: `Error from server (NotFound): deployments.apps "${targetName}" not found`, exitCode: 1 };
          }

          const desc = [
            `Name:                   ${deployObj.name}`,
            `Namespace:              ${deployObj.namespace}`,
            `CreationTimestamp:      Mon, 29 Oct 2026 10:00:00 +0000`,
            `Labels:                 app=${deployObj.name}`,
            `Replicas:               ${deployObj.replicas} desired | ${deployObj.available} updated | ${deployObj.available} total | ${deployObj.available} available`,
            `StrategyType:           RollingUpdate`,
            `RollingUpdateStrategy:  25% max unavailable, 25% max surge`,
            `Pod Template:`,
            `  Labels:  app=${deployObj.name}`,
            `  Containers:`,
            `   app:`,
            `    Image:        ${deployObj.image}`,
            `    Port:         80/TCP`,
            `    Environment:  <none>`,
            `Conditions:`,
            `  Type           Status  Reason`,
            `  ----           ------  ------`,
            `  Available      True    MinimumReplicasAvailable`,
            `  Progressing    True    NewReplicaSetAvailable`,
            `OldReplicaSets:  <none>`,
            `Events:          <none>`,
          ];
          return { stdout: desc.join('\n'), stderr: '', exitCode: 0 };
        }

        return { stdout: '', stderr: `error: describe for "${resourceType}" not supported`, exitCode: 1 };
      }

      // ---------- kubectl logs ----------
      if (subcommand === 'logs') {
        const podName = args[1];
        if (!podName) {
          return { stdout: '', stderr: 'error: pod name required for logs', exitCode: 1 };
        }

        const pod = state.pods.find((p) => p.name === podName);
        if (!pod) {
          return { stdout: '', stderr: `Error from server (NotFound): pods "${podName}" not found`, exitCode: 1 };
        }

        const time = new Date().toISOString();
        const logs = [
          `${time} [notice] 1#1: using the "epoll" event method`,
          `${time} [notice] 1#1: nginx/1.25.3 started successfully`,
          `${time} [notice] 1#1: start worker processes`,
          `${time} 10.244.0.1 - - [GET / HTTP/1.1] 200 612 "-" "kube-probe/1.30"`,
          `${time} 10.244.0.1 - - [GET /healthz HTTP/1.1] 200 2 "-" "kube-probe/1.30"`,
        ];
        return { stdout: logs.join('\n'), stderr: '', exitCode: 0 };
      }

      // ---------- kubectl create deployment ----------
      if (subcommand === 'create' && args[1] === 'deployment') {
        const name = args[2];
        const imageArg = args.find((a) => a.startsWith('--image='))?.split('=')[1] || 'nginx:latest';
        if (!name) {
          return { stdout: '', stderr: 'error: deployment name required', exitCode: 1 };
        }

        const deployObj: K8sDeployment = {
          name,
          namespace: 'default',
          ready: '1/1',
          upToDate: 1,
          available: 1,
          age: '1s',
          image: imageArg,
          replicas: 1,
        };
        state.deployments.push(deployObj);
        state.pods.push({
          name: `${name}-${genRandomId(5)}-${genRandomId(5)}`,
          namespace: 'default',
          ready: '1/1',
          status: 'Running',
          restarts: 0,
          age: '1s',
          ip: `10.244.0.${Math.floor(Math.random() * 200 + 40)}`,
          node: 'linux-box-control-plane',
          deployment: name,
          image: imageArg,
        });

        saveK8sState(state);
        return { stdout: `deployment.apps/${name} created`, stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: `kubectl: unknown command "${subcommand}"`, exitCode: 1 };
    },
  });

  // ==================== DOCKER-COMPOSE ====================
  registry.register({
    name: 'docker-compose',
    description: 'Define and run multi-container Docker applications',
    usage: 'docker-compose [up|down|ps|logs] [options]',
    flags: [
      { flag: '-d', description: 'Detached mode: Run containers in the background' },
      { flag: '-f', description: 'Specify an alternate compose file' },
    ],
    handler: (args, flags, shellState, vfs): CommandResult => {
      const subcommand = args[0] || 'ps';

      // Find compose file
      const composeFile = typeof flags['f'] === 'string'
        ? flags['f']
        : 'docker-compose.yml';

      const fullPath = resolve(composeFile, shellState);
      const node = vfs.getNode(fullPath, true);

      if (subcommand === 'help') {
        const lines = [
          'Define and run multi-container applications with Docker.',
          '',
          'Usage:',
          '  docker-compose [-f <arg>...] [options] [COMMAND] [ARGS...]',
          '',
          'Commands:',
          '  up         Create and start containers',
          '  down       Stop and remove containers, networks',
          '  ps         List containers',
          '  logs       View output from containers',
        ];
        return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
      }

      if (!node && subcommand !== 'ps') {
        return {
          stdout: '',
          stderr: `no configuration file provided: not found ${composeFile}`,
          exitCode: 1,
        };
      }

      const content = node?.content || '';
      const parsed = parseSimpleYaml(content);
      const services = parsed.services || {
        web: { image: 'nginx:latest', ports: ['8080:80'] },
        cache: { image: 'redis:alpine', ports: ['6379:6379'] },
      };

      const dockerState = getDockerState();

      if (subcommand === 'up') {
        const outputs: string[] = ['[+] Running 2/2'];

        for (const [svcName, svcConfig] of Object.entries(services)) {
          const containerName = `projects-${svcName}-1`;
          const image = (svcConfig as any).image || `${svcName}:latest`;

          // Parse ports
          const portMappings: { hostPort: number; containerPort: number }[] = [];
          if (svcName === 'web') portMappings.push({ hostPort: 8080, containerPort: 80 });
          else if (svcName === 'cache') portMappings.push({ hostPort: 6379, containerPort: 6379 });

          const existingIdx = dockerState.containers.findIndex((c) => c.name === containerName);
          if (existingIdx !== -1) {
            dockerState.containers[existingIdx].status = 'running';
            outputs.push(` ✔ Container ${containerName.padEnd(20)} Started`);
          } else {
            const newCont: DockerContainer = {
              id: Math.random().toString(16).substring(2, 14),
              name: containerName,
              image,
              command: svcName === 'web' ? 'nginx -g "daemon off;"' : 'redis-server',
              created: 'Just now',
              status: 'running',
              ports: portMappings,
              env: {},
              logs: [`Starting ${svcName} service...`, `${svcName} listening and ready.`],
            };
            dockerState.containers.push(newCont);
            outputs.push(` ✔ Container ${containerName.padEnd(20)} Started`);
          }
        }

        saveDockerState(dockerState);
        return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
      }

      if (subcommand === 'down') {
        const outputs: string[] = ['[+] Running 2/2'];
        const composeNames = Object.keys(services).map((s) => `projects-${s}-1`);

        dockerState.containers = dockerState.containers.filter((c) => {
          if (composeNames.includes(c.name)) {
            outputs.push(` ✔ Container ${c.name.padEnd(20)} Removed`);
            return false;
          }
          return true;
        });

        saveDockerState(dockerState);
        return { stdout: outputs.join('\n'), stderr: '', exitCode: 0 };
      }

      if (subcommand === 'ps') {
        const composeContainers = dockerState.containers.filter((c) => c.name.startsWith('projects-'));
        if (composeContainers.length === 0) {
          return { stdout: 'NAME      IMAGE     COMMAND   SERVICE   STATUS    PORTS', stderr: '', exitCode: 0 };
        }

        const header = 'NAME                 IMAGE          COMMAND                  SERVICE   STATUS         PORTS';
        const rows = composeContainers.map((c) => {
          const svc = c.name.replace('projects-', '').replace('-1', '');
          const portStr = c.ports.map((p) => `0.0.0.0:${p.hostPort}->${p.containerPort}/tcp`).join(', ');
          return `${c.name.padEnd(20)} ${c.image.padEnd(14)} ${c.command.slice(0, 24).padEnd(24)} ${svc.padEnd(9)} ${c.status.padEnd(14)} ${portStr}`;
        });
        return { stdout: [header, ...rows].join('\n'), stderr: '', exitCode: 0 };
      }

      if (subcommand === 'logs') {
        const composeContainers = dockerState.containers.filter((c) => c.name.startsWith('projects-'));
        const lines: string[] = [];
        for (const c of composeContainers) {
          for (const l of c.logs) {
            lines.push(`${c.name} | ${l}`);
          }
        }
        return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
      }

      return { stdout: '', stderr: `docker-compose: unsupported command "${subcommand}"`, exitCode: 1 };
    },
  });
}
