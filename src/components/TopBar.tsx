import React, { useState, useEffect } from 'react';
import { Terminal, RefreshCw, BookOpen, User, FolderOpen } from 'lucide-react';

interface TopBarProps {
  cwd: string;
  onReset: () => void;
  onOpenCheatSheet: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ cwd, onReset, onOpenCheatSheet }) => {
  const [time, setTime] = useState(() => new Date());
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  const displayPath = cwd.replace('/home/user', '~');

  return (
    <div className="glass flex items-center h-9 px-4 z-10 select-none" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
      {/* Left side */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Terminal size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-blue-400">LinuxSim</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded" style={{ background: 'rgba(96,165,250,0.1)' }}>
          <FolderOpen size={12} className="text-blue-400/70" />
          <span className="text-xs text-slate-400 font-mono">{displayPath}</span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <User size={12} className="text-slate-500" />
          <span className="text-xs text-slate-400">user@linux-box</span>
        </div>

        <span className="text-xs text-slate-500 font-mono tabular-nums">{formatTime(time)}</span>

        <button
          onClick={handleReset}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors hover:bg-white/5"
          style={{ color: showResetConfirm ? '#f87171' : '#94a3b8' }}
          title={showResetConfirm ? 'Click again to confirm reset' : 'Reset File System'}
        >
          <RefreshCw size={12} />
          {showResetConfirm && <span className="text-red-400">Confirm?</span>}
        </button>

        <button
          onClick={onOpenCheatSheet}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
          title="Command Cheat Sheet"
        >
          <BookOpen size={12} />
        </button>
      </div>
    </div>
  );
};
