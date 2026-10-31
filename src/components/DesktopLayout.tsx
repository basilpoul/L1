import React, { useState, useEffect, useCallback } from 'react';
import { TopBar, type RightPanelMode } from './TopBar';
import { TerminalWindow } from './TerminalWindow';
import { FileExplorerGUI } from './FileExplorerGUI';
import { SystemMonitorGUI } from './SystemMonitorGUI';
import { NetworkTopologyGUI } from './NetworkTopologyGUI';
import { MissionSidebar } from './MissionSidebar';
import { CheatSheetModal } from './CheatSheetModal';
import { IncidentModal } from './IncidentModal';
import { LabBuilderModal } from './LabBuilderModal';
import { getCustomMissions, convertCustomMissionToMission } from '../utils/customMissions';
import { CommandPalette } from './CommandPalette';
import { soundEngine } from '../utils/soundEngine';
import { useVFS } from '../hooks/useVFS';
import { useTerminal } from '../hooks/useTerminal';
import { useShellInit } from '../hooks/useShell';
import { useCronDaemon } from '../hooks/useCronDaemon';
import { missions as defaultMissions } from '../data/missions';
import { registry } from '../shell/commandRegistry';
import { getGitBranchInfo } from '../shell/commands/git';
import { THEMES, getThemeCSSVariables } from '../styles/themes';
import type { Mission, TerminalTheme } from '../types';
import {
  CheckCircle2,
  GitBranch,
  Terminal,
  Shield,
  Volume2,
  VolumeX,
  Trophy,
  FolderTree,
  Activity,
  Network,
} from 'lucide-react';

const MISSIONS_STORAGE_KEY = 'linux-sim-missions';

export const DesktopLayout: React.FC = () => {
  useShellInit();
  const { vfs, version, resetFileSystem, refresh } = useVFS();
  const terminal = useTerminal(vfs, refresh);
  useCronDaemon(vfs, refresh);

  // On desktop (>= 1024px) open File Explorer by default; on mobile/tablet start with full-screen terminal
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 1024 ? null : 'explorer'
  );
  const [isMissionSidebarOpen, setIsMissionSidebarOpen] = useState(false);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [isLabBuilderOpen, setIsLabBuilderOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(() => soundEngine.isMuted());
  const [celebrationToast, setCelebrationToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<TerminalTheme>(
    () => (localStorage.getItem('linuxsim_theme') as TerminalTheme) || 'slate'
  );

  useEffect(() => {
    const activeTheme = THEMES[theme] || THEMES.slate;
    document.body.style.backgroundColor = activeTheme.bg;
  }, [theme]);

  // Responsive mutually-exclusive panel toggles on mobile & tablet (< 1024px)
  const handleSelectRightPanel = useCallback((panel: RightPanelMode) => {
    setActiveRightPanel(panel);
    if (panel && typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMissionSidebarOpen(false);
    }
  }, []);

  const handleToggleMissionSidebar = useCallback(() => {
    setIsMissionSidebarOpen((prev) => {
      const next = !prev;
      if (next && typeof window !== 'undefined' && window.innerWidth < 1024) {
        setActiveRightPanel(null);
      }
      return next;
    });
  }, []);

  const loadAllMissions = useCallback((): Mission[] => {
    try {
      const saved = localStorage.getItem(MISSIONS_STORAGE_KEY);
      const savedCompleted: string[] = saved ? JSON.parse(saved) : [];
      const customList = getCustomMissions().map((cm) =>
        convertCustomMissionToMission(cm, savedCompleted.includes(cm.id))
      );
      const defaults = defaultMissions.map((m) => ({
        ...m,
        completed: savedCompleted.includes(m.id),
      }));
      return [...defaults, ...customList];
    } catch (e) {
      console.error('Failed to load saved missions', e);
      return defaultMissions;
    }
  }, []);

  const [missionsList, setMissionsList] = useState<Mission[]>(loadAllMissions);

  // Global Ctrl+K listener for Command Palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const saveMissionsState = (updated: Mission[]) => {
    try {
      const completedIds = updated.filter((m) => m.completed).map((m) => m.id);
      localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(completedIds));
    } catch (e) {
      console.error('Failed to save missions state', e);
    }
  };

  const handleCheckMission = useCallback(
    (missionId: string) => {
      const mission = missionsList.find((m) => m.id === missionId);
      if (!mission) return;

      const history = terminal.activeTab?.shellState.history || [];
      const isPassed = mission.validator(vfs, history);

      if (isPassed) {
        const updated = missionsList.map((m) =>
          m.id === missionId ? { ...m, completed: true } : m
        );
        setMissionsList(updated);
        saveMissionsState(updated);

        soundEngine.playSuccessChime();
        setCelebrationToast(`Mission verified: "${mission.title}"`);
        setTimeout(() => setCelebrationToast(null), 4000);
      } else {
        soundEngine.playBell();
        setCelebrationToast(
          `Requirements not yet satisfied for "${mission.title}". Check the hint.`
        );
        setTimeout(() => setCelebrationToast(null), 3000);
      }
    },
    [missionsList, terminal.activeTab, vfs]
  );

  // Auto-evaluate unfinished missions when VFS mutations or command history change
  useEffect(() => {
    const history = terminal.activeTab?.shellState.history || [];
    setMissionsList((prevMissions) => {
      let stateChanged = false;
      let newlyCompletedTitle: string | null = null;

      const updated = prevMissions.map((m) => {
        if (!m.completed) {
          const passed = m.validator(vfs, history);
          if (passed) {
            stateChanged = true;
            newlyCompletedTitle = m.title;
            return { ...m, completed: true };
          }
        }
        return m;
      });

      if (stateChanged) {
        saveMissionsState(updated);
        if (newlyCompletedTitle) {
          soundEngine.playSuccessChime();
          setCelebrationToast(`Completed mission: "${newlyCompletedTitle}"`);
          setTimeout(() => setCelebrationToast(null), 4000);
        }
        return updated;
      }
      return prevMissions;
    });
  }, [version, terminal.activeTab?.shellState.history, vfs]);

  const handleResetAll = () => {
    resetFileSystem();
    const resetList = loadAllMissions().map((m) => ({ ...m, completed: false }));
    setMissionsList(resetList);
    localStorage.removeItem(MISSIONS_STORAGE_KEY);
    setCelebrationToast('Virtual file system and curriculum reset to factory defaults.');
    setTimeout(() => setCelebrationToast(null), 3000);
  };

  const handleToggleSound = () => {
    const nextMuted = soundEngine.toggleMute();
    setIsSoundMuted(nextMuted);
  };

  const handleExplorerNavigate = (path: string) => {
    terminal.changeDirectory(path);
    refresh();
  };

  const handleExportVFS = () => {
    const jsonStr = vfs.exportSnapshot();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linuxsim-snapshot.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCelebrationToast('Exported VFS snapshot to linuxsim-snapshot.json');
    setTimeout(() => setCelebrationToast(null), 3000);
  };

  const handleImportVFS = (jsonString: string) => {
    const success = vfs.importSnapshot(jsonString);
    if (success) {
      refresh();
      setCelebrationToast('Imported VFS snapshot into active workspace.');
      setTimeout(() => setCelebrationToast(null), 3000);
    } else {
      setCelebrationToast('Snapshot import failed: invalid JSON format.');
      setTimeout(() => setCelebrationToast(null), 3000);
    }
  };

  const handleQuickRunCommand = (cmd: string) => {
    terminal.handleInput(cmd);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setActiveRightPanel(null);
      setIsMissionSidebarOpen(false);
    }
    setTimeout(() => terminal.handleSubmit(), 40);
  };

  const completedMissionsCount = missionsList.filter((m) => m.completed).length;
  const currentThemeObj = THEMES[theme] || THEMES.slate;
  const gitInfo = getGitBranchInfo(terminal.shellState.cwd, vfs);
  const isAnyOverlayOpen = isMissionSidebarOpen || activeRightPanel !== null;

  return (
    <div
      className="flex flex-col h-[100dvh] w-screen overflow-hidden select-none transition-colors duration-150"
      style={{
        ...getThemeCSSVariables(theme),
        background: 'var(--theme-bg)',
        color: 'var(--theme-text)',
      }}
    >
      {/* Unified IDE Workspace Top Header */}
      <TopBar
        cwd={terminal.shellState.cwd}
        currentUser={
          terminal.shellState.remoteSession
            ? `${terminal.shellState.remoteSession.user}@${terminal.shellState.remoteSession.hostname}`
            : `${terminal.shellState.env['USER'] || 'user'}@linux-box`
        }
        onReset={handleResetAll}
        onOpenCheatSheet={() => setIsCheatSheetOpen(true)}
        onExportVFS={handleExportVFS}
        onImportVFS={handleImportVFS}
        activeRightPanel={activeRightPanel}
        onSelectRightPanel={handleSelectRightPanel}
        isMissionSidebarOpen={isMissionSidebarOpen}
        onToggleMissionSidebar={handleToggleMissionSidebar}
        completedMissionsCount={completedMissionsCount}
        totalMissionsCount={missionsList.length}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onToggleSound={handleToggleSound}
        isSoundMuted={isSoundMuted}
        theme={theme}
        onThemeChange={(t) => {
          setTheme(t);
          localStorage.setItem('linuxsim_theme', t);
        }}
        onOpenIncidents={() => setIsIncidentModalOpen(true)}
      />

      {/* Main Split / Slide-Over Workspace */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* Tablet Backdrop Scrim when a slide-over drawer is open (< 1024px) */}
        {isAnyOverlayOpen && (
          <div
            onClick={() => {
              setIsMissionSidebarOpen(false);
              setActiveRightPanel(null);
            }}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-20 lg:hidden animate-fadeIn"
            aria-hidden="true"
          />
        )}

        {/* Left Curriculum Drawer (Full sheet on Mobile, Slide-over on Tablet, Docked on Desktop) */}
        <MissionSidebar
          missions={missionsList}
          onCheckMission={handleCheckMission}
          isOpen={isMissionSidebarOpen}
          onToggle={handleToggleMissionSidebar}
          onOpenLabBuilder={() => setIsLabBuilderOpen(true)}
        />

        {/* Central Multiplexed Terminal Workspace */}
        <main className="flex-1 flex flex-col min-w-0 h-full relative z-10">
          <TerminalWindow
            tabs={terminal.tabs}
            activeTabId={terminal.activeTabId}
            inputValue={terminal.inputValue}
            onInput={(val) => {
              soundEngine.playKeyTick();
              terminal.handleInput(val);
            }}
            onSubmit={terminal.handleSubmit}
            onKeyDown={(e) => {
              if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                soundEngine.playKeyTick();
              }
              terminal.handleKeyDown(e);
            }}
            onAddTab={terminal.addTab}
            onCloseTab={terminal.closeTab}
            onSetActiveTab={terminal.switchTab}
            onSplitTab={terminal.splitTab}
            onClosePane={terminal.closePane}
            onSetActivePane={terminal.setActivePane}
            onClearStreaming={(paneId) => terminal.setStreamingState(paneId, null)}
            nanoState={terminal.getNanoState()}
            onNanoSave={terminal.saveNano}
            onNanoExit={terminal.exitNano}
            onNanoContentChange={(c) => {
              const state = terminal.getNanoState();
              if (state) {
                terminal.setNanoState({ ...state, content: c, modified: true });
              }
            }}
            vimState={terminal.getVimState()}
            onVimSave={terminal.saveVim}
            onVimExit={terminal.exitVim}
            shellState={terminal.shellState}
            isRunning={terminal.isRunning}
            vfs={vfs}
            theme={theme}
            onQuickCommand={handleQuickRunCommand}
          />
        </main>

        {/* Right Inspector Panel (Full sheet on Mobile, Slide-over on Tablet, Docked on Desktop) */}
        {activeRightPanel && (
          <aside className="fixed inset-x-0 top-12 bottom-14 md:top-11 md:bottom-6 md:left-auto md:right-0 md:w-96 lg:relative lg:inset-auto lg:w-88 xl:w-96 lg:h-full flex flex-col shrink-0 z-30 lg:z-20 shadow-2xl lg:shadow-none animate-fadeIn">
            {activeRightPanel === 'topology' ? (
              <NetworkTopologyGUI
                onClose={() => setActiveRightPanel(null)}
                onRunCommand={handleQuickRunCommand}
                vfs={vfs}
              />
            ) : activeRightPanel === 'monitor' ? (
              <SystemMonitorGUI
                onClose={() => setActiveRightPanel(null)}
                onRefreshVFS={refresh}
              />
            ) : (
              <FileExplorerGUI
                vfs={vfs}
                version={version}
                cwd={terminal.shellState.cwd}
                onNavigate={handleExplorerNavigate}
                onOpenNano={(path) => {
                  terminal.openInNano(path);
                  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                    setActiveRightPanel(null);
                  }
                }}
                onRefresh={refresh}
                onClose={() => setActiveRightPanel(null)}
              />
            )}
          </aside>
        )}
      </div>

      {/* Mobile Touch-First Bottom Navigation Bar (< 768px) */}
      <nav
        className="grid md:hidden grid-cols-5 items-center h-14 border-t shrink-0 z-40 select-none"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-secondary)',
        }}
        aria-label="Mobile Workspace Navigation"
      >
        <button
          onClick={() => {
            setIsMissionSidebarOpen(false);
            setActiveRightPanel(null);
          }}
          className="flex flex-col items-center justify-center min-h-[44px] h-full transition-colors"
          style={{
            color:
              !isMissionSidebarOpen && activeRightPanel === null
                ? 'var(--theme-accent)'
                : 'var(--theme-text-secondary)',
          }}
        >
          <Terminal size={17} />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
            Terminal
          </span>
        </button>

        <button
          onClick={handleToggleMissionSidebar}
          className="flex flex-col items-center justify-center min-h-[44px] h-full transition-colors"
          style={{
            color: isMissionSidebarOpen ? '#fbbf24' : 'var(--theme-text-secondary)',
          }}
        >
          <Trophy size={17} />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap tabular-nums">
            Labs ({completedMissionsCount}/{missionsList.length})
          </span>
        </button>

        <button
          onClick={() =>
            handleSelectRightPanel(activeRightPanel === 'explorer' ? null : 'explorer')
          }
          className="flex flex-col items-center justify-center min-h-[44px] h-full transition-colors"
          style={{
            color:
              activeRightPanel === 'explorer'
                ? 'var(--theme-dir)'
                : 'var(--theme-text-secondary)',
          }}
        >
          <FolderTree size={17} />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
            Files
          </span>
        </button>

        <button
          onClick={() =>
            handleSelectRightPanel(activeRightPanel === 'monitor' ? null : 'monitor')
          }
          className="flex flex-col items-center justify-center min-h-[44px] h-full transition-colors"
          style={{
            color:
              activeRightPanel === 'monitor' ? '#34d399' : 'var(--theme-text-secondary)',
          }}
        >
          <Activity size={17} />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
            Monitor
          </span>
        </button>

        <button
          onClick={() =>
            handleSelectRightPanel(activeRightPanel === 'topology' ? null : 'topology')
          }
          className="flex flex-col items-center justify-center min-h-[44px] h-full transition-colors"
          style={{
            color:
              activeRightPanel === 'topology' ? '#22d3ee' : 'var(--theme-text-secondary)',
          }}
        >
          <Network size={17} />
          <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
            Topology
          </span>
        </button>
      </nav>

      {/* Tablet & Desktop Linear-Style Bottom Workspace Status Bar (>= 768px) */}
      <footer
        className="hidden md:flex items-center justify-between h-6 px-3.5 text-[11px] border-t shrink-0 select-none z-40"
        style={{
          background: 'var(--theme-tab-bg)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-secondary)',
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-flex items-center gap-1.5 font-mono"
            style={{ color: 'var(--theme-user)' }}
          >
            <Terminal size={11} />
            <span>
              {terminal.shellState.remoteSession
                ? `SSH · ${terminal.shellState.remoteSession.hostname}`
                : 'LOCAL · bash 5.2'}
            </span>
          </span>

          <span className="opacity-30">·</span>

          <span className="font-mono truncate" style={{ color: 'var(--theme-dir)' }}>
            {terminal.shellState.cwd.replace('/home/user', '~')}
          </span>

          {gitInfo && (
            <>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-1 font-mono text-purple-400">
                <GitBranch size={11} />
                <span>
                  {gitInfo.branch}
                  {gitInfo.isDirty ? '*' : ''}
                </span>
              </span>
            </>
          )}

          {terminal.shellState.isRoot && (
            <>
              <span className="opacity-30">·</span>
              <span className="inline-flex items-center gap-1 font-mono text-amber-400">
                <Shield size={11} />
                <span>sudo:root</span>
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0 font-mono text-[10px]">
          <span className="hidden lg:inline opacity-75">
            Theme: <strong style={{ color: 'var(--theme-text)' }}>{currentThemeObj.name}</strong>
          </span>
          <span className="hidden lg:inline opacity-30">·</span>
          <button
            onClick={handleToggleSound}
            className="inline-flex items-center gap-1 hover:opacity-100 opacity-75 transition-opacity"
          >
            {isSoundMuted ? <VolumeX size={10} /> : <Volume2 size={10} />}
            <span>{isSoundMuted ? 'SFX Off' : 'SFX On'}</span>
          </button>
          <span className="opacity-30">·</span>
          <span className="tabular-nums">
            Curriculum:{' '}
            <strong style={{ color: 'var(--theme-user)' }}>
              {completedMissionsCount}/{missionsList.length}
            </strong>
          </span>
        </div>
      </footer>

      {/* Sleek Slide-Down Notification Toast */}
      {celebrationToast && (
        <div
          className="fixed top-14 left-1/2 z-50 flex items-center gap-2.5 px-4 py-2 rounded-lg border text-xs font-medium shadow-2xl animate-slideDown max-w-[92vw]"
          style={{
            background: 'var(--theme-elevated)',
            borderColor: 'var(--theme-border-strong)',
            color: 'var(--theme-text)',
          }}
        >
          <CheckCircle2 size={15} style={{ color: 'var(--theme-user)' }} className="shrink-0" />
          <span className="truncate">{celebrationToast}</span>
        </div>
      )}

      {/* Command Reference Modal */}
      <CheatSheetModal
        isOpen={isCheatSheetOpen}
        onClose={() => setIsCheatSheetOpen(false)}
        commands={registry.getAll()}
      />

      {/* Break-Fix Incident Simulator Modal */}
      <IncidentModal
        isOpen={isIncidentModalOpen}
        onClose={() => setIsIncidentModalOpen(false)}
        vfs={vfs}
        onRefresh={refresh}
        history={terminal.activeTab?.shellState.history || []}
      />

      {/* Command Palette Modal (Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSplitHorizontal={() => terminal.splitTab('horizontal')}
        onSplitVertical={() => terminal.splitTab('vertical')}
        onToggleTopology={() =>
          handleSelectRightPanel(activeRightPanel === 'topology' ? null : 'topology')
        }
        onToggleSystemMonitor={() =>
          handleSelectRightPanel(activeRightPanel === 'monitor' ? null : 'monitor')
        }
        onToggleFileExplorer={() =>
          handleSelectRightPanel(activeRightPanel === 'explorer' ? null : 'explorer')
        }
        onOpenIncidents={() => setIsIncidentModalOpen(true)}
        onResetVFS={handleResetAll}
        onToggleSound={handleToggleSound}
        isSoundMuted={isSoundMuted}
        onSelectMission={(id) => handleCheckMission(id)}
        onSelectTheme={(t) => {
          setTheme(t);
          localStorage.setItem('linuxsim_theme', t);
        }}
        missions={missionsList}
        currentTheme={theme}
      />

      {/* Custom Lab Builder Modal */}
      <LabBuilderModal
        isOpen={isLabBuilderOpen}
        onClose={() => setIsLabBuilderOpen(false)}
        onMissionsUpdated={() => setMissionsList(loadAllMissions())}
      />
    </div>
  );
};
