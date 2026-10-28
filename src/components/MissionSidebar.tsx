import React, { useState } from 'react';
import {
  Trophy,
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Sparkles,
  Award,
  Plus,
} from 'lucide-react';
import type { Mission } from '../types';

interface MissionSidebarProps {
  missions: Mission[];
  onCheckMission: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  onOpenLabBuilder?: () => void;
}

export const MissionSidebar: React.FC<MissionSidebarProps> = ({
  missions,
  onCheckMission,
  isOpen,
  onToggle,
  onOpenLabBuilder,
}) => {
  const [filter, setFilter] = useState<'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master' | 'architect' | 'cloud-native'>('all');
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});

  const completedCount = missions.filter((m) => m.completed).length;
  const totalCount = missions.length;
  const progressPercent = Math.round((completedCount / (totalCount || 1)) * 100);

  const filteredMissions = missions.filter((m) => {
    if (filter === 'all') return true;
    return m.difficulty === filter;
  });

  const toggleHint = (id: string) => {
    setExpandedHints((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const getDifficultyColor = (difficulty: Mission['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'intermediate':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'advanced':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'expert':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
      case 'master':
        return 'text-violet-400 bg-violet-500/10 border-violet-500/20';
      case 'architect':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
      case 'cloud-native':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      default:
        return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
  };

  return (
    <aside
      className={`relative flex flex-col h-full bg-[#11131f] border-r border-white/5 transition-all duration-300 z-20 ${
        isOpen ? 'w-84 sm:w-96' : 'w-0'
      }`}
    >
      {/* External toggle button attached to edge */}
      <button
        onClick={onToggle}
        className="absolute -right-7 top-14 z-30 flex items-center justify-center w-7 h-8 bg-[#181a29] border border-l-0 border-white/10 rounded-r-md text-slate-400 hover:text-white hover:bg-[#202336] transition-colors shadow-lg"
        title={isOpen ? 'Collapse Missions' : 'Open Practice Missions'}
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {isOpen && (
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Header */}
          <div className="p-3.5 border-b border-white/5 bg-[#141624]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Trophy size={16} />
                </div>
                <div>
                  <h2 className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
                    Linux Missions
                  </h2>
                  <p className="text-[11px] text-slate-400">Interactive curriculum</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onOpenLabBuilder && (
                  <button
                    onClick={onOpenLabBuilder}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-[11px] font-medium transition-all"
                    title="Design a Custom Mission"
                  >
                    <Plus size={11} />
                    <span>Custom</span>
                  </button>
                )}
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-emerald-400">
                  <Award size={12} />
                  <span>
                    {completedCount}/{totalCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>Curriculum Progress</span>
                <span className="font-mono">{progressPercent}%</span>
              </div>
              <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Difficulty Tabs */}
            <div className="flex gap-1 mt-3 p-0.5 bg-black/20 rounded-lg border border-white/5 text-[10px] overflow-x-auto scrollbar-none">
              {(['all', 'beginner', 'intermediate', 'advanced', 'expert', 'master', 'architect', 'cloud-native'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`flex-1 py-1 px-1 rounded capitalize transition-all whitespace-nowrap ${
                    filter === tab
                      ? 'bg-blue-600/30 text-blue-400 font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {tab === 'cloud-native' ? 'Cloud' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Mission Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
            {filteredMissions.map((mission) => {
              const isHintOpen = !!expandedHints[mission.id];

              return (
                <div
                  key={mission.id}
                  className={`group relative p-3 rounded-xl border transition-all duration-200 ${
                    mission.completed
                      ? 'bg-emerald-950/15 border-emerald-500/20 hover:border-emerald-500/30'
                      : 'bg-[#151726]/80 border-white/5 hover:border-white/10 hover:bg-[#181a2c]'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {mission.completed ? (
                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <Circle size={16} className="text-slate-600 shrink-0 mt-0.5" />
                      )}
                      <h3
                        className={`text-xs font-semibold leading-tight ${
                          mission.completed ? 'text-emerald-200 line-through opacity-80' : 'text-slate-200'
                        }`}
                      >
                        {mission.title}
                      </h3>
                    </div>

                    <span
                      className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border capitalize shrink-0 ${getDifficultyColor(
                        mission.difficulty
                      )}`}
                    >
                      {mission.difficulty}
                    </span>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-slate-400 pl-6 leading-relaxed mb-2.5">
                    {mission.description}
                  </p>

                  {/* Actions & Hint */}
                  <div className="flex items-center justify-between pl-6 pt-1 border-t border-white/5">
                    <button
                      onClick={() => toggleHint(mission.id)}
                      className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400 transition-colors"
                    >
                      <HelpCircle size={12} />
                      <span>{isHintOpen ? 'Hide hint' : 'Hint'}</span>
                    </button>

                    <button
                      onClick={() => onCheckMission(mission.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        mission.completed
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                          : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 hover:shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                      }`}
                    >
                      <Sparkles size={11} />
                      <span>{mission.completed ? 'Re-verify' : 'Validate'}</span>
                    </button>
                  </div>

                  {/* Collapsible Hint */}
                  {isHintOpen && (
                    <div className="mt-2.5 pl-6">
                      <div className="p-2 rounded bg-black/40 border border-amber-500/20 text-[11px] text-amber-300/90 font-mono">
                        💡 {mission.hint}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};
