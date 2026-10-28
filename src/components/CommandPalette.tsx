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
  currentTheme: _currentTheme = 'slate',
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Define Quick Actions
  const actions = [
    {
      id: 'split-h',
      title: 'Split Terminal Horizontally',
      category: 'Terminal',
      icon: <Rows size={15} className="text-blue-400" />,
      run: onSplitHorizontal,
    },
    {
      id: 'split-v',
      title: 'Split Terminal Vertically',
      category: 'Terminal',
      icon: <Columns size={15} className="text-blue-400" />,
      run: onSplitVertical,
    },
    {
      id: 'topology',
      title: 'Open Network & Cluster Topology Map',
      category: 'Navigation',
      icon: <Network size={15} className="text-cyan-400" />,
      run: onToggleTopology,
    },
    {
      id: 'monitor',
      title: 'Open System Monitor GUI',
      category: 'Navigation',
      icon: <Activity size={15} className="text-emerald-400" />,
      run: onToggleSystemMonitor,
    },
    {
      id: 'explorer',
      title: 'Toggle File Explorer Panel',
      category: 'Navigation',
      icon: <FolderTree size={15} className="text-amber-400" />,
      run: onToggleFileExplorer,
    },
    {
      id: 'incidents',
      title: 'Open Break-Fix Incident Response Console',
      category: 'Missions & Labs',
      icon: <Flame size={15} className="text-rose-400" />,
      run: onOpenIncidents,
    },
    {
      id: 'sound',
      title: isSoundMuted ? 'Enable Audio SFX (Web Audio API)' : 'Mute Audio SFX',
      category: 'Audio',
      icon: isSoundMuted ? (
        <VolumeX size={15} className="text-rose-400" />
      ) : (
        <Volume2 size={15} className="text-emerald-400" />
      ),
      run: onToggleSound,
    },
    {
      id: 'reset',
      title: 'Reset File System to Factory State',
      category: 'System',
      icon: <RefreshCw size={15} className="text-rose-400" />,
      run: onResetVFS,
    },
  ];

  // Themes
  const themeItems = Object.values(THEMES).map((t) => ({
    id: `theme-${t.id}`,
    title: `Switch Theme to ${t.name}`,
    category: 'Themes',
    icon: <Palette size={15} className="text-purple-400" />,
    run: () => onSelectTheme?.(t.id),
  }));

  // Missions
  const missionItems = missions.map((m) => ({
    id: `mission-${m.id}`,
    title: `Mission: ${m.title} (${m.difficulty})`,
    category: 'Missions',
    icon: m.completed ? (
      <CheckCircle2 size={15} className="text-emerald-400" />
    ) : (
      <Trophy size={15} className="text-amber-400" />
    ),
    run: () => onSelectMission?.(m.id),
  }));

  // Filter items
  const allItems = [...actions, ...themeItems, ...missionItems];
  const q = query.toLowerCase().trim();
  const filtered = allItems.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
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
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl flex flex-col rounded-2xl bg-[#141624] border border-white/10 shadow-2xl overflow-hidden text-slate-200"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 bg-[#181a2c] border-b border-white/10">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, jump to mission, or change theme..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No matching commands or missions found for "{query}"
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
                  className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600/25 border border-blue-500/30 text-white'
                      : 'hover:bg-white/5 border border-transparent text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="shrink-0">{item.icon}</div>
                    <span className="text-xs font-medium truncate">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                      {item.category}
                    </span>
                    {isSelected && <ChevronRight size={14} className="text-blue-400" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#121420] border-t border-white/5 text-[11px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>LinuxSim Spotlight</span>
        </div>
      </div>
    </div>
  );
};
