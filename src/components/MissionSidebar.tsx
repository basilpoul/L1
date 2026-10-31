import React, { useState } from 'react';
import {
  Trophy,
  CheckCircle2,
  Circle,
  HelpCircle,
  Plus,
  X,
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
  const [filter, setFilter] = useState<
    'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master' | 'architect' | 'cloud-native'
  >('all');
  const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

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

  const getDifficultyTextColor = (difficulty: Mission['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-emerald-400';
      case 'intermediate':
        return 'text-amber-400';
      case 'advanced':
        return 'text-rose-400';
      case 'expert':
        return 'text-purple-400';
      case 'master':
        return 'text-violet-400';
      case 'architect':
        return 'text-cyan-400';
      case 'cloud-native':
        return 'text-sky-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <aside
      className="fixed inset-x-0 top-12 bottom-14 md:top-11 md:bottom-6 md:right-auto md:left-0 md:w-96 lg:relative lg:inset-auto lg:w-88 xl:w-96 lg:h-full flex flex-col border-r shrink-0 z-30 lg:z-20 shadow-2xl lg:shadow-none select-none animate-fadeIn"
      style={{
        background: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
    >
      {/* Curriculum Header */}
      <div
        className="p-3.5 border-b space-y-3"
        style={{
          background: 'var(--theme-tab-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-amber-400" />
            <span className="text-xs font-semibold tracking-tight">Interactive Curriculum</span>
            <span className="opacity-30">·</span>
            <span className="text-xs font-mono tabular-nums text-emerald-400">
              {completedCount}/{totalCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenLabBuilder && (
              <button
                onClick={onOpenLabBuilder}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border transition-colors hover:bg-white/[0.06]"
                style={{
                  borderColor: 'var(--theme-border-strong)',
                  color: 'var(--theme-text)',
                }}
                title="Create Custom Lab Mission"
              >
                <Plus size={11} style={{ color: 'var(--theme-accent)' }} />
                <span>New Lab</span>
              </button>
            )}
            <button
              onClick={onToggle}
              className="p-1 rounded-md opacity-60 hover:opacity-100 hover:bg-white/[0.06]"
              title="Close Curriculum Drawer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Linear-Style Progress Bar */}
        <div>
          <div
            className="flex justify-between text-[11px] mb-1.5"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            <span>Mastery Progress</span>
            <span className="font-mono tabular-nums">{progressPercent}%</span>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ background: 'var(--theme-bg)' }}
          >
            <div
              className="h-full transition-all duration-300 rounded-full"
              style={{
                width: `${progressPercent}%`,
                background: 'var(--theme-accent)',
              }}
            />
          </div>
        </div>

        {/* Segmented Difficulty Filter Tabs */}
        <div
          className="flex gap-1 p-0.5 rounded-lg border text-[11px] overflow-x-auto"
          style={{
            background: 'var(--theme-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {(
            [
              'all',
              'beginner',
              'intermediate',
              'advanced',
              'expert',
              'master',
              'architect',
              'cloud-native',
            ] as const
          ).map((tab) => {
            const isActive = filter === tab;
            return (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`py-1 px-2 rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                  isActive ? 'bg-white/[0.09] text-white font-medium' : 'hover:text-white'
                }`}
                style={!isActive ? { color: 'var(--theme-text-secondary)' } : undefined}
              >
                {tab === 'cloud-native' ? 'Cloud' : tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mission Cards List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        {filteredMissions.map((mission, idx) => {
          const isHintOpen = !!expandedHints[mission.id];

          return (
            <div
              key={mission.id}
              className="p-3.5 rounded-xl border transition-all"
              style={{
                background: mission.completed
                  ? 'rgba(16, 185, 129, 0.05)'
                  : 'var(--theme-card-bg)',
                borderColor: mission.completed
                  ? 'rgba(16, 185, 129, 0.25)'
                  : 'var(--theme-border)',
              }}
            >
              {/* Clean Unboxed Kicker Metadata */}
              <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="tabular-nums opacity-50">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="opacity-30">·</span>
                  <span className={`capitalize ${getDifficultyTextColor(mission.difficulty)}`}>
                    {mission.difficulty}
                  </span>
                  {mission.completed && (
                    <>
                      <span className="opacity-30">·</span>
                      <span className="text-emerald-400">Verified</span>
                    </>
                  )}
                </div>
              </div>

              {/* Mission Title */}
              <div className="flex items-start gap-2 mb-1.5">
                {mission.completed ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <Circle
                    size={15}
                    className="shrink-0 mt-0.5 opacity-40"
                    style={{ color: 'var(--theme-text-secondary)' }}
                  />
                )}
                <h3
                  className={`text-xs font-semibold leading-snug ${
                    mission.completed ? 'line-through opacity-75' : ''
                  }`}
                >
                  {mission.title}
                </h3>
              </div>

              {/* Description */}
              <p
                className="text-xs pl-6 leading-relaxed mb-3"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                {mission.description}
              </p>

              {/* Actions Row */}
              <div
                className="flex items-center justify-between pl-6 pt-2 border-t"
                style={{ borderColor: 'var(--theme-border)' }}
              >
                <button
                  onClick={() => toggleHint(mission.id)}
                  className="flex items-center gap-1 text-[11px] hover:underline transition-colors"
                  style={{ color: 'var(--theme-text-secondary)' }}
                >
                  <HelpCircle size={12} />
                  <span>{isHintOpen ? 'Hide hint' : 'Show hint'}</span>
                </button>

                <button
                  onClick={() => onCheckMission(mission.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                    mission.completed
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/20'
                      : 'hover:bg-white/[0.08]'
                  }`}
                  style={
                    !mission.completed
                      ? {
                          background: 'var(--theme-accent-soft)',
                          borderColor: 'var(--theme-border-strong)',
                          color: 'var(--theme-text)',
                        }
                      : undefined
                  }
                >
                  {mission.completed ? 'Re-verify' : 'Verify Task'}
                </button>
              </div>

              {/* Collapsible Hint */}
              {isHintOpen && (
                <div className="mt-2.5 pl-6 animate-fadeIn">
                  <div
                    className="p-2.5 rounded-lg border text-[11px] font-mono leading-relaxed"
                    style={{
                      background: 'var(--theme-bg)',
                      borderColor: 'var(--theme-border-strong)',
                      color: 'var(--theme-text)',
                    }}
                  >
                    <span className="text-amber-400 font-sans font-semibold mr-1.5">Hint:</span>
                    {mission.hint}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
