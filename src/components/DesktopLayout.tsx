import React, { useState, useEffect, useCallback } from 'react';
import { TopBar } from './TopBar';
import { TerminalWindow } from './TerminalWindow';
import { FileExplorerGUI } from './FileExplorerGUI';
import { SystemMonitorGUI } from './SystemMonitorGUI';
import { MissionSidebar } from './MissionSidebar';
import { CheatSheetModal } from './CheatSheetModal';
import { useVFS } from '../hooks/useVFS';
import { useTerminal } from '../hooks/useTerminal';
import { useShellInit } from '../hooks/useShell';
import { useCronDaemon } from '../hooks/useCronDaemon';
import { missions as defaultMissions } from '../data/missions';
import { registry } from '../shell/commandRegistry';
import type { Mission } from '../types';
import { FolderTree, Sparkles, Trophy, PanelRightClose, PanelRightOpen, Activity } from 'lucide-react';

const MISSIONS_STORAGE_KEY = 'linux-sim-missions';

export const DesktopLayout: React.FC = () => {
  useShellInit();
  const { vfs, version, resetFileSystem, refresh } = useVFS();
  const terminal = useTerminal(vfs, refresh);
  useCronDaemon(vfs, refresh);

  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(true);
  const [isSystemMonitorOpen, setIsSystemMonitorOpen] = useState(false);
  const [isMissionSidebarOpen, setIsMissionSidebarOpen] = useState(false);
  const [isCheatSheetOpen, setIsCheatSheetOpen] = useState(false);
  const [celebrationToast, setCelebrationToast] = useState<string | null>(null);

  // Load missions from localStorage or use defaults
  const [missionsList, setMissionsList] = useState<Mission[]>(() => {
    try {
      const saved = localStorage.getItem(MISSIONS_STORAGE_KEY);
      if (saved) {
        const savedCompleted: string[] = JSON.parse(saved);
        return defaultMissions.map((m) => ({
          ...m,
          completed: savedCompleted.includes(m.id),
        }));
      }
    } catch (e) {
      console.error('Failed to load saved missions', e);
    }
    return defaultMissions;
  });

  // Save completed missions
  const saveMissionsState = (updated: Mission[]) => {
    try {
      const completedIds = updated.filter((m) => m.completed).map((m) => m.id);
      localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(completedIds));
    } catch (e) {
      console.error('Failed to save missions state', e);
    }
  };

  // Check a single mission
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

        setCelebrationToast(`🎉 Completed: "${mission.title}"!`);
        setTimeout(() => setCelebrationToast(null), 4000);
      } else {
        setCelebrationToast(`❌ Mission requirements not yet met. Check the hint!`);
        setTimeout(() => setCelebrationToast(null), 3000);
      }
    },
    [missionsList, terminal.activeTab, vfs]
  );

  // Also auto-evaluate unfinished missions when version (VFS mutations) or history changes
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
          setCelebrationToast(`🎉 Completed: "${newlyCompletedTitle}"!`);
          setTimeout(() => setCelebrationToast(null), 4000);
        }
        return updated;
      }
      return prevMissions;
    });
  }, [version, terminal.activeTab?.shellState.history, vfs]);

  const handleResetAll = () => {
    resetFileSystem();
    const resetList = defaultMissions.map((m) => ({ ...m, completed: false }));
    setMissionsList(resetList);
    localStorage.removeItem(MISSIONS_STORAGE_KEY);
    setCelebrationToast('🔄 File system and missions reset to defaults.');
    setTimeout(() => setCelebrationToast(null), 3000);
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
    setCelebrationToast('💾 Exported VFS snapshot to linuxsim-snapshot.json');
    setTimeout(() => setCelebrationToast(null), 3000);
  };

  const handleImportVFS = (jsonString: string) => {
    const success = vfs.importSnapshot(jsonString);
    if (success) {
      refresh();
      setCelebrationToast('📥 Successfully imported VFS snapshot!');
      setTimeout(() => setCelebrationToast(null), 3000);
    } else {
      setCelebrationToast('❌ Failed to import snapshot: Invalid JSON format');
      setTimeout(() => setCelebrationToast(null), 3000);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0f111a] text-slate-100 select-none">
      {/* Top Status Bar */}
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
        onToggleSystemMonitor={() => {
          setIsSystemMonitorOpen((prev) => {
            const next = !prev;
            if (next) setIsFileExplorerOpen(false);
            return next;
          });
        }}
        isSystemMonitorOpen={isSystemMonitorOpen}
      />

      {/* Main Workspace */}
      <div className="relative flex flex-1 h-[calc(100vh-36px)] overflow-hidden">
        {/* Missions Drawer on Left */}
        <MissionSidebar
          missions={missionsList}
          onCheckMission={handleCheckMission}
          isOpen={isMissionSidebarOpen}
          onToggle={() => setIsMissionSidebarOpen((prev) => !prev)}
        />

        {/* Central Terminal Emulator */}
        <main className="flex-1 flex flex-col min-w-0 h-full relative">
          <TerminalWindow
            tabs={terminal.tabs}
            activeTabId={terminal.activeTabId}
            inputValue={terminal.inputValue}
            onInput={terminal.handleInput}
            onSubmit={terminal.handleSubmit}
            onKeyDown={terminal.handleKeyDown}
            onAddTab={terminal.addTab}
            onCloseTab={terminal.closeTab}
            onSetActiveTab={terminal.switchTab}
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
          />

          {/* Bottom Dock / Fast Access buttons */}
          <div className="absolute bottom-3 right-4 z-10 flex items-center gap-2">
            {!isMissionSidebarOpen && (
              <button
                onClick={() => setIsMissionSidebarOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1a1d2e]/90 hover:bg-[#23273e] text-xs font-medium text-amber-400 border border-amber-500/20 backdrop-blur-md shadow-xl transition-all hover:scale-105"
              >
                <Trophy size={14} />
                <span>Missions</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-[10px] font-mono">
                  {missionsList.filter((m) => m.completed).length}/{missionsList.length}
                </span>
              </button>
            )}

            <button
              onClick={() => {
                setIsSystemMonitorOpen((prev) => {
                  const next = !prev;
                  if (next) setIsFileExplorerOpen(false);
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border backdrop-blur-md shadow-xl transition-all hover:scale-105 ${
                isSystemMonitorOpen
                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40'
                  : 'bg-[#1a1d2e]/90 hover:bg-[#23273e] text-emerald-400 border-emerald-500/20'
              }`}
              title={isSystemMonitorOpen ? 'Hide System Monitor' : 'Show System Monitor'}
            >
              <Activity size={14} />
              <span>Monitor</span>
            </button>

            <button
              onClick={() => {
                setIsFileExplorerOpen((prev) => {
                  const next = !prev;
                  if (next) setIsSystemMonitorOpen(false);
                  return next;
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border backdrop-blur-md shadow-xl transition-all hover:scale-105 ${
                isFileExplorerOpen
                  ? 'bg-blue-500/25 text-blue-300 border-blue-500/40'
                  : 'bg-[#1a1d2e]/90 hover:bg-[#23273e] text-blue-400 border-blue-500/20'
              }`}
              title={isFileExplorerOpen ? 'Hide File Explorer' : 'Show File Explorer'}
            >
              <FolderTree size={14} />
              <span>Explorer</span>
              {isFileExplorerOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </main>

        {/* Right Split Panel: Synchronized File Explorer or System Monitor */}
        {(isFileExplorerOpen || isSystemMonitorOpen) && (
          <aside className="w-80 sm:w-96 h-full flex flex-col shrink-0 relative transition-all duration-300">
            {isSystemMonitorOpen ? (
              <SystemMonitorGUI
                onClose={() => setIsSystemMonitorOpen(false)}
                onRefreshVFS={refresh}
              />
            ) : (
              <FileExplorerGUI
                vfs={vfs}
                version={version}
                cwd={terminal.shellState.cwd}
                onNavigate={handleExplorerNavigate}
                onOpenNano={(path) => terminal.openInNano(path)}
                onRefresh={refresh}
              />
            )}
          </aside>
        )}
      </div>

      {/* Floating Celebration Toast */}
      {celebrationToast && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#181b2e] border border-emerald-500/40 text-emerald-300 text-xs font-medium shadow-2xl animate-bounce">
          <Sparkles size={16} className="text-amber-400 shrink-0" />
          <span>{celebrationToast}</span>
        </div>
      )}

      {/* Cheat Sheet Modal */}
      <CheatSheetModal
        isOpen={isCheatSheetOpen}
        onClose={() => setIsCheatSheetOpen(false)}
        commands={registry.getAll()}
      />
    </div>
  );
};
