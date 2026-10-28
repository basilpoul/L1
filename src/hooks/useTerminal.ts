import { useState, useCallback, useRef } from 'react';
import type { TerminalTab, TerminalLine, ShellState, NanoState, VimState } from '../types';
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
  };
}

function createTab(index: number, vfs?: VirtualFileSystem): TerminalTab {
  const shellState = createShellState();
  if (vfs) {
    applyBashrc(shellState, vfs);
  }
  const id = genId();
  return {
    id,
    title: `Terminal ${index}`,
    lines: [
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
    ],
    shellState,
    isRunning: false,
    nanoState: null,
    vimState: null,
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
      return { ...t, lines: [...t.lines, newLine] };
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

  const handleInput = useCallback((value: string) => {
    setInputValue(value);
  }, []);

  const handleSubmit = useCallback(async () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || tab.isRunning) return;

    const cmd = inputValue.trim();
    const session = tab.shellState.remoteSession;
    let prompt = '';
    if (session) {
      prompt = `<span style="color:#4ade80;font-weight:bold">${session.user}@${session.hostname}</span>:<span style="color:#60a5fa;font-weight:bold">${session.cwd}</span>$ ${cmd.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
    } else {
      const user = tab.shellState.env['USER'] || 'user';
      const isRoot = tab.shellState.isRoot || user === 'root';
      const promptChar = isRoot ? '#' : '$';
      const home = tab.shellState.env['HOME'] || '/home/user';
      const displayCwd = tab.shellState.cwd === home ? '~' : tab.shellState.cwd.replace(home, '~');
      const gitInfo = getGitBranchInfo(tab.shellState.cwd, vfs);
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
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isRunning: running } : t));
      },
      onCtrlC: (handler: () => void) => {
        ctrlCHandlerRef.current = handler;
      },
      setNanoState: (state: NanoState | null) => {
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, nanoState: state } : t));
      },
      setVimState: (state: VimState | null) => {
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, vimState: state } : t));
      },
    };

    try {
      const result = await executeCommand(cmd, tab.shellState, vfs, context);

      // Handle clear command
      if (result.stdout === '__CLEAR__') {
        setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, lines: [] } : t));
      }

      // Update the shell state in the tab
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, shellState: { ...tab.shellState } } : t));

      refreshVFS();
    } catch (err) {
      addLine('error', `Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [tabs, activeTabId, inputValue, vfs, refreshVFS, addLine]);

  const handleCtrlC = useCallback(() => {
    if (ctrlCHandlerRef.current) {
      ctrlCHandlerRef.current();
      ctrlCHandlerRef.current = null;
    }
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab?.isRunning) {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, isRunning: false } : t));
    }
    if (inputValue) {
      const prompt = `<span style="color:#4ade80;font-weight:bold">${tab?.shellState.env['USER'] || 'user'}@linux-box</span>:<span style="color:#60a5fa;font-weight:bold">~</span>$ ${inputValue}^C`;
      addLine('input', prompt, true);
      setInputValue('');
    }
  }, [tabs, activeTabId, inputValue, addLine]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    // Ctrl+C
    if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      handleCtrlC();
      return;
    }

    // Ctrl+L
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, lines: [] } : t));
      return;
    }

    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault();
      const completions = getCompletions(inputValue, tab.shellState, vfs);
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
      const history = tab.shellState.history;
      if (history.length === 0) return;
      const newIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(newIdx);
      setInputValue(history[newIdx]);
      return;
    }

    // Down arrow - history
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const history = tab.shellState.history;
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
    return tab?.nanoState ?? null;
  }, [tabs, activeTabId]);

  const setNanoState = useCallback((state: NanoState | null) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, nanoState: state } : t));
  }, [activeTabId]);

  const saveNano = useCallback(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.nanoState) return;
    vfs.writeFile(tab.nanoState.filename, tab.nanoState.content);
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      nanoState: t.nanoState ? { ...t.nanoState, modified: false } : null,
    } : t));
    addLine('system', `[ Wrote ${tab.nanoState.content.split('\n').length} lines to ${tab.nanoState.filename} ]`);
    refreshVFS();
  }, [tabs, activeTabId, vfs, addLine, refreshVFS]);

  const exitNano = useCallback(() => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, nanoState: null } : t));
  }, [activeTabId]);

  const changeDirectory = useCallback((path: string) => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
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
      };
    }));
  }, [activeTabId]);

  const openInNano = useCallback((filePath: string) => {
    const node = vfs.getNode(filePath, true);
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      return {
        ...t,
        nanoState: {
          filename: filePath,
          content: node?.content ?? '',
          cursorLine: 1,
          cursorCol: 1,
          modified: false,
          scrollOffset: 0,
        },
      };
    }));
  }, [activeTabId, vfs]);

  // Vim operations
  const getVimState = useCallback((): VimState | null => {
    const tab = tabs.find(t => t.id === activeTabId);
    return tab?.vimState ?? null;
  }, [tabs, activeTabId]);

  const setVimState = useCallback((state: VimState | null) => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, vimState: state } : t));
  }, [activeTabId]);

  const saveVim = useCallback((newContent: string) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab?.vimState) return;
    vfs.writeFile(tab.vimState.filename, newContent);
    setTabs(prev => prev.map(t => t.id === activeTabId ? {
      ...t,
      vimState: t.vimState ? { ...t.vimState, content: newContent, modified: false } : null,
    } : t));
    refreshVFS();
  }, [tabs, activeTabId, vfs, refreshVFS]);

  const exitVim = useCallback(() => {
    setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, vimState: null } : t));
  }, [activeTabId]);

  const openInVim = useCallback((filePath: string) => {
    const node = vfs.getNode(filePath, true);
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTabId) return t;
      return {
        ...t,
        vimState: {
          filename: filePath,
          content: node?.content ?? '',
          mode: 'NORMAL',
          cursorLine: 0,
          cursorCol: 0,
          modified: false,
        },
      };
    }));
  }, [activeTabId, vfs]);

  const activeTab = getActiveTab();

  return {
    tabs,
    activeTabId,
    activeTab,
    inputValue,
    addTab,
    closeTab,
    switchTab,
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
    shellState: activeTab?.shellState ?? createShellState(),
    isRunning: activeTab?.isRunning ?? false,
  };
}
