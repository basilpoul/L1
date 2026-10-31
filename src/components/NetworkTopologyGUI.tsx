import React, { useState, useEffect } from 'react';
import {
  Network,
  Server,
  Layers,
  Container,
  Cpu,
  Globe,
  RefreshCw,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  X,
  Sliders,
} from 'lucide-react';
import { getSysAdminState, saveSysAdminState, type ServiceState } from '../shell/commands/sysadmin';
import { getDockerState, type DockerState } from '../shell/commands/docker';
import { getK8sState, saveK8sState } from '../shell/commands/orchestration';
import { getStorageState } from '../shell/commands/kernelStorage';
import { getUfwState } from '../shell/commands/security';
import type { VirtualFileSystem } from '../vfs/fileSystem';
import type { K8sClusterState, K8sDeployment, K8sPod, StorageState, BlockDevice } from '../types';

interface NetworkTopologyGUIProps {
  onClose?: () => void;
  onRunCommand?: (cmd: string) => void;
  vfs?: VirtualFileSystem;
}

type SelectedNodeType =
  | { type: 'host'; id: string; name: string; ip: string }
  | { type: 'service'; id: string; name: string; service: ServiceState }
  | { type: 'docker-bridge'; id: string; name: string; ip: string }
  | { type: 'docker-container'; id: string; name: string; image: string; ports: string; status: string }
  | { type: 'k8s-cluster'; id: string; name: string; cidr: string }
  | { type: 'k8s-deployment'; id: string; name: string; replicas: number; image: string }
  | { type: 'k8s-pod'; id: string; name: string; podIp: string; status: string; deploymentName?: string }
  | { type: 'remote-host'; id: string; name: string; ip: string };

export const NetworkTopologyGUI: React.FC<NetworkTopologyGUIProps> = ({
  onClose,
  onRunCommand,
  vfs,
}) => {
  const [, setRefreshTick] = useState(0);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeType | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshTick((t) => t + 1);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const sysState = getSysAdminState();
  const dockerState: DockerState = getDockerState();
  const k8sState: K8sClusterState = getK8sState();
  const storageState: StorageState = getStorageState();
  const ufwState = getUfwState();

  const isSdb1Mounted = storageState.devices.some(
    (d: BlockDevice) =>
      (d.name === 'sdb1' && !!d.mountpoint) ||
      d.children?.some((c: BlockDevice) => c.name === 'sdb1' && !!c.mountpoint)
  );

  const runningContainers = dockerState.containers.filter((c) => c.status === 'running');

  const triggerFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  const handleRestartService = (serviceName: string) => {
    const state = getSysAdminState();
    if (state.services[serviceName]) {
      state.services[serviceName].status = 'running';
      state.services[serviceName].pid = Math.floor(Math.random() * 2000) + 1000;
      saveSysAdminState(state);
      setRefreshTick((t) => t + 1);
      triggerFeedback(`Restarted ${serviceName}.service (PID ${state.services[serviceName].pid})`);
      if (onRunCommand) onRunCommand(`systemctl restart ${serviceName}`);
    }
  };

  const handleScaleDeployment = (deploymentName: string, delta: number) => {
    const k8s = getK8sState();
    const dep = k8s.deployments.find((d: K8sDeployment) => d.name === deploymentName);
    if (!dep) return;

    const newReplicas = Math.max(0, dep.replicas + delta);
    dep.replicas = newReplicas;

    const existingPods = k8s.pods.filter(
      (p: K8sPod) => p.deployment === dep.name || p.name.startsWith(dep.name)
    );
    if (existingPods.length < newReplicas) {
      for (let i = existingPods.length; i < newReplicas; i++) {
        const hash = Math.random().toString(36).substring(2, 7);
        k8s.pods.push({
          name: `${dep.name}-${hash}`,
          namespace: dep.namespace || 'default',
          ready: '1/1',
          status: 'Running',
          restarts: 0,
          age: '0s',
          ip: `10.244.0.${Math.floor(Math.random() * 200) + 20}`,
          node: 'linux-box-control-plane',
          deployment: dep.name,
        });
      }
    } else if (existingPods.length > newReplicas) {
      const toRemove = existingPods.length - newReplicas;
      let removed = 0;
      k8s.pods = k8s.pods.filter((p: K8sPod) => {
        if ((p.deployment === dep.name || p.name.startsWith(dep.name)) && removed < toRemove) {
          removed++;
          return false;
        }
        return true;
      });
    }

    saveK8sState(k8s);
    setRefreshTick((t) => t + 1);
    triggerFeedback(`Scaled deployment/${dep.name} to ${newReplicas} replicas`);
    if (onRunCommand)
      onRunCommand(`kubectl scale deployment ${dep.name} --replicas=${newReplicas}`);
  };

  const handleCurlCheck = (target: string) => {
    triggerFeedback(`Probing ${target} → HTTP/1.1 200 OK`);
    if (onRunCommand) onRunCommand(`curl -I ${target}`);
  };

  const hostsAliases = ['localhost', 'linux-box'];
  if (vfs) {
    const hostsNode = vfs.getNode('/etc/hosts', true);
    if (hostsNode && hostsNode.content) {
      const lines = hostsNode.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('10.0.0.5')) {
          const parts = trimmed.split(/\s+/);
          if (parts.length > 1) {
            hostsAliases.push(...parts.slice(1));
          }
        }
      }
    }
  }

  return (
    <div
      className="flex flex-col h-full border-l overflow-hidden font-sans select-none"
      style={{
        background: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3.5 h-10 border-b shrink-0"
        style={{
          background: 'var(--theme-tab-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <Network size={14} className="text-cyan-400" />
          <span className="text-xs font-semibold tracking-tight">Infrastructure Topology</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
            title="Refresh Topology"
          >
            <RefreshCw size={12} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
              style={{ color: 'var(--theme-text-secondary)' }}
              title="Close Topology Panel"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div className="px-3.5 py-1.5 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-[11px] font-mono flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 size={12} className="shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Connected Node Architecture */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
        {/* Node Tier 1: Local Host */}
        <div
          onClick={() =>
            setSelectedNode({
              type: 'host',
              id: 'local-host',
              name: 'linux-box',
              ip: '10.0.0.2',
            })
          }
          className="cursor-pointer p-3.5 rounded-xl border transition-all"
          style={{
            background:
              selectedNode?.id === 'local-host'
                ? 'var(--theme-elevated)'
                : 'var(--theme-card-bg)',
            borderColor:
              selectedNode?.id === 'local-host'
                ? 'var(--theme-accent)'
                : 'var(--theme-border)',
          }}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Server size={14} style={{ color: 'var(--theme-dir)' }} />
              <span className="text-xs font-semibold">Local Host (linux-box)</span>
            </div>
            <span
              className="text-[11px] font-mono tabular-nums"
              style={{ color: 'var(--theme-dir)' }}
            >
              10.0.0.2/24 · eth0
            </span>
          </div>

          <div
            className="flex items-center gap-2 text-[11px] font-mono"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            <span>
              UFW:{' '}
              <strong className={ufwState.enabled ? 'text-emerald-400' : 'text-amber-400'}>
                {ufwState.enabled ? 'active' : 'inactive'}
              </strong>
            </span>
            <span className="opacity-30">·</span>
            <span>sda1 (/)</span>
            {isSdb1Mounted && (
              <>
                <span className="opacity-30">·</span>
                <span className="text-emerald-400">sdb1 (/mnt/data)</span>
              </>
            )}
          </div>
        </div>

        {/* Vertical Architecture Connector */}
        <div className="flex items-center pl-5 py-0.5">
          <div className="w-px h-3.5 bg-white/15" />
          <span
            className="ml-2 text-[10px] font-mono"
            style={{ color: 'var(--theme-muted)' }}
          >
            systemd.slice · loopback &amp; host sockets
          </span>
        </div>

        {/* Node Tier 2: Systemd Services */}
        <div
          className="p-3 rounded-xl border space-y-2.5"
          style={{
            background: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Layers size={13} className="text-purple-400" />
              <span>Systemd Daemons</span>
            </div>
            <span
              className="text-[11px] font-mono tabular-nums"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              {Object.values(sysState.services).filter((s) => s.status === 'running').length} running
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Object.values(sysState.services).map((svc) => {
              const isRunning = svc.status === 'running';
              const isSelected = selectedNode?.id === `svc-${svc.name}`;
              return (
                <div
                  key={svc.name}
                  onClick={() =>
                    setSelectedNode({
                      type: 'service',
                      id: `svc-${svc.name}`,
                      name: svc.name,
                      service: svc,
                    })
                  }
                  className="cursor-pointer p-2.5 rounded-lg border transition-all"
                  style={{
                    background: isSelected ? 'var(--theme-elevated)' : 'var(--theme-bg)',
                    borderColor: isSelected ? '#a855f7' : 'var(--theme-border)',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium font-mono">{svc.name}</span>
                    <span
                      className={`text-[10px] font-mono ${
                        isRunning ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {isRunning ? 'up' : 'down'}
                    </span>
                  </div>
                  <div
                    className="text-[10px] font-mono tabular-nums"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    {svc.port ? `TCP :${svc.port}` : 'background'} · PID {svc.pid || '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Vertical Architecture Connector */}
        <div className="flex items-center pl-5 py-0.5">
          <div className="w-px h-3.5 bg-white/15" />
          <span
            className="ml-2 text-[10px] font-mono"
            style={{ color: 'var(--theme-muted)' }}
          >
            docker0 bridge · 172.17.0.1/16
          </span>
        </div>

        {/* Node Tier 3: Docker Bridge */}
        <div
          className="p-3 rounded-xl border space-y-2.5"
          style={{
            background: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Container size={13} className="text-cyan-400" />
              <span>Docker Containers</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-cyan-400">
              172.17.0.0/16
            </span>
          </div>

          {runningContainers.length === 0 ? (
            <div
              className="p-2.5 rounded-lg border border-dashed text-center text-xs"
              style={{
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-muted)',
              }}
            >
              No running containers attached to docker0
            </div>
          ) : (
            <div className="space-y-1.5">
              {runningContainers.map((c) => {
                const isSelected = selectedNode?.id === `docker-${c.id}`;
                const portsStr =
                  c.ports && c.ports.length > 0
                    ? c.ports.map((p) => `${p.hostPort}→${p.containerPort}`).join(', ')
                    : 'internal';
                return (
                  <div
                    key={c.id}
                    onClick={() =>
                      setSelectedNode({
                        type: 'docker-container',
                        id: `docker-${c.id}`,
                        name: c.name,
                        image: c.image,
                        ports: portsStr,
                        status: c.status,
                      })
                    }
                    className="cursor-pointer p-2.5 rounded-lg border transition-all"
                    style={{
                      background: isSelected ? 'var(--theme-elevated)' : 'var(--theme-bg)',
                      borderColor: isSelected ? '#22d3ee' : 'var(--theme-border)',
                    }}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium font-mono">{c.name}</span>
                      <span className="text-[11px] font-mono tabular-nums text-emerald-400">
                        {portsStr}
                      </span>
                    </div>
                    <div
                      className="mt-0.5 text-[10px] font-mono"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      {c.image} · {c.id.substring(0, 10)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Vertical Architecture Connector */}
        <div className="flex items-center pl-5 py-0.5">
          <div className="w-px h-3.5 bg-white/15" />
          <span
            className="ml-2 text-[10px] font-mono"
            style={{ color: 'var(--theme-muted)' }}
          >
            cni0 pod network · 10.244.0.0/16
          </span>
        </div>

        {/* Node Tier 4: Kubernetes Cluster */}
        <div
          className="p-3 rounded-xl border space-y-2.5"
          style={{
            background: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <Cpu size={13} className="text-indigo-400" />
              <span>Kubernetes Control Plane</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400">Ready</span>
          </div>

          <div className="space-y-1.5">
            {k8sState.deployments.map((dep: K8sDeployment) => {
              const isSelected = selectedNode?.id === `dep-${dep.name}`;
              return (
                <div
                  key={dep.name}
                  onClick={() =>
                    setSelectedNode({
                      type: 'k8s-deployment',
                      id: `dep-${dep.name}`,
                      name: dep.name,
                      replicas: dep.replicas,
                      image: dep.image,
                    })
                  }
                  className="flex items-center justify-between p-2 rounded-lg border cursor-pointer text-xs transition-colors"
                  style={{
                    background: isSelected ? 'var(--theme-elevated)' : 'var(--theme-bg)',
                    borderColor: isSelected ? '#818cf8' : 'var(--theme-border)',
                  }}
                >
                  <span className="font-mono font-medium">deploy/{dep.name}</span>
                  <span
                    className="text-[11px] font-mono tabular-nums"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    {dep.replicas} replicas · {dep.image}
                  </span>
                </div>
              );
            })}
          </div>

          <div
            className="pt-2 border-t flex flex-wrap gap-1.5"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            {k8sState.pods.map((pod: K8sPod) => (
              <button
                key={pod.name}
                onClick={() =>
                  setSelectedNode({
                    type: 'k8s-pod',
                    id: `pod-${pod.name}`,
                    name: pod.name,
                    podIp: pod.ip,
                    status: pod.status,
                  })
                }
                className="px-2 py-1 rounded-md border text-[10px] font-mono transition-colors hover:border-indigo-400/50"
                style={{
                  background: 'var(--theme-bg)',
                  borderColor:
                    selectedNode?.id === `pod-${pod.name}` ? '#818cf8' : 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              >
                pod/{pod.name} · <span className="text-emerald-400">{pod.ip}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Vertical Architecture Connector */}
        <div className="flex items-center pl-5 py-0.5">
          <div className="w-px h-3.5 bg-white/15" />
          <span
            className="ml-2 text-[10px] font-mono"
            style={{ color: 'var(--theme-muted)' }}
          >
            VPC peer link · 10.0.0.0/24
          </span>
        </div>

        {/* Node Tier 5: Remote Production Host */}
        <div
          onClick={() =>
            setSelectedNode({
              type: 'remote-host',
              id: 'prod-node',
              name: 'prod-node',
              ip: '10.0.0.5',
            })
          }
          className="cursor-pointer p-3.5 rounded-xl border transition-all"
          style={{
            background:
              selectedNode?.id === 'prod-node'
                ? 'var(--theme-elevated)'
                : 'var(--theme-card-bg)',
            borderColor:
              selectedNode?.id === 'prod-node' ? '#10b981' : 'var(--theme-border)',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Globe size={14} className="text-emerald-400" />
              <span className="text-xs font-semibold">Remote Host (prod-node)</span>
            </div>
            <span className="text-[11px] font-mono tabular-nums text-emerald-400">
              10.0.0.5
            </span>
          </div>

          <div
            className="text-[11px] font-mono"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            DNS: {hostsAliases.filter((a) => a.includes('prod')).join(', ') || 'prod-node.internal'}{' '}
            · SSH RSA Ready
          </div>
        </div>
      </div>

      {/* Interactive Node Inspector Drawer */}
      {selectedNode && (
        <div
          className="p-3.5 border-t shrink-0 space-y-2.5 animate-fadeIn"
          style={{
            background: 'var(--theme-elevated)',
            borderColor: 'var(--theme-border-strong)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs">
              <Sliders size={13} style={{ color: 'var(--theme-accent)' }} />
              <span className="font-semibold">{selectedNode.name}</span>
              <span className="opacity-30">·</span>
              <span
                className="text-[11px] font-mono"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                {selectedNode.type}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded opacity-60 hover:opacity-100"
            >
              <X size={13} />
            </button>
          </div>

          <div
            className="text-[11px] font-mono"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            {selectedNode.type === 'service' && (
              <span>
                Port: {selectedNode.service.port || 'none'} · Status: {selectedNode.service.status}
              </span>
            )}
            {selectedNode.type === 'k8s-deployment' && (
              <span>
                Image: {selectedNode.image} · Replicas: {selectedNode.replicas}
              </span>
            )}
            {selectedNode.type === 'docker-container' && (
              <span>
                Ports: {selectedNode.ports} · Status: {selectedNode.status}
              </span>
            )}
            {selectedNode.type === 'k8s-pod' && (
              <span>
                Pod IP: {selectedNode.podIp} · Phase: {selectedNode.status}
              </span>
            )}
            {selectedNode.type === 'host' && <span>Interface eth0 · 10.0.0.2/24</span>}
            {selectedNode.type === 'remote-host' && <span>Peer Node · 10.0.0.5/24</span>}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {selectedNode.type === 'service' && (
              <>
                <button
                  onClick={() => handleRestartService(selectedNode.name)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-medium transition-colors"
                >
                  <RotateCcw size={11} />
                  <span>Restart Daemon</span>
                </button>
                {selectedNode.service.port && (
                  <button
                    onClick={() => handleCurlCheck(`http://localhost:${selectedNode.service.port}`)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-medium transition-colors"
                  >
                    <ExternalLink size={11} />
                    <span>Probe HTTP</span>
                  </button>
                )}
              </>
            )}

            {selectedNode.type === 'k8s-deployment' && (
              <>
                <button
                  onClick={() => handleScaleDeployment(selectedNode.name, 1)}
                  className="px-2.5 py-1 rounded-md bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-colors"
                >
                  Scale +1 Replica
                </button>
                <button
                  onClick={() => handleScaleDeployment(selectedNode.name, -1)}
                  className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
                >
                  Scale -1 Replica
                </button>
              </>
            )}

            {selectedNode.type === 'remote-host' && (
              <>
                <button
                  onClick={() => handleCurlCheck('http://10.0.0.5')}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-colors"
                >
                  <ExternalLink size={11} />
                  <span>Probe HTTP</span>
                </button>
                <button
                  onClick={() => onRunCommand?.('ssh deploy@10.0.0.5')}
                  className="px-2.5 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
                >
                  SSH Connect
                </button>
              </>
            )}

            {selectedNode.type === 'host' && (
              <button
                onClick={() => onRunCommand?.('lsblk')}
                className="px-2.5 py-1 rounded-md bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-medium transition-colors"
              >
                Inspect Block Devices (lsblk)
              </button>
            )}

            {selectedNode.type === 'docker-container' && (
              <button
                onClick={() =>
                  onRunCommand?.(`docker logs ${selectedNode.id.replace('docker-', '')}`)
                }
                className="px-2.5 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
              >
                Tail Container Logs
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
