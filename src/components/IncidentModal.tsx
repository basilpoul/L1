import React, { useState, useEffect } from 'react';
import {
  Flame,
  CheckCircle2,
  XCircle,
  X,
  Play,
  ShieldAlert,
} from 'lucide-react';
import { INCIDENTS } from '../data/incidents';
import type { IncidentScenario } from '../data/incidents';
import type { VirtualFileSystem } from '../vfs/fileSystem';

interface IncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  vfs: VirtualFileSystem;
  history?: string[];
  onRefresh: () => void;
}

const ACTIVE_FAULTS_KEY = 'linuxsim_active_faults';

export const IncidentModal: React.FC<IncidentModalProps> = ({
  isOpen,
  onClose,
  vfs,
  history = [],
  onRefresh,
}) => {
  const [activeFaults, setActiveFaults] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_FAULTS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [feedback, setFeedback] = useState<Record<string, { resolved: boolean; message: string }>>(
    {}
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleDeployFault = (scenario: IncidentScenario) => {
    scenario.deployFault(vfs);
    const updated = Array.from(new Set([...activeFaults, scenario.id]));
    setActiveFaults(updated);
    localStorage.setItem(ACTIVE_FAULTS_KEY, JSON.stringify(updated));
    setFeedback((prev) => ({
      ...prev,
      [scenario.id]: {
        resolved: false,
        message: `Fault injected. Observed symptom: "${scenario.symptom}"`,
      },
    }));
    onRefresh();
  };

  const handleVerify = (scenario: IncidentScenario) => {
    const result = scenario.verifyResolution(vfs, history);
    setFeedback((prev) => ({ ...prev, [scenario.id]: result }));
    if (result.resolved) {
      const updated = activeFaults.filter((id) => id !== scenario.id);
      setActiveFaults(updated);
      localStorage.setItem(ACTIVE_FAULTS_KEY, JSON.stringify(updated));
    }
    onRefresh();
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/75 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div
        className="flex flex-col w-full max-w-4xl h-[90dvh] sm:h-[86vh] rounded-t-2xl sm:rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border-strong)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b shrink-0"
          style={{
            background: 'var(--theme-tab-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center gap-3">
            <Flame size={18} className="text-rose-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Break-Fix Incident Response Console
              </h2>
              <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                Inject realistic production outages and validate root-cause remediation
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Incidents List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {INCIDENTS.map((inc, idx) => {
            const isFaultActive = activeFaults.includes(inc.id);
            const status = feedback[inc.id];

            return (
              <div
                key={inc.id}
                className="p-4 rounded-xl border transition-all"
                style={{
                  background: isFaultActive
                    ? 'rgba(244, 63, 94, 0.06)'
                    : 'var(--theme-card-bg)',
                  borderColor: isFaultActive
                    ? 'rgba(244, 63, 94, 0.35)'
                    : 'var(--theme-border)',
                }}
              >
                {/* Clean Unboxed Kicker Metadata */}
                <div className="flex items-center justify-between text-xs font-mono mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums opacity-50">
                      INC-{String(idx + 1).padStart(2, '0')}
                    </span>
                    <span className="opacity-30">·</span>
                    <span
                      className={`font-semibold ${
                        inc.severity === 'Critical' ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span className="opacity-30">·</span>
                    <span style={{ color: 'var(--theme-text-secondary)' }}>{inc.category}</span>
                  </div>

                  {isFaultActive && (
                    <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-medium">
                      <ShieldAlert size={12} />
                      <span>Active Outage</span>
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold mb-1.5">{inc.title}</h3>
                <p
                  className="text-xs mb-3 leading-relaxed"
                  style={{ color: 'var(--theme-text-secondary)' }}
                >
                  {inc.description}
                </p>

                {/* Symptom Telemetry Box */}
                <div
                  className="p-3 rounded-lg border font-mono text-xs mb-3"
                  style={{
                    background: 'var(--theme-bg)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-wider font-sans font-semibold mb-1"
                    style={{ color: 'var(--theme-muted)' }}
                  >
                    Observed Telemetry Symptom
                  </div>
                  <div className="text-amber-400">{inc.symptom}</div>
                </div>

                {/* Verification Status Banner */}
                {status && (
                  <div
                    className={`flex items-start gap-2.5 p-3 rounded-lg text-xs mb-3 border ${
                      status.resolved
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {status.resolved ? (
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {status.resolved ? 'Incident Resolved' : 'Remediation Incomplete'}
                      </div>
                      <div className="opacity-90 mt-0.5">{status.message}</div>
                    </div>
                  </div>
                )}

                {/* Action Controls */}
                <div
                  className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t"
                  style={{ borderColor: 'var(--theme-border)' }}
                >
                  <details
                    className="text-xs cursor-pointer"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  >
                    <summary className="hover:underline">View Runbook Hint</summary>
                    <pre
                      className="mt-2 p-2.5 rounded-lg border font-mono text-[11px] whitespace-pre-wrap"
                      style={{
                        background: 'var(--theme-bg)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text)',
                      }}
                    >
                      {inc.resolutionHint}
                    </pre>
                  </details>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeployFault(inc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors"
                    >
                      <Play size={11} fill="currentColor" />
                      <span>Inject Fault</span>
                    </button>

                    <button
                      onClick={() => handleVerify(inc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
                    >
                      <CheckCircle2 size={12} />
                      <span>Verify Fix</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
