import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  BookOpen,
  FolderTree,
  Download,
  Upload,
  Activity,
  Flame,
  Palette,
  Network,
  Search,
  Volume2,
  VolumeX,
  Trophy,
  PanelLeft,
  PanelRightClose,
  SlidersHorizontal,
} from 'lucide-react';
import type { TerminalTheme } from '../types';
import { THEMES } from '../styles/themes';

export type RightPanelMode = 'explorer' | 'monitor' | 'topology' | null;

interface TopBarProps {
  cwd: string;
  currentUser?: string;
  onReset: () => void;
  onOpenCheatSheet: () => void;
  onExportVFS?: () => void;
  onImportVFS?: (jsonString: string) => void;
  activeRightPanel: RightPanelMode;
  onSelectRightPanel: (panel: RightPanelMode) => void;
  isMissionSidebarOpen: boolean;
  onToggleMissionSidebar: () => void;
  completedMissionsCount: number;
  totalMissionsCount: number;
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
  activeRightPanel,
  onSelectRightPanel,
  isMissionSidebarOpen,
  onToggleMissionSidebar,
  completedMissionsCount,
  totalMissionsCount,
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const snapshotInputRef = useRef<HTMLInputElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close mobile popover when clicking outside
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [isMobileMenuOpen]);

  const formatTime = (d: Date) => {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const handleReset = () => {
    if (showResetConfirm) {
      onReset();
      setShowResetConfirm(false);
      setIsMobileMenuOpen(false);
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
      setIsMobileMenuOpen(false);
    };
    reader.readAsText(file);
    if (snapshotInputRef.current) snapshotInputRef.current.value = '';
  };

  const displayPath = cwd.replace('/home/user', '~');

  return (
    <header
      className="relative flex items-center justify-between gap-2 sm:gap-4 h-12 md:h-11 px-3 sm:px-3.5 z-40 select-none border-b shrink-0 transition-colors duration-150"
      style={{
        background: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
    >
      {/* Zone 1: Brand, Curriculum Drawer Toggle (Tablet/Desktop) & Active Session Trail */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
        <div className="flex items-center gap-2 whitespace-nowrap shrink-0">
          <div
            className="w-7 h-7 md:w-6 md:h-6 rounded-md flex items-center justify-center border"
            style={{
              background: 'var(--theme-accent-soft)',
              borderColor: 'var(--theme-border-strong)',
              color: 'var(--theme-accent)',
            }}
          >
            <Terminal size={13} strokeWidth={2.4} />
          </div>
          <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--theme-text)' }}>
            LinuxSim
          </span>
        </div>

        {/* Mobile CWD indicator */}
        <div
          className="flex md:hidden items-center gap-1 text-xs font-mono truncate max-w-[120px] sm:max-w-[180px]"
          style={{ color: 'var(--theme-dir)' }}
        >
          <span className="opacity-30">·</span>
          <span className="truncate">{displayPath}</span>
        </div>

        <span className="hidden md:inline text-xs opacity-20" aria-hidden="true">
          /
        </span>

        {/* Missions Curriculum Drawer Button (Tablet & Desktop — on Mobile this lives in the Bottom Nav Bar) */}
        <button
          onClick={onToggleMissionSidebar}
          className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 md:py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 border ${
            isMissionSidebarOpen
              ? 'text-amber-300 bg-amber-500/15 border-amber-500/30'
              : 'hover:bg-white/[0.05] border-transparent'
          }`}
          style={!isMissionSidebarOpen ? { color: 'var(--theme-text-secondary)' } : undefined}
          title={isMissionSidebarOpen ? 'Hide Missions Curriculum' : 'Open Missions Curriculum'}
        >
          <PanelLeft size={13} className={isMissionSidebarOpen ? 'text-amber-400' : 'opacity-70'} />
          <Trophy size={12} className="text-amber-400" />
          <span>Missions</span>
          <span className="font-mono text-[11px] tabular-nums opacity-80">
            {completedMissionsCount}/{totalMissionsCount}
          </span>
        </button>

        {/* Session & Directory Trail (Desktop) */}
        <div
          className="hidden xl:flex items-center gap-1.5 text-xs font-mono truncate"
          style={{ color: 'var(--theme-text-secondary)' }}
        >
          <span className="opacity-30">·</span>
          <span style={{ color: 'var(--theme-user)' }}>{currentUser}</span>
          <span className="opacity-40">:</span>
          <span className="truncate max-w-[180px]" style={{ color: 'var(--theme-dir)' }}>
            {displayPath}
          </span>
        </div>
      </div>

      {/* Zone 2: Center Spotlight Trigger & Segmented Right Panel Switcher (Tablet & Desktop) */}
      <div className="flex items-center gap-2 shrink-0">
        {onOpenCommandPalette && (
          <button
            onClick={onOpenCommandPalette}
            className="flex items-center justify-center gap-2 px-2.5 sm:px-3 min-h-[36px] md:min-h-0 md:py-1 rounded-md text-xs transition-colors border hover:border-white/20 whitespace-nowrap shrink-0"
            style={{
              background: 'var(--theme-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
            title="Open Command Palette (Ctrl+K)"
          >
            <Search size={13} className="opacity-80" />
            <span className="hidden lg:inline">Search actions, missions, themes...</span>
            <span className="hidden sm:inline lg:hidden">Search</span>
            <kbd
              className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono rounded border"
              style={{
                background: 'var(--theme-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-muted)',
              }}
            >
              Ctrl+K
            </kbd>
          </button>
        )}

        {/* Segmented Docked Inspector Controls (Tablet & Desktop — on Mobile this lives in the Bottom Nav Bar) */}
        <div
          className="hidden md:flex items-center p-0.5 rounded-lg border"
          style={{
            background: 'var(--theme-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <button
            onClick={() => onSelectRightPanel(activeRightPanel === 'explorer' ? null : 'explorer')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeRightPanel === 'explorer'
                ? 'bg-white/[0.09] text-white shadow-xs'
                : 'hover:text-white'
            }`}
            style={
              activeRightPanel !== 'explorer' ? { color: 'var(--theme-text-secondary)' } : undefined
            }
            title="Toggle File Explorer"
          >
            <FolderTree
              size={12}
              className={activeRightPanel === 'explorer' ? 'text-blue-400' : 'opacity-75'}
            />
            <span>Files</span>
          </button>

          <button
            onClick={() => onSelectRightPanel(activeRightPanel === 'monitor' ? null : 'monitor')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeRightPanel === 'monitor'
                ? 'bg-white/[0.09] text-white shadow-xs'
                : 'hover:text-white'
            }`}
            style={
              activeRightPanel !== 'monitor' ? { color: 'var(--theme-text-secondary)' } : undefined
            }
            title="Toggle System Monitor"
          >
            <Activity
              size={12}
              className={activeRightPanel === 'monitor' ? 'text-emerald-400' : 'opacity-75'}
            />
            <span>Monitor</span>
          </button>

          <button
            onClick={() => onSelectRightPanel(activeRightPanel === 'topology' ? null : 'topology')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeRightPanel === 'topology'
                ? 'bg-white/[0.09] text-white shadow-xs'
                : 'hover:text-white'
            }`}
            style={
              activeRightPanel !== 'topology' ? { color: 'var(--theme-text-secondary)' } : undefined
            }
            title="Toggle Network Topology"
          >
            <Network
              size={12}
              className={activeRightPanel === 'topology' ? 'text-cyan-400' : 'opacity-75'}
            />
            <span>Topology</span>
          </button>

          {activeRightPanel !== null && (
            <button
              onClick={() => onSelectRightPanel(null)}
              className="px-1.5 py-1 rounded-md text-xs opacity-60 hover:opacity-100 transition-opacity"
              title="Close Right Inspector Panel"
            >
              <PanelRightClose size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Zone 3: Incidents, Docs, Theme & Responsive Overflow Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0" ref={mobileMenuRef}>
        {onOpenIncidents && (
          <button
            onClick={onOpenIncidents}
            className="flex items-center justify-center gap-1.5 px-2.5 min-h-[36px] md:min-h-0 md:py-1 rounded-md text-xs font-medium transition-colors border bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/25 whitespace-nowrap shrink-0"
            title="Break-Fix Incident Simulator"
          >
            <Flame size={13} className="text-rose-400" />
            <span className="hidden sm:inline">Incidents</span>
            {activeIncidentsCount > 0 && (
              <span className="font-mono text-[11px] tabular-nums text-rose-200">
                · {activeIncidentsCount}
              </span>
            )}
          </button>
        )}

        <button
          onClick={onOpenCheatSheet}
          className="flex items-center justify-center gap-1.5 px-2.5 min-h-[36px] md:min-h-0 md:py-1 rounded-md text-xs font-medium transition-colors border hover:bg-white/[0.05] whitespace-nowrap shrink-0"
          style={{
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
          }}
          title="Linux Command Reference"
        >
          <BookOpen size={13} />
          <span className="hidden sm:inline">Docs</span>
        </button>

        {/* Desktop Theme Selector */}
        {onThemeChange && (
          <div
            className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs"
            style={{
              background: 'var(--theme-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            <Palette size={12} style={{ color: 'var(--theme-accent)' }} />
            <select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value as TerminalTheme)}
              aria-label="Workspace Theme"
              className="bg-transparent text-xs font-medium outline-none cursor-pointer pr-1"
              style={{ color: 'var(--theme-text)' }}
            >
              {Object.values(THEMES).map((t) => (
                <option key={t.id} value={t.id} style={{ background: t.surface, color: t.text }}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Desktop Audio SFX Toggle */}
        {onToggleSound && (
          <button
            onClick={onToggleSound}
            className="hidden lg:flex p-1.5 rounded-md text-xs transition-colors border hover:bg-white/[0.05]"
            style={{
              borderColor: 'var(--theme-border)',
              color: !isSoundMuted ? 'var(--theme-user)' : 'var(--theme-muted)',
            }}
            title={isSoundMuted ? 'Unmute Terminal Audio' : 'Mute Terminal Audio'}
          >
            {!isSoundMuted ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
        )}

        {/* Desktop VFS Snapshot & Factory Reset Controls */}
        <div
          className="hidden lg:flex items-center gap-1 pl-2 border-l"
          style={{ borderColor: 'var(--theme-border)' }}
        >
          {onExportVFS && (
            <button
              onClick={onExportVFS}
              className="p-1.5 rounded-md transition-colors hover:bg-white/[0.05]"
              style={{ color: 'var(--theme-text-secondary)' }}
              title="Export VFS Snapshot (.json)"
            >
              <Download size={13} />
            </button>
          )}

          {onImportVFS && (
            <button
              onClick={() => snapshotInputRef.current?.click()}
              className="p-1.5 rounded-md transition-colors hover:bg-white/[0.05]"
              style={{ color: 'var(--theme-text-secondary)' }}
              title="Import VFS Snapshot (.json)"
            >
              <Upload size={13} />
            </button>
          )}

          <button
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors hover:bg-white/[0.05] whitespace-nowrap shrink-0"
            style={{ color: showResetConfirm ? '#f87171' : 'var(--theme-text-secondary)' }}
            title={
              showResetConfirm
                ? 'Click again to confirm factory reset'
                : 'Reset File System to Factory State'
            }
          >
            <RefreshCw size={12} />
            {showResetConfirm && <span className="text-rose-400 font-semibold">Confirm?</span>}
          </button>
        </div>

        {/* Shared Hidden File Input for VFS Snapshot Import */}
        <input
          ref={snapshotInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportFile}
        />

        {/* Mobile & Tablet Preferences / System Menu Button (< 1024px) */}
        <button
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="flex lg:hidden items-center justify-center min-w-[36px] min-h-[36px] rounded-md border transition-colors hover:bg-white/[0.06]"
          style={{
            background: isMobileMenuOpen ? 'var(--theme-elevated)' : 'transparent',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-text-secondary)',
          }}
          title="Workspace Preferences & Snapshots"
          aria-label="Workspace Preferences"
        >
          <SlidersHorizontal size={14} />
        </button>

        {/* Mobile & Tablet Preferences Dropdown Sheet */}
        {isMobileMenuOpen && (
          <div
            className="fixed sm:absolute right-3 top-13 w-64 rounded-xl border shadow-2xl p-3 space-y-3 z-50 animate-fadeIn lg:hidden"
            style={{
              background: 'var(--theme-elevated)',
              borderColor: 'var(--theme-border-strong)',
              color: 'var(--theme-text)',
            }}
          >
            {/* Theme Selector */}
            {onThemeChange && (
              <div className="space-y-1.5">
                <div
                  className="text-[11px] font-medium flex items-center gap-1.5"
                  style={{ color: 'var(--theme-text-secondary)' }}
                >
                  <Palette size={12} style={{ color: 'var(--theme-accent)' }} />
                  <span>Workspace Theme</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {Object.values(THEMES).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onThemeChange(t.id);
                      }}
                      className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                        theme === t.id ? 'bg-white/[0.1] text-white' : 'hover:bg-white/[0.05]'
                      }`}
                      style={
                        theme !== t.id ? { color: 'var(--theme-text-secondary)' } : undefined
                      }
                    >
                      <span>{t.name}</span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: t.accent }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div
              className="border-t pt-2.5 space-y-1"
              style={{ borderColor: 'var(--theme-border)' }}
            >
              {onToggleSound && (
                <button
                  onClick={onToggleSound}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs hover:bg-white/[0.06] transition-colors"
                >
                  <span className="flex items-center gap-2">
                    {!isSoundMuted ? (
                      <Volume2 size={14} className="text-emerald-400" />
                    ) : (
                      <VolumeX size={14} className="text-slate-400" />
                    )}
                    <span>Terminal Audio SFX</span>
                  </span>
                  <span className="font-mono text-[11px] opacity-75">
                    {!isSoundMuted ? 'ON' : 'MUTED'}
                  </span>
                </button>
              )}

              {onExportVFS && (
                <button
                  onClick={() => {
                    onExportVFS();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-white/[0.06] transition-colors"
                >
                  <Download size={14} className="text-blue-400" />
                  <span>Export VFS Snapshot</span>
                </button>
              )}

              {onImportVFS && (
                <button
                  onClick={() => snapshotInputRef.current?.click()}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-white/[0.06] transition-colors"
                >
                  <Upload size={14} className="text-cyan-400" />
                  <span>Import VFS Snapshot</span>
                </button>
              )}

              <button
                onClick={handleReset}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-rose-300 hover:bg-rose-500/15 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-rose-400" />
                  <span>{showResetConfirm ? 'Tap again to confirm' : 'Factory Reset VFS'}</span>
                </span>
              </button>
            </div>
          </div>
        )}

        <span
          className="hidden 2xl:inline text-xs font-mono tabular-nums pl-1"
          style={{ color: 'var(--theme-muted)' }}
        >
          {formatTime(time)}
        </span>
      </div>
    </header>
  );
};
