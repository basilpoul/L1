import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Activity,
  FolderTree,
  Flame,
  Network,
  RefreshCw,
  Volume2,
  VolumeX,
  Palette,
  Trophy,
  CheckCircle2,
  Columns,
  Rows,
  ChevronRight,
} from 'lucide-react';
import type { Mission, TerminalTheme } from '../types';
import { THEMES } from '../styles/themes';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  onToggleTopology?: () => void;
  onToggleSystemMonitor?: () => void;
  onToggleFileExplorer?: () => void;
  onOpenIncidents?: () => void;
  onResetVFS?: () => void;
  onToggleSound?: () => void;
  isSoundMuted?: boolean;
  onSelectMission?: (missionId: string) => void;
  onSelectTheme?: (theme: TerminalTheme) => void;
  missions: Mission[];
  currentTheme?: TerminalTheme;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSplitHorizontal,
  onSplitVertical,
  onToggleTopology,
  onToggleSystemMonitor,
  onToggleFileExplorer,
  onOpenIncidents,
  onResetVFS,
  onToggleSound,
  isSoundMuted = false,
  onSelectMission,
  onSelectTheme,
  missions,
  currentTheme = 'slate',
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'split-h',
      title: 'Split Terminal Horizontally',
      category: 'Terminal',
      icon: <Rows size={14} className="text-blue-400" />,
      run: onSplitHorizontal,
    },
    {
      id: 'split-v',
      title: 'Split Terminal Vertically',
      category: 'Terminal',
      icon: <Columns size={14} className="text-blue-400" />,
      run: onSplitVertical,
    },
    {
      id: 'explorer',
      title: 'Toggle Virtual File Explorer',
      category: 'Workspace',
      icon: <FolderTree size={14} className="text-blue-400" />,
      run: onToggleFileExplorer,
    },
    {
      id: 'monitor',
      title: 'Toggle System Telemetry Monitor',
      category: 'Workspace',
      icon: <Activity size={14} className="text-emerald-400" />,
      run: onToggleSystemMonitor,
    },
    {
      id: 'topology',
      title: 'Toggle Infrastructure Topology Map',
      category: 'Workspace',
      icon: <Network size={14} className="text-cyan-400" />,
      run: onToggleTopology,
    },
    {
      id: 'incidents',
      title: 'Open Break-Fix Incident Response Console',
      category: 'Operations',
      icon: <Flame size={14} className="text-rose-400" />,
      run: onOpenIncidents,
    },
    {
      id: 'sound',
      title: isSoundMuted ? 'Enable Terminal Audio SFX' : 'Mute Terminal Audio SFX',
      category: 'Preferences',
      icon: isSoundMuted ? (
        <VolumeX size={14} className="text-rose-400" />
      ) : (
        <Volume2 size={14} className="text-emerald-400" />
      ),
      run: onToggleSound,
    },
    {
      id: 'reset',
      title: 'Reset File System & Curriculum to Factory Defaults',
      category: 'System',
      icon: <RefreshCw size={14} className="text-rose-400" />,
      run: onResetVFS,
    },
  ];

  const themeItems = Object.values(THEMES).map((t) => ({
    id: `theme-${t.id}`,
    title: `Theme: ${t.name}${currentTheme === t.id ? ' (Active)' : ''} — ${t.tagline}`,
    category: 'Appearance',
    icon: <Palette size={14} style={{ color: t.accent }} />,
    run: () => onSelectTheme?.(t.id),
  }));

  const missionItems = missions.map((m) => ({
    id: `mission-${m.id}`,
    title: `Verify Mission: ${m.title} · ${m.difficulty}`,
    category: 'Curriculum',
    icon: m.completed ? (
      <CheckCircle2 size={14} className="text-emerald-400" />
    ) : (
      <Trophy size={14} className="text-amber-400" />
    ),
    run: () => onSelectMission?.(m.id),
  }));

  const allItems = [...actions, ...themeItems, ...missionItems];
  const q = query.toLowerCase().trim();
  const filtered = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? (filtered.length ? filtered.length - 1 : 0) : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected) {
        selected.run?.();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl flex flex-col rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border-strong)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Search Input Bar */}
        <div
          className="flex items-center gap-3 px-4 py-3 border-b"
          style={{
            background: 'var(--theme-elevated)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <Search size={16} style={{ color: 'var(--theme-accent)' }} className="shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, switch theme, or verify a mission..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-45"
            style={{ color: 'var(--theme-text)' }}
          />
          <kbd
            className="px-1.5 py-0.5 rounded border text-[10px] font-mono"
            style={{
              background: 'var(--theme-bg)',
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-muted)',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div
              className="p-8 text-center text-xs"
              style={{ color: 'var(--theme-muted)' }}
            >
              No matching commands, themes, or missions found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.run?.();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{
                    background: isSelected ? 'var(--theme-accent-soft)' : 'transparent',
                    color: isSelected ? 'var(--theme-text)' : 'var(--theme-text-secondary)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{item.icon}</div>
                    <span className="text-xs font-medium truncate">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pl-2">
                    <span
                      className="text-[11px] font-mono"
                      style={{ color: 'var(--theme-muted)' }}
                    >
                      {item.category}
                    </span>
                    {isSelected && (
                      <ChevronRight size={13} style={{ color: 'var(--theme-accent)' }} />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2 border-t text-[11px] font-mono"
          style={{
            background: 'var(--theme-tab-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-muted)',
          }}
        >
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>↵ Execute</span>
          </div>
          <span>LinuxSim Command Spotlight</span>
        </div>
      </div>
    </div>
  );
};
