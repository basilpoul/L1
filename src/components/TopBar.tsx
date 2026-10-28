import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  BookOpen,
  User,
  FolderOpen,
  Download,
  Upload,
  Activity,
  Flame,
  Palette,
  Network,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { TerminalTheme } from '../types';
import { THEMES } from '../styles/themes';

interface TopBarProps {
  cwd: string;
  currentUser?: string;
  onReset: () => void;
  onOpenCheatSheet: () => void;
  onExportVFS?: () => void;
  onImportVFS?: (jsonString: string) => void;
  onToggleSystemMonitor?: () => void;
  isSystemMonitorOpen?: boolean;
  onToggleTopology?: () => void;
  isTopologyOpen?: boolean;
  onOpenCommandPalette?: () => void;
  onToggleSound?: () => void;
  isSoundMuted?: boolean;
  theme?: TerminalTheme;
  onThemeChange?: (theme: TerminalTheme) => void;
  onOpenIncidents?: () => void;
  activeIncidentsCount?: number;
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
  onToggleTopology,
  isTopologyOpen,
  onOpenCommandPalette,
  onToggleSound,
  isSoundMuted = false,
  theme = 'slate',
  onThemeChange,
  onOpenIncidents,
  activeIncidentsCount = 0,
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
      <div className="flex items-center gap-2.5">
        {/* Incident Response Simulator Button */}
        {onOpenIncidents && (
          <button
            onClick={onOpenIncidents}
            className="flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium transition-all border bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30"
            title="Break-Fix Incident Simulator"
          >
            <Flame size={13} className="text-rose-400 animate-pulse" />
            <span className="hidden sm:inline">Incidents</span>
            {activeIncidentsCount > 0 && (
              <span className="px-1.5 py-0.1 text-[10px] font-mono rounded-full bg-rose-500/30 text-rose-200">
                {activeIncidentsCount}
              </span>
            )}
          </button>
        )}

        {/* Theme Switcher */}
        {onThemeChange && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-xs text-slate-300">
            <Palette size={12} className="text-slate-400" />
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value as TerminalTheme)}
              className="bg-transparent text-slate-300 text-[11px] outline-none cursor-pointer pr-1"
            >
              {Object.values(THEMES).map((t) => (
                <option key={t.id} value={t.id} className="bg-[#141625] text-slate-200">
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Command Palette Trigger */}
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
            title="Command Palette (Ctrl+K)"
          >
            <Search size={12} className="text-slate-400" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden md:inline px-1 py-0.2 text-[9px] font-mono rounded bg-black/40 border border-white/10 text-slate-400">
              Ctrl+K
            </kbd>
          </button>
        )}

        {/* Topology Map Toggle */}
        {onToggleTopology && (
          <button
            onClick={onToggleTopology}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-xs transition-colors border ${
              isTopologyOpen
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-white/5'
            }`}
            title="Toggle Network & Cluster Topology Map"
          >
            <Network size={12} className={isTopologyOpen ? 'text-blue-400' : 'text-slate-400'} />
            <span className="hidden sm:inline">Topology</span>
          </button>
        )}

        {/* System Monitor Toggle */}
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

        {/* Audio Sound Toggle */}
        {onToggleSound && (
          <button
            onClick={onToggleSound}
            className={`p-1 rounded text-xs transition-colors border ${
              !isSoundMuted
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'text-slate-500 hover:text-slate-300 border-white/5 hover:bg-white/5'
            }`}
            title={isSoundMuted ? 'Unmute Terminal SFX' : 'Mute Terminal SFX'}
          >
            {!isSoundMuted ? <Volume2 size={13} /> : <VolumeX size={13} />}
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
