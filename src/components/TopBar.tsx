import React, { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, BookOpen, User, FolderOpen, Download, Upload, Activity } from 'lucide-react';

interface TopBarProps {
  cwd: string;
  currentUser?: string;
  onReset: () => void;
  onOpenCheatSheet: () => void;
  onExportVFS?: () => void;
  onImportVFS?: (jsonString: string) => void;
  onToggleSystemMonitor?: () => void;
  isSystemMonitorOpen?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  cwd,
  currentUser = 'user@linux-box',
  onReset,
  onOpenCheatSheet,
  onExportVFS,
  onImportVFS,
  onToggleSystemMonitor,
  isSystemMonitorOpen,
}) => {
  const [time, setTime] = useState(() => new Date());
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const snapshotInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const handleReset = () => {
    if (showResetConfirm) {
      onReset();
      setShowResetConfirm(false);
    } else {
      setShowResetConfirm(true);
      setTimeout(() => setShowResetConfirm(false), 3000);
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      onImportVFS?.(content);
    };
    reader.readAsText(file);
    if (snapshotInputRef.current) snapshotInputRef.current.value = '';
  };

  const displayPath = cwd.replace('/home/user', '~');

  return (
    <div className="glass flex items-center h-9 px-4 z-10 select-none border-b border-white/5">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Terminal size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-blue-400">LinuxSim</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
          <FolderOpen size={12} className="text-blue-400/80" />
          <span className="text-xs text-slate-300 font-mono">{displayPath}</span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        {onToggleSystemMonitor && (
          <button
            onClick={onToggleSystemMonitor}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors border ${
              isSystemMonitorOpen
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-white/5'
            }`}
            title="Toggle System Monitor"
          >
            <Activity size={12} className={isSystemMonitorOpen ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
            <span className="hidden sm:inline">Monitor</span>
          </button>
        )}

        <div className="flex items-center gap-1.5">
          <User size={12} className="text-slate-500" />
          <span className="text-xs text-slate-400 font-mono">{currentUser}</span>
        </div>

        <span className="text-xs text-slate-500 font-mono tabular-nums">{formatTime(time)}</span>

        {/* Snapshot Controls */}
        <div className="flex items-center gap-1 border-l border-white/10 pl-2">
          {onExportVFS && (
            <button
              onClick={onExportVFS}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              title="Export VFS Snapshot (.json)"
            >
              <Download size={12} />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

          {onImportVFS && (
            <>
              <button
                onClick={() => snapshotInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Import VFS Snapshot (.json)"
              >
                <Upload size={12} />
                <span className="hidden sm:inline">Import</span>
              </button>
              <input
                ref={snapshotInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors hover:bg-white/5"
            style={{ color: showResetConfirm ? '#f87171' : '#94a3b8' }}
            title={showResetConfirm ? 'Click again to confirm reset' : 'Reset File System to Factory State'}
          >
            <RefreshCw size={12} />
            {showResetConfirm && <span className="text-red-400 font-semibold">Confirm?</span>}
          </button>
        </div>

        <button
          onClick={onOpenCheatSheet}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 border border-white/5"
          title="Command Cheat Sheet"
        >
          <BookOpen size={12} />
          <span className="hidden sm:inline">Help</span>
        </button>
      </div>
    </div>
  );
};
