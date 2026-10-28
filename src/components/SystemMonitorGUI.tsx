import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Server,
  Box,
  Shield,
  ShieldAlert,
  Play,
  Square,
  RefreshCw,
  Trash2,
  X,
  Radio,
} from 'lucide-react';
import { getSysAdminState, saveSysAdminState } from '../shell/commands/sysadmin';
import { getDockerState, saveDockerState } from '../shell/commands/docker';
import { getUfwState, saveUfwState } from '../shell/commands/security';
import type { ServiceState } from '../shell/commands/sysadmin';
import type { DockerContainer } from '../shell/commands/docker';
import type { UfwState } from '../shell/commands/security';

interface SystemMonitorGUIProps {
  onClose?: () => void;
  onRefreshVFS?: () => void;
}

export const SystemMonitorGUI: React.FC<SystemMonitorGUIProps> = ({
  onClose,
  onRefreshVFS,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'docker' | 'network'>('overview');
  const [sysState, setSysState] = useState(() => getSysAdminState());
  const [dockerState, setDockerState] = useState(() => getDockerState());
  const [ufwState, setUfwState] = useState<UfwState>(() => getUfwState());
  const [jitter, setJitter] = useState(0);

  // Periodic polling & slight jitter for realism
  useEffect(() => {
    const timer = setInterval(() => {
      setSysState(getSysAdminState());
      setDockerState(getDockerState());
      setUfwState(getUfwState());
      setJitter(Math.floor(Math.random() * 5) - 2);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const refreshAll = () => {
    setSysState(getSysAdminState());
    setDockerState(getDockerState());
    setUfwState(getUfwState());
    onRefreshVFS?.();
  };

  // Calculations
  const runningServices = Object.values(sysState.services).filter(s => s.status === 'running');
  const runningContainers = dockerState.containers.filter(c => c.status === 'running');

  // Dynamic CPU calculation
  const baseCpu = 4;
  const serviceCpu = runningServices.length * 6;
  const dockerCpu = runningContainers.length * 11;
  const cpuPercent = Math.min(100, Math.max(2, baseCpu + serviceCpu + dockerCpu + jitter));

  // Dynamic Memory calculation (8192 MB total)
  const baseMem = 640;
  const serviceMem = runningServices.length * 280;
  const dockerMem = runningContainers.length * 450;
  const usedMemMb = Math.min(8192, baseMem + serviceMem + dockerMem + jitter * 12);
  const memPercent = Math.round((usedMemMb / 8192) * 100);

  // Toggle service
  const handleToggleService = (name: string) => {
    const state = getSysAdminState();
    const s = state.services[name];
    if (!s) return;
    s.status = s.status === 'running' ? 'stopped' : 'running';
    saveSysAdminState(state);
    setSysState({ ...state });
    onRefreshVFS?.();
  };

  // Toggle container
  const handleToggleContainer = (id: string) => {
    const dState = getDockerState();
    const c = dState.containers.find(cnt => cnt.id === id);
    if (!c) return;
    c.status = c.status === 'running' ? 'exited' : 'running';
    saveDockerState(dState);
    setDockerState({ ...dState });
    onRefreshVFS?.();
  };

  // Remove container
  const handleRemoveContainer = (id: string) => {
    const dState = getDockerState();
    dState.containers = dState.containers.filter(c => c.id !== id);
    saveDockerState(dState);
    setDockerState({ ...dState });
    onRefreshVFS?.();
  };

  // Toggle UFW
  const handleToggleUfw = () => {
    const uState = getUfwState();
    uState.enabled = !uState.enabled;
    saveUfwState(uState);
    setUfwState({ ...uState });
  };

  return (
    <div
      className="flex flex-col h-full font-sans text-xs select-none border-l border-white/5"
      style={{ background: '#121420', color: '#cbd5e1' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-white/5 bg-[#171927]">
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-emerald-400" />
          <span className="font-semibold text-slate-200">System Monitor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refreshAll}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Refresh metrics"
          >
            <RefreshCw size={13} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Close Monitor"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-2 pt-2 border-b border-white/5 bg-[#141624] gap-1">
        {[
          { key: 'overview', label: 'Overview', icon: Cpu },
          { key: 'services', label: `Services (${runningServices.length})`, icon: Server },
          { key: 'docker', label: `Docker (${runningContainers.length})`, icon: Box },
          { key: 'network', label: 'Network', icon: Radio },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-t text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#181a2b] text-emerald-400 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon size={12} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Host Details */}
            <div className="p-3 rounded-lg bg-[#181b2e] border border-white/5">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Host Overview</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Hostname:</span>{' '}
                  <span className="text-slate-200 font-mono">linux-box</span>
                </div>
                <div>
                  <span className="text-slate-500">OS:</span>{' '}
                  <span className="text-slate-200">Ubuntu 22.04 LTS</span>
                </div>
                <div>
                  <span className="text-slate-500">Kernel:</span>{' '}
                  <span className="text-slate-200 font-mono">6.5.0-generic</span>
                </div>
                <div>
                  <span className="text-slate-500">Uptime:</span>{' '}
                  <span className="text-slate-200">4 days, 6 hours</span>
                </div>
              </div>
            </div>

            {/* CPU Gauge */}
            <div className="p-3 rounded-lg bg-[#181b2e] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Cpu size={14} className="text-blue-400" />
                  CPU Usage
                </span>
                <span className="font-mono text-emerald-400 font-semibold">{cpuPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${cpuPercent}%`,
                    background: cpuPercent > 80 ? '#f87171' : cpuPercent > 50 ? '#fbbf24' : '#34d399',
                  }}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                4 cores @ 2.80GHz &bull; {runningServices.length} services &bull; {runningContainers.length} containers
              </div>
            </div>

            {/* Memory Gauge */}
            <div className="p-3 rounded-lg bg-[#181b2e] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Activity size={14} className="text-purple-400" />
                  Memory Usage
                </span>
                <span className="font-mono text-purple-400 font-semibold">
                  {memPercent}% ({usedMemMb} MB / 8192 MB)
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${memPercent}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-500">
                Swap: 0 MB / 2048 MB &bull; Buffer/Cache: 1420 MB
              </div>
            </div>

            {/* Quick Status Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[#181b2e] border border-white/5">
                <div className="text-slate-400 text-[11px] mb-1">Daemons Running</div>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  {runningServices.length} / {Object.keys(sysState.services).length}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#181b2e] border border-white/5">
                <div className="text-slate-400 text-[11px] mb-1">Firewall (UFW)</div>
                <div className={`text-lg font-bold font-mono ${ufwState.enabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {ufwState.enabled ? 'ACTIVE' : 'INACTIVE'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SERVICES TAB */}
        {activeTab === 'services' && (
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 font-medium mb-1">systemctl System Daemons</div>
            {Object.values(sysState.services).map((s: ServiceState) => {
              const isRunning = s.status === 'running';
              return (
                <div
                  key={s.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#181b2e] border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 font-mono">{s.name}</span>
                      {s.port && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-mono">
                          :{s.port}
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                          isRunning
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-slate-700 text-slate-400'
                        }`}
                      >
                        {isRunning ? 'active (running)' : 'inactive (dead)'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{s.description}</div>
                  </div>

                  <button
                    onClick={() => handleToggleService(s.name)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      isRunning
                        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                    }`}
                  >
                    {isRunning ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                    <span>{isRunning ? 'Stop' : 'Start'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* DOCKER TAB */}
        {activeTab === 'docker' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">Containers ({dockerState.containers.length})</span>
              <span className="text-[11px] text-slate-500">{dockerState.images.length} images available</span>
            </div>

            {dockerState.containers.length === 0 ? (
              <div className="p-6 text-center text-slate-500 rounded-lg bg-[#181b2e] border border-white/5">
                <Box size={24} className="mx-auto mb-2 opacity-50" />
                <p>No containers created yet.</p>
                <p className="text-[11px] text-slate-600 mt-1">Try: <code>docker run -d -p 8080:80 nginx:latest</code></p>
              </div>
            ) : (
              dockerState.containers.map((c: DockerContainer) => {
                const isRunning = c.status === 'running';
                const portsStr = c.ports.map(p => `${p.hostPort}:${p.containerPort}`).join(', ');

                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg bg-[#181b2e] border border-white/5 space-y-2 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 font-mono">{c.name}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                              isRunning
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {isRunning ? 'running' : 'exited'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {c.image} &bull; ID: {c.id.slice(0, 10)}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleContainer(c.id)}
                          className={`p-1.5 rounded transition-colors ${
                            isRunning
                              ? 'text-rose-400 hover:bg-rose-500/20'
                              : 'text-emerald-400 hover:bg-emerald-500/20'
                          }`}
                          title={isRunning ? 'Stop container' : 'Start container'}
                        >
                          {isRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                        </button>
                        <button
                          onClick={() => handleRemoveContainer(c.id)}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
                          title="Remove container"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {portsStr && (
                      <div className="text-[11px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-mono w-fit">
                        Port Mapping: 0.0.0.0:{portsStr}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* NETWORK & FIREWALL TAB */}
        {activeTab === 'network' && (
          <div className="space-y-4">
            {/* UFW Status */}
            <div className="p-3 rounded-lg bg-[#181b2e] border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {ufwState.enabled ? (
                    <Shield size={16} className="text-emerald-400" />
                  ) : (
                    <ShieldAlert size={16} className="text-amber-400" />
                  )}
                  <span className="font-semibold text-slate-200">Uncomplicated Firewall (UFW)</span>
                </div>
                <button
                  onClick={handleToggleUfw}
                  className={`px-2.5 py-1 rounded font-medium text-xs transition-colors ${
                    ufwState.enabled
                      ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                  }`}
                >
                  {ufwState.enabled ? 'Disable Firewall' : 'Enable Firewall'}
                </button>
              </div>
              <div className="text-[11px] text-slate-400">
                Default: incoming <span className="font-mono text-amber-400">deny</span>, outgoing <span className="font-mono text-emerald-400">allow</span>
              </div>
            </div>

            {/* Listening Ports Table */}
            <div className="p-3 rounded-lg bg-[#181b2e] border border-white/5 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Active Listening Ports</div>
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between py-1 border-b border-white/5 text-slate-500">
                  <span>PORT / PROTO</span>
                  <span>SERVICE / PROCESS</span>
                </div>
                {runningServices.map(s => (
                  <div key={s.name} className="flex items-center justify-between py-0.5 text-slate-300">
                    <span className="text-blue-400">0.0.0.0:{s.port}</span>
                    <span>{s.pid}/{s.name}</span>
                  </div>
                ))}
                {runningContainers.map(c =>
                  c.ports.map(p => (
                    <div key={`${c.id}-${p.hostPort}`} className="flex items-center justify-between py-0.5 text-slate-300">
                      <span className="text-blue-400">0.0.0.0:{p.hostPort}</span>
                      <span className="text-purple-400">docker-proxy ({c.name})</span>
                    </div>
                  ))
                )}
                {runningServices.length === 0 && runningContainers.length === 0 && (
                  <div className="text-slate-500 py-2 text-center">No listening ports.</div>
                )}
              </div>
            </div>

            {/* Firewall Rules */}
            {ufwState.enabled && (
              <div className="p-3 rounded-lg bg-[#181b2e] border border-white/5 space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Firewall Rules</div>
                <div className="space-y-1 font-mono text-[11px]">
                  {ufwState.rules.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between py-0.5 text-slate-300">
                      <span>[{i + 1}] {r.port}/{r.proto}</span>
                      <span className={r.action === 'ALLOW' ? 'text-emerald-400' : 'text-rose-400'}>
                        {r.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
