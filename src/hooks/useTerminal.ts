import { useState, useCallback, useRef } from 'react';
import type { TerminalTab, TerminalLine, ShellState, NanoState, VimState, TerminalPane, StreamingState } from '../types';
import { VirtualFileSystem } from '../vfs/fileSystem';
import { executeCommand, getCompletions } from '../shell/executor';
import { createDefaultEnv } from '../shell/environment';
import { getGitBranchInfo } from '../shell/commands/git';

function genId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function applyBashrc(shellState: ShellState, vfs: VirtualFileSystem) {
  const bashrc = vfs.getNode('/home/user/.bashrc', true);
  if (!bashrc || !bashrc.content) return;
  const lines = bashrc.content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // alias name='val' or alias name="val"
    const aliasMatch = trimmed.match(/^alias\s+([A-Za-z0-9_-]+)=['"]?(.*?)['"]?$/);
    if (aliasMatch) {
      shellState.aliases[aliasMatch[1]] = aliasMatch[2];
      continue;
    }
    // export VAR=val or export VAR="val"
    const exportMatch = trimmed.match(/^export\s+([A-Za-z0-9_]+)=['"]?(.*?)['"]?$/);
    if (exportMatch) {
      shellState.env[exportMatch[1]] = exportMatch[2];
      continue;
    }
  }
}

function createShellState(): ShellState {
  return {
    cwd: '/home/user',
    env: createDefaultEnv(),
    history: [],
    aliases: { ll: 'ls -la', la: 'ls -a' },
    lastExitCode: 0,
    previousDir: '/home/user',
    isRoot: false,
    jobs: [],
  };
}

function createTab(index: number, vfs?: VirtualFileSystem): TerminalTab {
  const shellState = createShellState();
  if (vfs) {
    applyBashrc(shellState, vfs);
  }
  const id = genId();
  const paneId = genId();
  const initialLines: TerminalLine[] = [
    {
      id: genId(),
      type: 'system' as const,
      content: 'Welcome to LinuxSim — a browser-based Linux terminal simulator.',
      timestamp: new Date(),
    },
    {
      id: genId(),
      type: 'system' as const,
      content: 'Type "help" to see available commands or try "neofetch" to get started.',
      timestamp: new Date(),
    },
  ];

  const primaryPane: TerminalPane = {
    id: paneId,
    lines: [...initialLines],
    shellState,
    isRunning: false,
    nanoState: null,
    vimState: null,
    streamingState: null,
  };

  return {
    id,
    title: `Terminal ${index}`,
    lines: initialLines,
    shellState,
    isRunning: false,
    nanoState: null,
    vimState: null,
    panes: [primaryPane],
    activePaneId: paneId,
    splitDirection: null,
  };
}

export function useTerminal(vfs: VirtualFileSystem, refreshVFS: () => void) {
  const [tabs, setTabs] = useState<TerminalTab[]>(() => [createTab(1, vfs)]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0].id);
  const [inputValue, setInputValue] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const tabCounterRef = useRef(1);
  const ctrlCHandlerRef = useRef<(() => void) | null>(null);

  const getActiveTab = useCallback((): TerminalTab | undefined => {
    return tabs.find(t => t.id === activeTabId);
  }, [tabs, activeTabId]);

  const addLine = useCallback((type: 'input' | 'output' | 'error' | 'system', content: string, html?: boolean) => {
    const newLine: TerminalLine = {
      id: genId(),
      type,
      content,
      html,
      timestamp: new Date(),
    };
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const targetPaneId = t.activePaneId || t.panes?.[0]?.id;
      const updatedPanes = (t.panes || []).map(p => {
        if (p.id !== targetPaneId) return p;
        return { ...p, lines: [...p.lines, newLine] };
      });
      return { ...t, lines: [...t.lines, newLine], panes: updatedPanes };
    }));
  }, [activeTabId]);

  const addTab = useCallback(() => {
    tabCounterRef.current++;
    const newTab = createTab(tabCounterRef.current, vfs);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setInputValue('');
    setHistoryIndex(-1);
  }, [vfs]);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter(t => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
  }, [activeTabId]);

  const switchTab = useCallback((id: string) => {
    setActiveTabId(id);
    setInputValue('');
    setHistoryIndex(-1);
  }, []);

  const splitTab = useCallback((direction: 'horizontal' | 'vertical') => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const existingPanes = t.panes && t.panes.length > 0 ? t.panes : [{
        id: genId(),
        lines: t.lines,
        shellState: t.shellState,
        isRunning: t.isRunning,
        nanoState: t.nanoState,
        vimState: t.vimState,
        streamingState: null,
      }];

      if (existingPanes.length >= 2) {
        return { ...t, panes: existingPanes, splitDirection: direction };
      }

      const currentPane = existingPanes[0];
      const newPaneId = genId();
      const newShellState = createShellState();
      if (vfs) applyBashrc(newShellState, vfs);
      newShellState.cwd = currentPane.shellState.cwd;
      newShellState.env = { ...currentPane.shellState.env };

      const newPane: TerminalPane = {
        id: newPaneId,
        lines: [
          {
            id: genId(),
            type: 'system',
            content: `[tmux] Pane 2 active (${direction} split). VFS shared.`,
            timestamp: new Date(),
          },
        ],
        shellState: newShellState,
        isRunning: false,
        nanoState: null,
        vimState: null,
        streamingState: null,
      };

      return {
        ...t,
        panes: [currentPane, newPane],
        splitDirection: direction,
        activePaneId: newPaneId,
      };
    }));
  }, [activeTabId, vfs]);

  const closePane = useCallback((paneId: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId || !t.panes || t.panes.length <= 1) return t;
      const remainingPanes = t.panes.filter(p => p.id !== paneId);
      const remaining = remainingPanes[0];
      return {
        ...t,
        panes: remainingPanes,
        splitDirection: null,
        activePaneId: remaining.id,
        lines: remaining.lines,
        shellState: remaining.shellState,
        isRunning: remaining.isRunning,
        nanoState: remaining.nanoState,
        vimState: remaining.vimState,
      };
    }));
  }, [activeTabId]);

  const setActivePane = useCallback((paneId: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const target = t.panes?.find(p => p.id === paneId);
      if (!target) return t;
      return {
        ...t,
        activePaneId: paneId,
        lines: target.lines,
        shellState: target.shellState,
        isRunning: target.isRunning,
        nanoState: target.nanoState,
        vimState: target.vimState,
      };
    }));
  }, [activeTabId]);

  const setStreamingState = useCallback((paneId: string, state: StreamingState | null) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const updatedPanes = (t.panes || []).map(p => {
        if (p.id !== paneId) return p;
        return { ...p, streamingState: state, isRunning: Boolean(state) };
      });
      return {
        ...t,
        panes: updatedPanes,
        isRunning: Boolean(state),
      };
    }));
  }, [activeTabId]);

  const handleInput = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSubmit = useCallback(async () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    const activePaneId = tab.activePaneId || tab.panes?.[0]?.id || tab.id;
    const activePane = tab.panes?.find(p => p.id === activePaneId) || {
      id: activePaneId,
      lines: tab.lines,
      shellState: tab.shellState,
      isRunning: tab.isRunning,
      nanoState: tab.nanoState,
      vimState: tab.vimState,
      streamingState: null,
    };

    if (activePane.isRunning) return;

    const cmd = inputValue.trim();
    const session = activePane.shellState.remoteSession;
    let prompt = '';
    if (session) {
      prompt = `<span style="color:#4ade80;font-weight:bold">${session.user}@${session.hostname}</span>:<span style="color:#60a5fa;font-weight:bold">${session.cwd}</span>$ ${cmd.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
    } else {
      const user = activePane.shellState.env['USER'] || 'user';
      const isRoot = activePane.shellState.isRoot || user === 'root';
      const promptChar = isRoot ? '#' : '$';
      const home = activePane.shellState.env['HOME'] || '/home/user';
      const displayCwd = activePane.shellState.cwd === home ? '~' : activePane.shellState.cwd.replace(home, '~');
      const gitInfo = getGitBranchInfo(activePane.shellState.cwd, vfs);
      const gitBadge = gitInfo ? ` <span style="color:#a78bfa;font-weight:bold">(${gitInfo.branch}${gitInfo.isDirty ? '*' : ''})</span>` : '';
      prompt = `<span style="color:#4ade80;font-weight:bold">${user}@linux-box</span>:<span style="color:#60a5fa;font-weight:bold">${displayCwd}</span>${gitBadge}${promptChar} ${cmd.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
    }

    // Add input line
    addLine('input', prompt, true);
    setInputValue('');
    setHistoryIndex(-1);

    if (!cmd) return;

    // Create execution context
    const context = {
      addLine: (type: 'output' | 'error' | 'system', content: string, html?: boolean) => {
        const isHtml = html || content.includes('<span');
        addLine(type, content, isHtml);
      },
      setRunning: (running: boolean) => {
        setTabs(prev => prev.map(t => {
          if (t.id !== activeTabId) return t;
          const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, isRunning: running } : p);
          return { ...t, isRunning: running, panes: updatedPanes };
        }));
      },
      onCtrlC: (handler: () => void) => {
        ctrlCHandlerRef.current = handler;
      },
      setNanoState: (state: NanoState | null) => {
        setTabs(prev => prev.map(t => {
          if (t.id !== activeTabId) return t;
          const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, nanoState: state } : p);
          return { ...t, nanoState: state, panes: updatedPanes };
        }));
      },
      setVimState: (state: VimState | null) => {
        setTabs(prev => prev.map(t => {
          if (t.id !== activeTabId) return t;
          const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, vimState: state } : p);
          return { ...t, vimState: state, panes: updatedPanes };
        }));
      },
      setStreamingState: (state: StreamingState | null) => {
        setTabs(prev => prev.map(t => {
          if (t.id !== activeTabId) return t;
          const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, streamingState: state, isRunning: Boolean(state) } : p);
          return { ...t, panes: updatedPanes, isRunning: Boolean(state) };
        }));
      },
      triggerSplit: (direction: 'horizontal' | 'vertical') => {
        splitTab(direction);
      },
    };

    try {
      const result = await executeCommand(cmd, activePane.shellState, vfs, context);

      // Handle clear command
      if (result.stdout === '__CLEAR__') {
        setTabs(prev => prev.map(t => {
          if (t.id !== activeTabId) return t;
          const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, lines: [] } : p);
          return { ...t, lines: [], panes: updatedPanes };
        }));
      }

      // Update the shell state in the active pane and tab
      setTabs(prev => prev.map(t => {
        if (t.id !== activeTabId) return t;
        const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, shellState: { ...activePane.shellState } } : p);
        return {
          ...t,
          shellState: { ...activePane.shellState },
          panes: updatedPanes,
        };
      }));

      refreshVFS();
    } catch (err) {
      addLine('error', `Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [tabs, activeTabId, inputValue, vfs, refreshVFS, addLine, splitTab]);

  const handleCtrlC = useCallback(() => {
    if (ctrlCHandlerRef.current) {
      ctrlCHandlerRef.current();
      ctrlCHandlerRef.current = null;
    }
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    const activePaneId = tab.activePaneId || tab.panes?.[0]?.id;

    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const updatedPanes = (t.panes || []).map(p => {
        if (p.id !== activePaneId) return p;
        return { ...p, isRunning: false, streamingState: null };
      });
      return { ...t, isRunning: false, panes: updatedPanes };
    }));

    if (inputValue) {
      const prompt = `<span style="color:#4ade80;font-weight:bold">${tab?.shellState.env['USER'] || 'user'}@linux-box</span>:<span style="color:#60a5fa;font-weight:bold">~</span>$ ${inputValue}^C`;
      addLine('input', prompt, true);
      setInputValue('');
    }
  }, [tabs, activeTabId, inputValue, addLine]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    const activePane = tab.panes?.find(p => p.id === tab.activePaneId) || tab;

    // Ctrl+C
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      handleCtrlC();
      return;
    }

    // Ctrl+L
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setTabs(prev => prev.map(t => {
        if (t.id !== activeTabId) return t;
        const activePaneId = t.activePaneId || t.panes?.[0]?.id;
        const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, lines: [] } : p);
        return { ...t, lines: [], panes: updatedPanes };
      }));
      return;
    }

    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault();
      const completions = getCompletions(inputValue, activePane.shellState, vfs);
      if (completions.length === 1) {
        const parts = inputValue.split(/\s+/);
        parts[parts.length - 1] = completions[0];
        setInputValue(parts.join(' '));
      } else if (completions.length > 1) {
        addLine('system', completions.join('  '));
      }
      return;
    }

    // Up arrow - history
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const history = activePane.shellState.history;
      if (history.length === 0) return;
      const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIdx);
      setInputValue(history[newIdx]);
      return;
    }

    // Down arrow - history
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const history = activePane.shellState.history;
      if (historyIndex === -1) return;
      const newIdx = historyIndex + 1;
      if (newIdx >= history.length) {
        setHistoryIndex(-1);
        setInputValue('');
      } else {
        setHistoryIndex(newIdx);
        setInputValue(history[newIdx]);
      }
      return;
    }
  }, [tabs, activeTabId, inputValue, historyIndex, vfs, addLine, handleCtrlC]);

  // Nano operations
  const getNanoState = useCallback((): NanoState | null => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return null;
    const activePane = tab.panes?.find(p => p.id === tab.activePaneId);
    return activePane?.nanoState ?? tab.nanoState ?? null;
  }, [tabs, activeTabId]);

  const setNanoState = useCallback((state: NanoState | null) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, nanoState: state } : p);
      return { ...t, nanoState: state, panes: updatedPanes };
    }));
  }, [activeTabId]);

  const saveNano = useCallback(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    const activePane = tab.panes?.find(p => p.id === tab.activePaneId) || tab;
    if (!activePane?.nanoState) return;
    vfs.writeFile(activePane.nanoState.filename, activePane.nanoState.content);
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const updatedPanes = (t.panes || []).map(p => {
        if (p.id !== activePaneId || !p.nanoState) return p;
        return { ...p, nanoState: { ...p.nanoState, modified: false } };
      });
      return {
        ...t,
        nanoState: t.nanoState ? { ...t.nanoState, modified: false } : null,
        panes: updatedPanes,
      };
    }));
    addLine('system', `[ Wrote ${activePane.nanoState.content.split('\n').length} lines to ${activePane.nanoState.filename} ]`);
    refreshVFS();
  }, [tabs, activeTabId, vfs, addLine, refreshVFS]);

  const exitNano = useCallback(() => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, nanoState: null } : p);
      return { ...t, nanoState: null, panes: updatedPanes };
    }));
  }, [activeTabId]);

  const changeDirectory = useCallback((path: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const updatedPanes = (t.panes || []).map(p => {
        if (p.id !== activePaneId) return p;
        return {
          ...p,
          shellState: {
            ...p.shellState,
            previousDir: p.shellState.cwd,
            cwd: path,
            env: {
              ...p.shellState.env,
              PWD: path,
              OLDPWD: p.shellState.cwd,
            },
          },
        };
      });
      return {
        ...t,
        shellState: {
          ...t.shellState,
          previousDir: t.shellState.cwd,
          cwd: path,
          env: {
            ...t.shellState.env,
            PWD: path,
            OLDPWD: t.shellState.cwd,
          },
        },
        panes: updatedPanes,
      };
    }));
  }, [activeTabId]);

  const openInNano = useCallback((filePath: string) => {
    const node = vfs.getNode(filePath, true);
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const newNano: NanoState = {
        filename: filePath,
        content: node?.content ?? '',
        cursorLine: 1,
        cursorCol: 1,
        modified: false,
        scrollOffset: 0,
      };
      const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, nanoState: newNano } : p);
      return {
        ...t,
        nanoState: newNano,
        panes: updatedPanes,
      };
    }));
  }, [activeTabId, vfs]);

  // Vim operations
  const getVimState = useCallback((): VimState | null => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return null;
    const activePane = tab.panes?.find(p => p.id === tab.activePaneId);
    return activePane?.vimState ?? tab.vimState ?? null;
  }, [tabs, activeTabId]);

  const setVimState = useCallback((state: VimState | null) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, vimState: state } : p);
      return { ...t, vimState: state, panes: updatedPanes };
    }));
  }, [activeTabId]);

  const saveVim = useCallback((newContent: string) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    const activePane = tab.panes?.find(p => p.id === tab.activePaneId) || tab;
    const currentVim = activePane?.vimState || tab.vimState;
    if (!currentVim) return;
    vfs.writeFile(currentVim.filename, newContent);
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const updatedPanes = (t.panes || []).map(p => {
        if (p.id !== activePaneId || !p.vimState) return p;
        return { ...p, vimState: { ...p.vimState, content: newContent, modified: false } };
      });
      return {
        ...t,
        vimState: t.vimState ? { ...t.vimState, content: newContent, modified: false } : null,
        panes: updatedPanes,
      };
    }));
    refreshVFS();
  }, [tabs, activeTabId, vfs, refreshVFS]);

  const exitVim = useCallback(() => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, vimState: null } : p);
      return { ...t, vimState: null, panes: updatedPanes };
    }));
  }, [activeTabId]);

  const openInVim = useCallback((filePath: string) => {
    const node = vfs.getNode(filePath, true);
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      const activePaneId = t.activePaneId || t.panes?.[0]?.id;
      const newVim: VimState = {
        filename: filePath,
        content: node?.content ?? '',
        mode: 'NORMAL',
        cursorLine: 0,
        cursorCol: 0,
        modified: false,
      };
      const updatedPanes = (t.panes || []).map(p => p.id === activePaneId ? { ...p, vimState: newVim } : p);
      return {
        ...t,
        vimState: newVim,
        panes: updatedPanes,
      };
    }));
  }, [activeTabId, vfs]);

  const activeTab = getActiveTab();
  const currentActivePane = activeTab?.panes?.find(p => p.id === activeTab.activePaneId) || activeTab;

  return {
    tabs,
    activeTabId,
    activeTab,
    inputValue,
    addTab,
    closeTab,
    switchTab,
    splitTab,
    closePane,
    setActivePane,
    setStreamingState,
    handleInput,
    handleSubmit,
    handleKeyDown,
    handleCtrlC,
    getNanoState,
    setNanoState,
    saveNano,
    exitNano,
    getVimState,
    setVimState,
    saveVim,
    exitVim,
    changeDirectory,
    openInNano,
    openInVim,
    shellState: currentActivePane?.shellState ?? createShellState(),
    isRunning: currentActivePane?.isRunning ?? false,
  };
}
