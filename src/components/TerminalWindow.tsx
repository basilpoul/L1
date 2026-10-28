import React, { useRef, useEffect, useCallback } from 'react';
import { Plus, X, Columns2, Rows2 } from 'lucide-react';
import type { TerminalTab, ShellState, NanoState, VimState, TerminalTheme, TerminalPane } from '../types';
import type { VirtualFileSystem } from '../vfs/fileSystem';
import { NanoEditor } from './NanoEditor';
import { VimEditor } from './VimEditor';
import { getGitBranchInfo } from '../shell/commands/git';
import { executeCommand } from '../shell/executor';
import { THEMES } from '../styles/themes';

interface TerminalWindowProps {
  tabs: TerminalTab[];
  activeTabId: string;
  inputValue: string;
  onInput: (value: string) => void;
  onSubmit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onAddTab: () => void;
  onCloseTab: (id: string) => void;
  onSetActiveTab: (id: string) => void;
  onSplitTab?: (direction: 'horizontal' | 'vertical') => void;
  onClosePane?: (paneId: string) => void;
  onSetActivePane?: (paneId: string) => void;
  onClearStreaming?: (paneId: string) => void;
  nanoState: NanoState | null;
  onNanoSave: () => void;
  onNanoExit: () => void;
  onNanoContentChange: (content: string) => void;
  vimState?: VimState | null;
  onVimSave?: (newContent: string) => void;
  onVimExit?: () => void;
  shellState: ShellState;
  isRunning: boolean;
  vfs?: VirtualFileSystem;
  theme?: TerminalTheme;
}

const WatchView: React.FC<{
  target: string;
  interval?: number;
  shellState: ShellState;
  vfs?: VirtualFileSystem;
  onExit: () => void;
  themeColor: string;
  textColor: string;
}> = ({ target, interval = 2, shellState, vfs, onExit, themeColor, textColor }) => {
  const [output, setOutput] = React.useState<string>('Executing...');
  const [timestamp, setTimestamp] = React.useState<string>(() => new Date().toLocaleTimeString());

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!vfs) return;
      try {
        const dummyContext = {
          addLine: () => {},
          setRunning: () => {},
          onCtrlC: () => {},
          setNanoState: () => {},
          setVimState: () => {},
        };
        const res = await executeCommand(target, shellState, vfs, dummyContext);
        if (mounted) {
          setOutput(res.stdout || res.stderr || '(no output)');
          setTimestamp(new Date().toLocaleTimeString());
        }
      } catch (err) {
        if (mounted) setOutput(String(err));
      }
    };

    run();
    const timer = setInterval(run, Math.max(interval * 1000, 1000));
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [target, interval, shellState, vfs]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'q' || (e.ctrlKey && e.key === 'c')) {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit]);

  return (
    <div className="flex flex-col h-full font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/10 text-slate-300">
        <div>
          Every <span style={{ color: themeColor }}>{interval.toFixed(1)}s</span>: <span className="font-semibold text-white">{target}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-slate-400">linux-box: {timestamp}</span>
          <button
            onClick={onExit}
            className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[11px]"
          >
            Exit (q / Ctrl+C)
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 whitespace-pre-wrap leading-relaxed" style={{ color: textColor }}>
        {output}
      </div>
    </div>
  );
};

const TailFollowView: React.FC<{
  target: string;
  vfs?: VirtualFileSystem;
  onExit: () => void;
  textColor: string;
}> = ({ target, vfs, onExit, textColor }) => {
  const [content, setContent] = React.useState<string>('');
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const poll = () => {
      if (!vfs) return;
      const node = vfs.getNode(target);
      if (mounted) {
        const text = node?.content ?? '(file deleted or not found)';
        const lastLines = text.split('\n').slice(-40).join('\n');
        setContent(lastLines);
      }
    };

    poll();
    const timer = setInterval(poll, 1000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [target, vfs]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [content]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        onExit();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onExit]);

  return (
    <div className="flex flex-col h-full font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/10 text-slate-300">
        <div>
          ==&gt; <span className="font-semibold text-emerald-400">tail -f</span> {target} &lt;==
        </div>
        <button
          onClick={onExit}
          className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30 text-[11px]"
        >
          Stop (Ctrl+C)
        </button>
      </div>
      <div ref={outputRef} className="flex-1 overflow-y-auto p-3 whitespace-pre-wrap leading-relaxed" style={{ color: textColor }}>
        {content}
      </div>
    </div>
  );
};

export const TerminalWindow: React.FC<TerminalWindowProps> = ({
  tabs,
  activeTabId,
  inputValue,
  onInput,
  onSubmit,
  onKeyDown,
  onAddTab,
  onCloseTab,
  onSetActiveTab,
  onSplitTab,
  onClosePane,
  onSetActivePane,
  onClearStreaming,
  nanoState,
  onNanoSave,
  onNanoExit,
  onNanoContentChange,
  vimState,
  onVimSave,
  onVimExit,
  shellState,
  isRunning,
  vfs,
  theme = 'slate',
}) => {
  const currentTheme = THEMES[theme] || THEMES.slate;
  const inputRef = useRef<HTMLInputElement>(null);
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Focus input on click
  const focusInput = useCallback(() => {
    const isEditing = Boolean(
      nanoState || vimState ||
      activeTab?.nanoState || activeTab?.vimState ||
      activeTab?.panes?.some(p => p.nanoState || p.vimState)
    );
    if (inputRef.current && !isEditing) {
      inputRef.current.focus();
    }
  }, [nanoState, vimState, activeTab]);

  useEffect(() => {
    focusInput();
  }, [activeTabId, activeTab?.activePaneId, focusInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
      return;
    }
    onKeyDown(e);
  };

  const renderPrompt = (paneShell: ShellState) => {
    if (paneShell.remoteSession) {
      const s = paneShell.remoteSession;
      return `<span style="color:#4ade80;font-weight:bold">${s.user}@${s.hostname}</span>:<span style="color:#60a5fa;font-weight:bold">${s.cwd}</span>$ `;
    }
    const user = paneShell.env['USER'] || 'user';
    const isRoot = paneShell.isRoot || user === 'root';
    const promptChar = isRoot ? '#' : '$';
    const home = paneShell.env['HOME'] || '/home/user';
    const displayCwd = paneShell.cwd === home ? '~' : paneShell.cwd.replace(home, '~');
    const gitInfo = vfs ? getGitBranchInfo(paneShell.cwd, vfs) : null;
    const gitBadge = gitInfo ? ` <span style="color:#a78bfa;font-weight:bold">(${gitInfo.branch}${gitInfo.isDirty ? '*' : ''})</span>` : '';
    return `<span style="color:${currentTheme.promptUser};font-weight:bold">${user}@linux-box</span>:<span style="color:${currentTheme.promptDir};font-weight:bold">${displayCwd}</span>${gitBadge}${promptChar} `;
  };

  const renderPane = (pane: TerminalPane, isOnlyPane: boolean) => {
    const isActivePane = isOnlyPane || pane.id === activeTab?.activePaneId;
    const currentNano = pane.nanoState || (isActivePane ? (nanoState || activeTab?.nanoState) : null);
    const currentVim = pane.vimState || (isActivePane ? (vimState || activeTab?.vimState) : null);

    if (currentNano) {
      return (
        <div key={pane.id} className="flex-1 flex flex-col h-full min-h-0" style={{ background: currentTheme.bg }}>
          <NanoEditor
            filename={currentNano.filename}
            content={currentNano.content}
            onContentChange={onNanoContentChange}
            onSave={onNanoSave}
            onExit={onNanoExit}
            modified={currentNano.modified}
          />
        </div>
      );
    }

    if (currentVim) {
      return (
        <div key={pane.id} className="flex-1 flex flex-col h-full min-h-0" style={{ background: currentTheme.bg }}>
          <VimEditor
            filename={currentVim.filename}
            content={currentVim.content}
            onSave={(c) => onVimSave?.(c)}
            onExit={() => onVimExit?.()}
          />
        </div>
      );
    }

    if (pane.streamingState) {
      if (pane.streamingState.type === 'watch') {
        return (
          <div key={pane.id} className="flex-1 flex flex-col h-full min-h-0" style={{ background: currentTheme.bg }}>
            <WatchView
              target={pane.streamingState.target}
              interval={pane.streamingState.interval}
              shellState={pane.shellState}
              vfs={vfs}
              onExit={() => onClearStreaming?.(pane.id)}
              themeColor={currentTheme.accent}
              textColor={currentTheme.text}
            />
          </div>
        );
      }
      if (pane.streamingState.type === 'tail') {
        return (
          <div key={pane.id} className="flex-1 flex flex-col h-full min-h-0" style={{ background: currentTheme.bg }}>
            <TailFollowView
              target={pane.streamingState.target}
              vfs={vfs}
              onExit={() => onClearStreaming?.(pane.id)}
              textColor={currentTheme.text}
            />
          </div>
        );
      }
    }

    return (
      <div
        key={pane.id}
        onClick={() => {
          onSetActivePane?.(pane.id);
          focusInput();
        }}
        className={`flex-1 flex flex-col h-full min-h-0 relative ${
          !isOnlyPane && isActivePane ? 'ring-1 ring-blue-500/25' : ''
        }`}
        style={{ background: currentTheme.bg }}
      >
        {!isOnlyPane && (
          <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono border-b border-white/5 bg-black/30 text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isActivePane ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              <span>{pane.shellState.cwd.replace('/home/user', '~')}</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClosePane?.(pane.id);
              }}
              className="text-slate-500 hover:text-slate-200 transition-colors"
              title="Close pane"
            >
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 font-mono text-sm leading-relaxed" style={{ fontSize: '13px' }}>
          {pane.lines.map((line) => (
            <div key={line.id} className="min-h-[1.3em]">
              {line.html || line.content.includes('<span') ? (
                <span
                  className={
                    line.type === 'error' ? 'text-red-400' :
                    line.type === 'system' ? 'text-yellow-600/80 italic' :
                    ''
                  }
                  dangerouslySetInnerHTML={{ __html: line.content }}
                />
              ) : (
                <span
                  className={
                    line.type === 'error' ? 'text-red-400' :
                    line.type === 'system' ? 'text-yellow-600/80 italic' :
                    ''
                  }
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: currentTheme.text }}
                >
                  {line.content}
                </span>
              )}
            </div>
          ))}

          {/* Active Input Line */}
          {!pane.isRunning && isActivePane && (
            <div className="flex items-center min-h-[1.3em]">
              <span dangerouslySetInnerHTML={{ __html: renderPrompt(pane.shellState) }} />
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => onInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent outline-none w-full font-mono"
                  style={{
                    fontSize: '13px',
                    color: currentTheme.text,
                    caretColor: currentTheme.cursor,
                  }}
                  autoFocus
                  spellCheck={false}
                  autoComplete="off"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const panes = activeTab?.panes && activeTab.panes.length > 0 ? activeTab.panes : [{
    id: activeTab?.id || 'pane-1',
    lines: activeTab?.lines || [],
    shellState: activeTab?.shellState || shellState,
    isRunning: activeTab?.isRunning || isRunning,
    nanoState,
    vimState,
  }];

  const isSplit = Boolean(activeTab?.splitDirection && panes.length > 1);

  return (
    <div className="flex flex-col h-full" style={{ background: currentTheme.bg }} onClick={focusInput}>
      {/* Tab bar and Multiplexer Toolbar */}
      <div
        className="flex items-center justify-between h-8 px-1"
        style={{
          background: currentTheme.tabBarBg,
          borderBottom: `1px solid ${currentTheme.border}`,
        }}
      >
        <div className="flex items-center h-full">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => onSetActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 h-7 rounded-t text-xs cursor-pointer transition-colors ${
                tab.id === activeTabId ? 'text-slate-200' : 'text-slate-500 hover:text-slate-400'
              }`}
              style={tab.id === activeTabId ? { background: currentTheme.activeTabBg } : {}}
            >
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="opacity-50 hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          <button
            onClick={onAddTab}
            className="flex items-center justify-center w-6 h-6 ml-1 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            title="New Terminal Tab"
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Split Pane Multiplexer Controls */}
        <div className="flex items-center gap-1 pr-2">
          <button
            onClick={() => onSplitTab?.('horizontal')}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Split Terminal Horizontally (tmux split-window -h)"
          >
            <Columns2 size={13} />
            <span className="hidden md:inline text-[11px]">Split H</span>
          </button>
          <button
            onClick={() => onSplitTab?.('vertical')}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Split Terminal Vertically (tmux split-window -v)"
          >
            <Rows2 size={13} />
            <span className="hidden md:inline text-[11px]">Split V</span>
          </button>
        </div>
      </div>

      {/* Pane Layout Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {isSplit ? (
          <div
            className={`flex-1 flex ${
              activeTab?.splitDirection === 'vertical' ? 'flex-col divide-y' : 'flex-row divide-x'
            } divide-white/10 h-full min-h-0`}
          >
            {panes.map((pane) => renderPane(pane, false))}
          </div>
        ) : (
          renderPane(panes[0], true)
        )}
      </div>
    </div>
  );
};
