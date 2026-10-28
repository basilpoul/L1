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

  const [feedback, setFeedback] = useState<Record<string, { resolved: boolean; message: string }>>({});

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
    setFeedback(prev => ({
      ...prev,
      [scenario.id]: { resolved: false, message: `Fault injected! Check symptom: "${scenario.symptom}"` },
    }));
    onRefresh();
  };

  const handleVerify = (scenario: IncidentScenario) => {
    const result = scenario.verifyResolution(vfs, history);
    setFeedback(prev => ({ ...prev, [scenario.id]: result }));
    if (result.resolved) {
      const updated = activeFaults.filter(id => id !== scenario.id);
      setActiveFaults(updated);
      localStorage.setItem(ACTIVE_FAULTS_KEY, JSON.stringify(updated));
    }
    onRefresh();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="flex flex-col w-full max-w-4xl h-[88vh] bg-[#121422] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#17192a]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <Flame size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Break-Fix Incident Simulator</h2>
              <p className="text-xs text-slate-400">Troubleshoot & resolve real-world Linux, Docker & SysAdmin outages</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Incidents List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {INCIDENTS.map(inc => {
            const isFaultActive = activeFaults.includes(inc.id);
            const status = feedback[inc.id];

            return (
              <div
                key={inc.id}
                className={`p-4 rounded-xl border transition-all ${
                  isFaultActive
                    ? 'bg-rose-950/20 border-rose-500/30'
                    : 'bg-[#181a2c] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        inc.severity === 'Critical'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {inc.severity}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">[{inc.category}]</span>
                    <h3 className="text-sm font-semibold text-slate-100">{inc.title}</h3>
                  </div>

                  {isFaultActive && (
                    <span className="flex items-center gap-1 text-[11px] font-medium text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 w-fit">
                      <ShieldAlert size={12} />
                      Fault Active
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300 mb-2">{inc.description}</p>

                {/* Symptom Box */}
                <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 font-mono text-xs text-slate-400 mb-3">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-sans font-semibold mb-1">Observed Symptom:</div>
                  <div className="text-amber-400">{inc.symptom}</div>
                </div>

                {/* Feedback Alert */}
                {status && (
                  <div
                    className={`flex items-start gap-2 p-2.5 rounded-lg text-xs mb-3 ${
                      status.resolved
                        ? 'bg-emerald-950/30 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-950/30 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {status.resolved ? (
                      <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold">{status.resolved ? 'Incident Resolved!' : 'Resolution Incomplete'}</div>
                      <div className="text-slate-300 mt-0.5">{status.message}</div>
                    </div>
                  </div>
                )}

                {/* Action Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
                  <details className="text-[11px] text-slate-400 cursor-pointer">
                    <summary className="hover:text-slate-200">View Troubleshooting Hint</summary>
                    <pre className="mt-1.5 p-2 bg-black/40 rounded border border-white/5 text-slate-300 font-mono whitespace-pre-wrap">
                      {inc.resolutionHint}
                    </pre>
                  </details>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeployFault(inc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 transition-all hover:scale-105"
                    >
                      <Play size={12} fill="currentColor" />
                      <span>Deploy Fault</span>
                    </button>

                    <button
                      onClick={() => handleVerify(inc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all hover:scale-105"
                    >
                      <CheckCircle2 size={12} />
                      <span>Verify Resolution</span>
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
