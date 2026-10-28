import React, { useState, useEffect } from 'react';
import {
  Network,
  Server,
  Shield,
  Layers,
  Container,
  Cpu,
  HardDrive,
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
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedNode, setSelectedNode] = useState<SelectedNodeType | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Poll state every 2s
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
    (d: BlockDevice) => (d.name === 'sdb1' && !!d.mountpoint) ||
      d.children?.some((c: BlockDevice) => c.name === 'sdb1' && !!c.mountpoint)
  );

  const runningContainers = dockerState.containers.filter(
    (c) => c.status === 'running'
  );

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
      triggerFeedback(`Service ${serviceName} restarted (PID ${state.services[serviceName].pid})`);
      if (onRunCommand) onRunCommand(`systemctl restart ${serviceName}`);
    }
  };

  const handleScaleDeployment = (deploymentName: string, delta: number) => {
    const k8s = getK8sState();
    const dep = k8s.deployments.find((d: K8sDeployment) => d.name === deploymentName);
    if (!dep) return;

    const newReplicas = Math.max(0, dep.replicas + delta);
    dep.replicas = newReplicas;

    // Adjust pods
    const existingPods = k8s.pods.filter((p: K8sPod) => p.deployment === dep.name || p.name.startsWith(dep.name));
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
    triggerFeedback(`Scaled ${dep.name} to ${newReplicas} replicas`);
    if (onRunCommand) onRunCommand(`kubectl scale deployment ${dep.name} --replicas=${newReplicas}`);
  };

  const handleCurlCheck = (target: string) => {
    triggerFeedback(`Probing ${target}... HTTP/1.1 200 OK`);
    if (onRunCommand) onRunCommand(`curl -I ${target}`);
  };

  // Check /etc/hosts content for DNS aliases
  let hostsAliases = ['localhost', 'linux-box'];
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
    <div className="flex flex-col h-full bg-[#0d101a] border-l border-white/5 text-slate-200 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#121626] border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Network size={15} />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-slate-100 tracking-wide uppercase">
              Network Topology Map <span className="text-[9px] text-slate-500 font-mono font-normal">#{refreshTick}</span>
            </h2>
            <p className="text-[10px] text-slate-400">Live Host, Bridge, K8s & Service Mesh</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setRefreshTick((t) => t + 1)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
            title="Refresh Topology"
          >
            <RefreshCw size={13} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-colors"
              title="Close Topology Panel"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Action feedback banner */}
      {actionFeedback && (
        <div className="px-3 py-1 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-[11px] font-mono flex items-center gap-1.5 animate-fadeIn">
          <CheckCircle2 size={12} className="shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* Main Diagram Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Tier 1: Local Host (linux-box) */}
        <div
          onClick={() =>
            setSelectedNode({
              type: 'host',
              id: 'local-host',
              name: 'linux-box',
              ip: '10.0.0.2',
            })
          }
          className={`cursor-pointer p-3 rounded-xl border transition-all ${
            selectedNode?.id === 'local-host'
              ? 'bg-blue-950/30 border-blue-500/50 shadow-md shadow-blue-500/10'
              : 'bg-[#15192b]/80 border-white/5 hover:border-white/10 hover:bg-[#181d33]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Server size={16} className="text-blue-400" />
              <span className="text-xs font-semibold text-slate-100">Local Host (linux-box)</span>
            </div>
            <span className="text-[10px] font-mono text-blue-300/80 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              10.0.0.2 / eth0
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Shield
                size={13}
                className={ufwState.enabled ? 'text-emerald-400' : 'text-slate-500'}
              />
              <span>UFW:</span>
              <span
                className={`font-mono text-[10px] font-semibold px-1 rounded ${
                  ufwState.enabled
                    ? 'text-emerald-300 bg-emerald-500/15'
                    : 'text-slate-400 bg-slate-500/15'
                }`}
              >
                {ufwState.enabled ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-400">
              <HardDrive size={13} className="text-slate-400" />
              <span>Storage:</span>
              <span className="font-mono text-[10px] text-slate-300">
                sda1 (/) {isSdb1Mounted ? '• sdb1 (mnt)' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Tier 2: Systemd Services Layer */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <Layers size={13} className="text-purple-400" />
              <span>Systemd Daemons</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {Object.values(sysState.services).filter((s) => s.status === 'running').length} active
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
                  className={`cursor-pointer p-2 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-purple-950/30 border-purple-500/50 shadow'
                      : 'bg-[#15192b]/60 border-white/5 hover:border-white/10 hover:bg-[#181d33]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-200 capitalize">
                      {svc.name}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isRunning ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'
                      }`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>:{svc.port || '—'}</span>
                    <span className={isRunning ? 'text-emerald-400' : 'text-slate-500'}>
                      {svc.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tier 3: Docker Bridge (docker0) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <Container size={13} className="text-cyan-400" />
              <span>Docker Bridge (docker0)</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300/80 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
              172.17.0.1/16
            </span>
          </div>

          {runningContainers.length === 0 ? (
            <div className="p-3 rounded-lg border border-dashed border-white/10 text-center text-xs text-slate-500">
              No containers running on docker0 bridge
            </div>
          ) : (
            <div className="space-y-1.5">
              {runningContainers.map((c) => {
                const isSelected = selectedNode?.id === `docker-${c.id}`;
                const portsStr = c.ports && c.ports.length > 0
                  ? c.ports.map((p) => `${p.hostPort}->${p.containerPort}`).join(', ')
                  : 'bridged';
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
                    className={`cursor-pointer p-2.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-cyan-950/30 border-cyan-500/50 shadow'
                        : 'bg-[#15192b]/60 border-white/5 hover:border-white/10 hover:bg-[#181d33]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Container size={14} className="text-cyan-400" />
                        <span className="text-xs font-medium text-slate-200">{c.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {portsStr}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                      <span>{c.image}</span>
                      <span className="text-slate-500">{c.id.substring(0, 10)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tier 4: Kubernetes Cluster (k8s-default) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <Cpu size={13} className="text-indigo-400" />
              <span>Kubernetes (k8s-default)</span>
            </div>
            <span className="text-[10px] font-mono text-indigo-300/80 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20">
              10.244.0.0/16
            </span>
          </div>

          <div className="p-3 rounded-xl bg-[#15192b]/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-300 pb-1.5 border-b border-white/5">
              <span>Control Plane Node:</span>
              <span className="font-mono text-emerald-400 font-semibold">
                {k8sState.nodes[0]?.name || 'linux-box-control-plane'} (Ready)
              </span>
            </div>

            {/* Deployments */}
            <div className="space-y-1">
              <div className="text-[10px] font-medium text-slate-400 uppercase">Deployments</div>
              {k8sState.deployments.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No deployments found</p>
              ) : (
                k8sState.deployments.map((dep: K8sDeployment) => (
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
                    className="flex items-center justify-between p-1.5 rounded bg-black/20 hover:bg-black/40 border border-white/5 cursor-pointer text-xs"
                  >
                    <span className="font-medium text-slate-200">{dep.name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                        {dep.replicas} Replicas
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pod badges */}
            <div className="pt-1.5 border-t border-white/5">
              <div className="text-[10px] font-medium text-slate-400 uppercase mb-1">
                Active Pods ({k8sState.pods.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
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
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-950/40 border border-indigo-500/30 text-[10px] font-mono text-indigo-300 hover:bg-indigo-900/50"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>{pod.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tier 5: Remote Production Host (prod-node) */}
        <div
          onClick={() =>
            setSelectedNode({
              type: 'remote-host',
              id: 'prod-node',
              name: 'prod-node',
              ip: '10.0.0.5',
            })
          }
          className={`cursor-pointer p-3 rounded-xl border transition-all ${
            selectedNode?.id === 'prod-node'
              ? 'bg-emerald-950/30 border-emerald-500/50 shadow'
              : 'bg-[#15192b]/80 border-white/5 hover:border-white/10 hover:bg-[#181d33]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-emerald-400" />
              <span className="text-xs font-semibold text-slate-100">
                Remote Production Host (prod-node)
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-300/80 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              10.0.0.5 / Virtual Link
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>DNS Aliases: {hostsAliases.filter((a) => a.includes('prod')).join(', ') || 'prod-node.internal'}</span>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              SSH Auth: Key Ready
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Node Inspector Drawer / Bottom Card */}
      {selectedNode && (
        <div className="p-3 bg-[#131728] border-t border-white/10 shrink-0 space-y-2 animate-slideUp">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders size={14} className="text-blue-400" />
              <span className="text-xs font-semibold text-slate-100">Node Inspector</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-slate-400">
                {selectedNode.type}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded"
            >
              <X size={13} />
            </button>
          </div>

          <div className="text-xs text-slate-300">
            <div className="font-medium text-slate-100">{selectedNode.name}</div>
            {selectedNode.type === 'service' && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                Port: {selectedNode.service.port || 'None'} • Status: {selectedNode.service.status}
              </div>
            )}
            {selectedNode.type === 'k8s-deployment' && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                Image: {selectedNode.image} • Desired Replicas: {selectedNode.replicas}
              </div>
            )}
            {selectedNode.type === 'docker-container' && (
              <div className="text-[11px] text-slate-400 mt-0.5">
                Ports: {selectedNode.ports} • Status: {selectedNode.status}
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selectedNode.type === 'service' && (
              <>
                <button
                  onClick={() => handleRestartService(selectedNode.name)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-medium transition-all"
                >
                  <RotateCcw size={11} />
                  <span>Restart Service</span>
                </button>
                {selectedNode.service.port && (
                  <button
                    onClick={() => handleCurlCheck(`http://localhost:${selectedNode.service.port}`)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium transition-all"
                  >
                    <ExternalLink size={11} />
                    <span>Run curl check</span>
                  </button>
                )}
              </>
            )}

            {selectedNode.type === 'k8s-deployment' && (
              <>
                <button
                  onClick={() => handleScaleDeployment(selectedNode.name, 1)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all"
                >
                  <span>Scale +1 Pod</span>
                </button>
                <button
                  onClick={() => handleScaleDeployment(selectedNode.name, -1)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-medium transition-all"
                >
                  <span>Scale -1 Pod</span>
                </button>
              </>
            )}

            {selectedNode.type === 'remote-host' && (
              <>
                <button
                  onClick={() => handleCurlCheck(`http://10.0.0.5`)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-medium transition-all"
                >
                  <ExternalLink size={11} />
                  <span>Probe HTTP</span>
                </button>
                <button
                  onClick={() => onRunCommand?.('ssh deploy@10.0.0.5')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all"
                >
                  <span>SSH Connect</span>
                </button>
              </>
            )}

            {selectedNode.type === 'host' && (
              <button
                onClick={() => onRunCommand?.('lsblk')}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium transition-all"
              >
                <span>Run lsblk</span>
              </button>
            )}

            {selectedNode.type === 'docker-container' && (
              <button
                onClick={() => onRunCommand?.(`docker logs ${selectedNode.id.replace('docker-', '')}`)}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-all"
              >
                <span>View Container Logs</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
