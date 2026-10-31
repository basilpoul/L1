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

const SparklineChart: React.FC<{
  data: number[];
  color: string;
  height?: number;
}> = ({ data, color, height = 46 }) => {
  const width = 280;
  const max = 100;
  const min = 0;
  const pts = data.length > 1 ? data : [data[0] || 10, data[0] || 10];
  const stepX = width / (pts.length - 1);

  const coordinates = pts.map((val, idx) => {
    const x = idx * stepX;
    const clamped = Math.max(min, Math.min(max, val));
    const y = height - (clamped / max) * (height - 8) - 4;
    return [x, y] as const;
  });

  const linePath = coordinates
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full overflow-visible"
      style={{ height: `${height}px` }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const SystemMonitorGUI: React.FC<SystemMonitorGUIProps> = ({
  onClose,
  onRefreshVFS,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'docker' | 'network'>('overview');
  const [sysState, setSysState] = useState(() => getSysAdminState());
  const [dockerState, setDockerState] = useState(() => getDockerState());
  const [ufwState, setUfwState] = useState<UfwState>(() => getUfwState());
  const [jitter, setJitter] = useState(0);

  // Calculations
  const runningServices = Object.values(sysState.services).filter((s) => s.status === 'running');
  const runningContainers = dockerState.containers.filter((c) => c.status === 'running');

  const baseCpu = 4;
  const serviceCpu = runningServices.length * 6;
  const dockerCpu = runningContainers.length * 11;
  const cpuPercent = Math.min(100, Math.max(2, baseCpu + serviceCpu + dockerCpu + jitter));

  const baseMem = 640;
  const serviceMem = runningServices.length * 280;
  const dockerMem = runningContainers.length * 450;
  const usedMemMb = Math.min(8192, baseMem + serviceMem + dockerMem + jitter * 12);
  const memPercent = Math.round((usedMemMb / 8192) * 100);

  const [cpuHistory, setCpuHistory] = useState<number[]>(() =>
    Array.from({ length: 18 }, (_, i) => Math.max(4, cpuPercent - 3 + (i % 4)))
  );
  const [memHistory, setMemHistory] = useState<number[]>(() =>
    Array.from({ length: 18 }, () => memPercent)
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const nextSys = getSysAdminState();
      const nextDocker = getDockerState();
      const nextUfw = getUfwState();
      const nextJitter = Math.floor(Math.random() * 5) - 2;

      setSysState(nextSys);
      setDockerState(nextDocker);
      setUfwState(nextUfw);
      setJitter(nextJitter);

      const rSvcs = Object.values(nextSys.services).filter((s) => s.status === 'running').length;
      const rCnts = nextDocker.containers.filter((c) => c.status === 'running').length;
      const nextCpu = Math.min(100, Math.max(2, 4 + rSvcs * 6 + rCnts * 11 + nextJitter));
      const nextMem = Math.round(
        (Math.min(8192, 640 + rSvcs * 280 + rCnts * 450 + nextJitter * 12) / 8192) * 100
      );

      setCpuHistory((prev) => [...prev.slice(-19), nextCpu]);
      setMemHistory((prev) => [...prev.slice(-19), nextMem]);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const refreshAll = () => {
    setSysState(getSysAdminState());
    setDockerState(getDockerState());
    setUfwState(getUfwState());
    onRefreshVFS?.();
  };

  const handleToggleService = (name: string) => {
    const state = getSysAdminState();
    const s = state.services[name];
    if (!s) return;
    s.status = s.status === 'running' ? 'stopped' : 'running';
    saveSysAdminState(state);
    setSysState({ ...state });
    onRefreshVFS?.();
  };

  const handleToggleContainer = (id: string) => {
    const dState = getDockerState();
    const c = dState.containers.find((cnt) => cnt.id === id);
    if (!c) return;
    c.status = c.status === 'running' ? 'exited' : 'running';
    saveDockerState(dState);
    setDockerState({ ...dState });
    onRefreshVFS?.();
  };

  const handleRemoveContainer = (id: string) => {
    const dState = getDockerState();
    dState.containers = dState.containers.filter((c) => c.id !== id);
    saveDockerState(dState);
    setDockerState({ ...dState });
    onRefreshVFS?.();
  };

  const handleToggleUfw = () => {
    const uState = getUfwState();
    uState.enabled = !uState.enabled;
    saveUfwState(uState);
    setUfwState({ ...uState });
  };

  return (
    <div
      className="flex flex-col h-full font-sans text-xs select-none border-l"
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
          <Activity size={14} className="text-emerald-400" />
          <span className="font-semibold tracking-tight">System Telemetry</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refreshAll}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
            title="Refresh telemetry"
          >
            <RefreshCw size={12} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
              style={{ color: 'var(--theme-text-secondary)' }}
              title="Close Monitor"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Sub-Navigation Tabs */}
      <div
        className="p-2 border-b shrink-0"
        style={{
          background: 'var(--theme-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div
          className="grid grid-cols-4 gap-1 p-0.5 rounded-lg border"
          style={{
            background: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {[
            { key: 'overview', label: 'Metrics', icon: Cpu },
            { key: 'services', label: `Daemons · ${runningServices.length}`, icon: Server },
            { key: 'docker', label: `Docker · ${runningContainers.length}`, icon: Box },
            { key: 'network', label: 'Ports', icon: Radio },
          ].map((t) => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as typeof activeTab)}
                className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'bg-white/[0.09] text-white shadow-xs' : 'hover:text-white'
                }`}
                style={!isActive ? { color: 'var(--theme-text-secondary)' } : undefined}
              >
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {activeTab === 'overview' && (
          <div className="space-y-3.5">
            {/* Real-Time CPU Sparkline Card */}
            <div
              className="p-3.5 rounded-xl border space-y-2.5"
              style={{
                background: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs font-semibold">CPU Load</div>
                  <div
                    className="text-[11px] font-mono mt-0.5"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    4 vCPU · 2.80 GHz · x86_64
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className="text-lg font-bold font-mono tabular-nums"
                    style={{
                      color:
                        cpuPercent > 80 ? '#f87171' : cpuPercent > 50 ? '#fbbf24' : '#34d399',
                    }}
                  >
                    {cpuPercent}%
                  </span>
                </div>
              </div>

              <SparklineChart
                data={cpuHistory}
                color={cpuPercent > 80 ? '#f87171' : cpuPercent > 50 ? '#fbbf24' : '#34d399'}
              />

              <div
                className="flex items-center justify-between text-[11px] font-mono pt-1 border-t"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-secondary)',
                }}
              >
                <span>{runningServices.length} active daemons</span>
                <span>·</span>
                <span>{runningContainers.length} containers</span>
              </div>
            </div>

            {/* Real-Time Memory Sparkline Card */}
            <div
              className="p-3.5 rounded-xl border space-y-2.5"
              style={{
                background: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs font-semibold">Memory Allocation</div>
                  <div
                    className="text-[11px] font-mono tabular-nums mt-0.5"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    {usedMemMb} MB / 8192 MB physical
                  </div>
                </div>
                <span className="text-lg font-bold font-mono tabular-nums text-purple-400">
                  {memPercent}%
                </span>
              </div>

              <SparklineChart data={memHistory} color="#a855f7" />

              <div
                className="flex items-center justify-between text-[11px] font-mono pt-1 border-t tabular-nums"
                style={{
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-secondary)',
                }}
              >
                <span>Swap: 0 / 2048 MB</span>
                <span>·</span>
                <span>Cache: 1420 MB</span>
              </div>
            </div>

            {/* Host Kernel & Security Summary */}
            <div
              className="p-3.5 rounded-xl border space-y-2"
              style={{
                background: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="text-xs font-semibold">Kernel &amp; Host Environment</div>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3 text-[11px] pt-1">
                <div>
                  <div style={{ color: 'var(--theme-muted)' }}>Hostname</div>
                  <div className="font-mono font-medium mt-0.5">linux-box</div>
                </div>
                <div>
                  <div style={{ color: 'var(--theme-muted)' }}>Distribution</div>
                  <div className="font-medium mt-0.5">Ubuntu 22.04 LTS</div>
                </div>
                <div>
                  <div style={{ color: 'var(--theme-muted)' }}>Kernel Release</div>
                  <div className="font-mono font-medium mt-0.5">6.5.0-generic</div>
                </div>
                <div>
                  <div style={{ color: 'var(--theme-muted)' }}>UFW Firewall</div>
                  <div
                    className={`font-mono font-semibold mt-0.5 ${
                      ufwState.enabled ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {ufwState.enabled ? 'Enabled (Enforcing)' : 'Disabled'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DAEMONS / SERVICES TAB */}
        {activeTab === 'services' && (
          <div className="space-y-2">
            {Object.values(sysState.services).map((s: ServiceState) => {
              const isRunning = s.status === 'running';
              return (
                <div
                  key={s.name}
                  className="flex items-center justify-between p-3 rounded-xl border transition-colors"
                  style={{
                    background: 'var(--theme-card-bg)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold font-mono">{s.name}.service</span>
                      <span className="opacity-30">·</span>
                      <span
                        className={`font-mono text-[11px] ${
                          isRunning ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {isRunning ? 'running' : 'stopped'}
                      </span>
                      {s.port && (
                        <>
                          <span className="opacity-30">·</span>
                          <span
                            className="font-mono text-[11px] tabular-nums"
                            style={{ color: 'var(--theme-dir)' }}
                          >
                            :{s.port}
                          </span>
                        </>
                      )}
                    </div>
                    <div
                      className="text-[11px] truncate"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      {s.description}
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleService(s.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors shrink-0 ${
                      isRunning
                        ? 'bg-rose-500/10 text-rose-300 border-rose-500/25 hover:bg-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20'
                    }`}
                  >
                    {isRunning ? (
                      <Square size={10} fill="currentColor" />
                    ) : (
                      <Play size={10} fill="currentColor" />
                    )}
                    <span>{isRunning ? 'Stop' : 'Start'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* DOCKER TAB */}
        {activeTab === 'docker' && (
          <div className="space-y-2.5">
            <div
              className="flex items-center justify-between text-[11px] px-1"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              <span>{dockerState.containers.length} total containers</span>
              <span className="font-mono tabular-nums">{dockerState.images.length} cached images</span>
            </div>

            {dockerState.containers.length === 0 ? (
              <div
                className="p-6 text-center rounded-xl border"
                style={{
                  background: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text-secondary)',
                }}
              >
                <Box size={22} className="mx-auto mb-2 opacity-50" />
                <p className="font-medium">No Docker containers provisioned</p>
                <p className="text-[11px] font-mono mt-1 opacity-75">
                  docker run -d -p 8080:80 nginx:latest
                </p>
              </div>
            ) : (
              dockerState.containers.map((c: DockerContainer) => {
                const isRunning = c.status === 'running';
                const portsStr = c.ports
                  .map((p) => `${p.hostPort}→${p.containerPort}`)
                  .join(', ');

                return (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border space-y-2 transition-colors"
                    style={{
                      background: 'var(--theme-card-bg)',
                      borderColor: 'var(--theme-border)',
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold font-mono truncate">{c.name}</span>
                          <span className="opacity-30">·</span>
                          <span
                            className={`font-mono text-[11px] ${
                              isRunning ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {isRunning ? 'running' : 'exited'}
                          </span>
                        </div>
                        <div
                          className="text-[11px] font-mono mt-0.5"
                          style={{ color: 'var(--theme-text-secondary)' }}
                        >
                          {c.image} · {c.id.slice(0, 10)}
                          {portsStr ? ` · ${portsStr}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleToggleContainer(c.id)}
                          className={`p-1.5 rounded-md border transition-colors ${
                            isRunning
                              ? 'text-rose-300 border-rose-500/25 hover:bg-rose-500/15'
                              : 'text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/15'
                          }`}
                          title={isRunning ? 'Stop container' : 'Start container'}
                        >
                          {isRunning ? (
                            <Square size={11} fill="currentColor" />
                          ) : (
                            <Play size={11} fill="currentColor" />
                          )}
                        </button>
                        <button
                          onClick={() => handleRemoveContainer(c.id)}
                          className="p-1.5 rounded-md border border-transparent hover:border-rose-500/25 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 transition-colors"
                          title="Remove container"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* NETWORK & FIREWALL TAB */}
        {activeTab === 'network' && (
          <div className="space-y-3.5">
            <div
              className="p-3.5 rounded-xl border space-y-2"
              style={{
                background: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {ufwState.enabled ? (
                    <Shield size={15} className="text-emerald-400" />
                  ) : (
                    <ShieldAlert size={15} className="text-amber-400" />
                  )}
                  <span className="font-semibold text-xs">UFW Packet Filter</span>
                </div>
                <button
                  onClick={handleToggleUfw}
                  className={`px-2.5 py-1 rounded-md font-medium text-xs border transition-colors ${
                    ufwState.enabled
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/25 hover:bg-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20'
                  }`}
                >
                  {ufwState.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              <div
                className="text-[11px] font-mono"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                Policy: incoming <span className="text-amber-400">deny</span> · outgoing{' '}
                <span className="text-emerald-400">allow</span>
              </div>
            </div>

            {/* Active Socket Bindings */}
            <div
              className="p-3.5 rounded-xl border space-y-2"
              style={{
                background: 'var(--theme-card-bg)',
                borderColor: 'var(--theme-border)',
              }}
            >
              <div className="text-xs font-semibold">Listening TCP/UDP Sockets</div>
              <div className="divide-y divide-white/[0.04] font-mono text-[11px] tabular-nums">
                <div
                  className="flex items-center justify-between py-1.5"
                  style={{ color: 'var(--theme-muted)' }}
                >
                  <span>LOCAL ADDRESS</span>
                  <span>PID / DAEMON</span>
                </div>
                {runningServices.map((s) => (
                  <div key={s.name} className="flex items-center justify-between py-1.5">
                    <span style={{ color: 'var(--theme-dir)' }}>0.0.0.0:{s.port}</span>
                    <span>
                      {s.pid}/{s.name}
                    </span>
                  </div>
                ))}
                {runningContainers.map((c) =>
                  c.ports.map((p) => (
                    <div
                      key={`${c.id}-${p.hostPort}`}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span style={{ color: 'var(--theme-dir)' }}>0.0.0.0:{p.hostPort}</span>
                      <span className="text-purple-400">docker-proxy ({c.name})</span>
                    </div>
                  ))
                )}
                {runningServices.length === 0 && runningContainers.length === 0 && (
                  <div
                    className="py-4 text-center font-sans"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    No active listening sockets
                  </div>
                )}
              </div>
            </div>

            {ufwState.enabled && (
              <div
                className="p-3.5 rounded-xl border space-y-2"
                style={{
                  background: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="text-xs font-semibold">UFW Filter Rules</div>
                <div className="divide-y divide-white/[0.04] font-mono text-[11px] tabular-nums">
                  {ufwState.rules.map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between py-1.5">
                      <span>
                        [{i + 1}] {r.port}/{r.proto}
                      </span>
                      <span
                        className={
                          r.action === 'ALLOW' ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
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
