import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  Plus,
  X,
  Columns2,
  Rows2,
  Copy,
  Check,
  Terminal as TerminalIcon,
  GitBranch,
  ShieldAlert,
  Sparkles,
  CornerDownLeft,
} from 'lucide-react';
import type {
  TerminalTab,
  ShellState,
  NanoState,
  VimState,
  TerminalTheme,
  TerminalPane,
  TerminalLine,
} from '../types';
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
  onQuickCommand?: (cmd: string) => void;
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
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-secondary)',
        }}
      >
        <div>
          Every <span style={{ color: themeColor }}>{interval.toFixed(1)}s</span>:{' '}
          <span className="font-semibold" style={{ color: 'var(--theme-text)' }}>
            {target}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="tabular-nums opacity-75">linux-box · {timestamp}</span>
          <button
            onClick={onExit}
            className="px-2.5 py-0.5 rounded bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/25 text-[11px] transition-colors"
          >
            Exit (q / Ctrl+C)
          </button>
        </div>
      </div>
      <div
        className="flex-1 overflow-y-auto p-4 whitespace-pre-wrap leading-relaxed"
        style={{ color: textColor }}
      >
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
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-secondary)',
        }}
      >
        <div>
          ==&gt; <span className="font-semibold text-emerald-400">tail -f</span> {target} &lt;==
        </div>
        <button
          onClick={onExit}
          className="px-2.5 py-0.5 rounded bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/25 text-[11px] transition-colors"
        >
          Stop (Ctrl+C)
        </button>
      </div>
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-4 whitespace-pre-wrap leading-relaxed"
        style={{ color: textColor }}
      >
        {content}
      </div>
    </div>
  );
};

const QUICK_SUGGESTIONS = [
  { label: 'neofetch', cmd: 'neofetch' },
  { label: 'ls -la', cmd: 'ls -la' },
  { label: 'systemctl status', cmd: 'systemctl status' },
  { label: 'docker ps', cmd: 'docker ps' },
  { label: 'kubectl get pods', cmd: 'kubectl get pods' },
  { label: 'help', cmd: 'help' },
];

const TOUCH_SYMBOLS = ['/', '-', '|', '~', '>', '--'];

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
  onQuickCommand,
}) => {
  const currentTheme = THEMES[theme] || THEMES.slate;
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [copiedLineId, setCopiedLineId] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Focus input on click
  const focusInput = useCallback(() => {
    const isEditing = Boolean(
      nanoState ||
        vimState ||
        activeTab?.nanoState ||
        activeTab?.vimState ||
        activeTab?.panes?.some((p) => p.nanoState || p.vimState)
    );
    if (inputRef.current && !isEditing) {
      inputRef.current.focus();
    }
  }, [nanoState, vimState, activeTab]);

  useEffect(() => {
    focusInput();
  }, [activeTabId, activeTab?.activePaneId, focusInput]);

  // Auto-scroll active pane to bottom when lines change
  useEffect(() => {
    const panesList = activeTab?.panes || [];
    for (const p of panesList) {
      const el = scrollContainerRefs.current[p.id];
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }
    const defaultEl = scrollContainerRefs.current[activeTab?.id || 'pane-1'];
    if (defaultEl) {
      defaultEl.scrollTop = defaultEl.scrollHeight;
    }
  }, [activeTab?.id, activeTab?.lines.length, activeTab?.panes, inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
      return;
    }
    onKeyDown(e);
  };

  const stripHtml = (raw: string) => raw.replace(/<[^>]*>?/gm, '');

  const handleCopyLine = (e: React.MouseEvent, line: TerminalLine) => {
    e.stopPropagation();
    const cleanText = stripHtml(line.content);
    navigator.clipboard.writeText(cleanText);
    setCopiedLineId(line.id);
    setTimeout(() => setCopiedLineId(null), 1800);
  };

  const triggerSyntheticKey = (key: string, ctrlKey = false) => {
    onKeyDown({
      key,
      ctrlKey,
      altKey: false,
      metaKey: false,
      shiftKey: false,
      preventDefault: () => {},
    } as unknown as React.KeyboardEvent);
    focusInput();
  };

  const insertTouchSymbol = (sym: string) => {
    onInput(inputValue + sym);
    focusInput();
  };

  const renderPromptContext = (paneShell: ShellState) => {
    if (paneShell.remoteSession) {
      const s = paneShell.remoteSession;
      return {
        userHost: `${s.user}@${s.hostname}`,
        cwd: s.cwd,
        gitInfo: null,
        isRoot: s.user === 'root',
        isRemote: true,
      };
    }
    const user = paneShell.env['USER'] || 'user';
    const isRoot = paneShell.isRoot || user === 'root';
    const home = paneShell.env['HOME'] || '/home/user';
    const displayCwd = paneShell.cwd === home ? '~' : paneShell.cwd.replace(home, '~');
    const gitInfo = vfs ? getGitBranchInfo(paneShell.cwd, vfs) : null;
    return {
      userHost: `${user}@linux-box`,
      cwd: displayCwd,
      gitInfo,
      isRoot,
      isRemote: false,
    };
  };

  const renderPane = (pane: TerminalPane, isOnlyPane: boolean) => {
    const isActivePane = isOnlyPane || pane.id === activeTab?.activePaneId;
    const currentNano =
      pane.nanoState || (isActivePane ? nanoState || activeTab?.nanoState : null);
    const currentVim =
      pane.vimState || (isActivePane ? vimState || activeTab?.vimState : null);

    if (currentNano) {
      return (
        <div
          key={pane.id}
          className="flex-1 flex flex-col h-full min-h-0"
          style={{ background: currentTheme.bg }}
        >
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
        <div
          key={pane.id}
          className="flex-1 flex flex-col h-full min-h-0"
          style={{ background: currentTheme.bg }}
        >
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
          <div
            key={pane.id}
            className="flex-1 flex flex-col h-full min-h-0"
            style={{ background: currentTheme.bg }}
          >
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
          <div
            key={pane.id}
            className="flex-1 flex flex-col h-full min-h-0"
            style={{ background: currentTheme.bg }}
          >
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

    const promptCtx = renderPromptContext(pane.shellState);

    return (
      <div
        key={pane.id}
        onClick={() => {
          onSetActivePane?.(pane.id);
          focusInput();
        }}
        className="flex-1 flex flex-col h-full min-h-0 relative transition-colors"
        style={{
          background: currentTheme.bg,
          boxShadow:
            !isOnlyPane && isActivePane
              ? `inset 0 0 0 1px ${currentTheme.accent}40`
              : undefined,
        }}
      >
        {/* Split-Pane Subheader */}
        {!isOnlyPane && (
          <div
            className="flex items-center justify-between px-3 py-1.5 text-[11px] font-mono border-b shrink-0"
            style={{
              background: currentTheme.surface,
              borderColor: currentTheme.border,
              color: currentTheme.textSecondary,
            }}
          >
            <span className="flex items-center gap-2">
              <span
                className="text-[10px] uppercase tracking-wider font-sans font-semibold"
                style={{ color: isActivePane ? currentTheme.accent : currentTheme.muted }}
              >
                {isActivePane ? 'Active Pane' : 'Pane'}
              </span>
              <span className="opacity-30">·</span>
              <span style={{ color: currentTheme.promptDir }}>
                {pane.shellState.cwd.replace('/home/user', '~')}
              </span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClosePane?.(pane.id);
              }}
              className="opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-white/5"
              title="Close split pane"
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Terminal Scrollable Buffer with Warp-style Command Blocks */}
        <div
          ref={(el) => {
            scrollContainerRefs.current[pane.id] = el;
          }}
          className="flex-1 overflow-y-auto px-4 py-3 font-mono text-[13px] leading-relaxed space-y-0.5"
        >
          {pane.lines.map((line) => {
            const isInputBlock = line.type === 'input';
            const isErrorBlock = line.type === 'error';
            const isSystemBlock = line.type === 'system';

            return (
              <div
                key={line.id}
                className={`group relative rounded-md transition-colors ${
                  isInputBlock
                    ? 'mt-2.5 pt-1.5 pb-0.5 px-2 -mx-2 bg-white/[0.02] border border-white/[0.04]'
                    : isErrorBlock
                    ? 'px-2 -mx-2 py-0.5 bg-rose-500/[0.06]'
                    : 'px-0.5'
                }`}
              >
                {/* Hover Copy Action */}
                {line.content.trim().length > 0 && !isSystemBlock && (
                  <button
                    onClick={(e) => handleCopyLine(e, line)}
                    className="opacity-0 group-hover:opacity-100 absolute right-2 top-1 p-1 rounded bg-black/50 border border-white/10 text-slate-400 hover:text-white transition-opacity"
                    title="Copy line content"
                  >
                    {copiedLineId === line.id ? (
                      <Check size={11} className="text-emerald-400" />
                    ) : (
                      <Copy size={11} />
                    )}
                  </button>
                )}

                {line.html || line.content.includes('<span') ? (
                  <div
                    className={
                      isErrorBlock
                        ? 'text-rose-400'
                        : isSystemBlock
                        ? 'text-slate-400/90'
                        : ''
                    }
                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    dangerouslySetInnerHTML={{ __html: line.content }}
                  />
                ) : (
                  <div
                    className={
                      isErrorBlock
                        ? 'text-rose-400'
                        : isSystemBlock
                        ? 'text-slate-400/90 italic'
                        : ''
                    }
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: isErrorBlock
                        ? undefined
                        : isSystemBlock
                        ? currentTheme.textSecondary
                        : currentTheme.text,
                    }}
                  >
                    {line.content}
                  </div>
                )}
              </div>
            );
          })}

          {/* Warp-Inspired Modern Prompt Block */}
          {!pane.isRunning && isActivePane && (
            <div
              className="mt-3 pt-2.5 pb-2 px-3 -mx-1 rounded-lg border transition-colors"
              style={{
                background: currentTheme.surface,
                borderColor: currentTheme.borderStrong,
              }}
            >
              {/* Prompt Context Metadata Row (Zero-pill unboxed typography with separators) */}
              <div className="flex items-center justify-between text-[11px] font-mono mb-1.5 select-none">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: currentTheme.promptUser }}>
                    {promptCtx.userHost}
                  </span>
                  <span className="opacity-30">·</span>
                  <span className="font-semibold" style={{ color: currentTheme.promptDir }}>
                    {promptCtx.cwd}
                  </span>

                  {promptCtx.gitInfo && (
                    <>
                      <span className="opacity-30">·</span>
                      <span className="inline-flex items-center gap-1 text-purple-400">
                        <GitBranch size={11} />
                        <span>
                          {promptCtx.gitInfo.branch}
                          {promptCtx.gitInfo.isDirty ? '*' : ''}
                        </span>
                      </span>
                    </>
                  )}

                  {promptCtx.isRoot && (
                    <>
                      <span className="opacity-30">·</span>
                      <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                        <ShieldAlert size={11} />
                        <span>root</span>
                      </span>
                    </>
                  )}

                  {promptCtx.isRemote && (
                    <>
                      <span className="opacity-30">·</span>
                      <span className="text-cyan-400">ssh-remote</span>
                    </>
                  )}
                </div>

                <span
                  className="hidden sm:inline-flex items-center gap-1 text-[10px] font-sans opacity-45"
                  style={{ color: currentTheme.textSecondary }}
                >
                  <span>Run</span>
                  <CornerDownLeft size={10} />
                </span>
              </div>

              {/* Command Input Line */}
              <div className="flex items-center gap-2">
                <span
                  className="font-mono font-bold text-sm select-none shrink-0"
                  style={{ color: promptCtx.isRoot ? '#f59e0b' : currentTheme.accent }}
                >
                  {promptCtx.isRoot ? '#' : '❯'}
                </span>
                <div className="relative flex-1 min-w-0">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => onInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a Linux command..."
                    className="bg-transparent outline-none w-full font-mono text-base sm:text-[13px] placeholder:opacity-30"
                    style={{
                      color: currentTheme.text,
                      caretColor: currentTheme.cursor,
                    }}
                    autoFocus
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                  />
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSubmit();
                    focusInput();
                  }}
                  className="sm:hidden flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-white shrink-0 active:scale-95 transition-transform"
                  style={{ background: currentTheme.accent }}
                >
                  <span>Run</span>
                  <CornerDownLeft size={11} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile & Tablet Touch Auxiliary Key Strip (Tab, History Arrows, Ctrl+C, Symbols) */}
        {isActivePane && !pane.isRunning && (
          <div
            className="flex lg:hidden items-center gap-1.5 px-3 py-1.5 border-t overflow-x-auto shrink-0 select-none"
            style={{
              background: currentTheme.surface,
              borderColor: currentTheme.border,
            }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSyntheticKey('Tab');
              }}
              className="px-2.5 py-1 rounded font-mono text-xs font-medium border active:scale-95 transition-transform shrink-0"
              style={{
                background: currentTheme.elevated,
                borderColor: currentTheme.borderStrong,
                color: currentTheme.accent,
              }}
            >
              Tab
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSyntheticKey('ArrowUp');
              }}
              className="px-2.5 py-1 rounded font-mono text-xs border active:scale-95 transition-transform shrink-0"
              style={{
                background: currentTheme.elevated,
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              title="Previous command in history"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSyntheticKey('ArrowDown');
              }}
              className="px-2.5 py-1 rounded font-mono text-xs border active:scale-95 transition-transform shrink-0"
              style={{
                background: currentTheme.elevated,
                borderColor: currentTheme.border,
                color: currentTheme.text,
              }}
              title="Next command in history"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSyntheticKey('c', true);
              }}
              className="px-2 py-1 rounded font-mono text-xs border bg-rose-500/10 border-rose-500/25 text-rose-300 active:scale-95 transition-transform shrink-0"
            >
              ^C
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerSyntheticKey('l', true);
              }}
              className="px-2 py-1 rounded font-mono text-xs border active:scale-95 transition-transform shrink-0"
              style={{
                background: currentTheme.elevated,
                borderColor: currentTheme.border,
                color: currentTheme.textSecondary,
              }}
            >
              Clear
            </button>

            <span className="opacity-25 text-xs px-0.5">|</span>

            {TOUCH_SYMBOLS.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  insertTouchSymbol(sym);
                }}
                className="px-2.5 py-1 rounded font-mono text-xs border active:scale-95 transition-transform shrink-0"
                style={{
                  background: currentTheme.bg,
                  borderColor: currentTheme.border,
                  color: currentTheme.text,
                }}
              >
                {sym}
              </button>
            ))}
          </div>
        )}

        {/* Subtle Quick Command Suggestions Bar at bottom of active pane */}
        {isActivePane && onQuickCommand && (
          <div
            className="flex items-center justify-between gap-2 px-4 py-1.5 border-t text-[11px] overflow-x-auto shrink-0"
            style={{
              background: currentTheme.tabBarBg,
              borderColor: currentTheme.border,
              color: currentTheme.textSecondary,
            }}
          >
            <div className="flex items-center gap-1.5 shrink-0">
              <Sparkles size={11} style={{ color: currentTheme.accent }} />
              <span className="font-medium opacity-75">Quick run:</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {QUICK_SUGGESTIONS.map((item) => (
                <button
                  key={item.cmd}
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickCommand(item.cmd);
                  }}
                  className="px-2 py-0.5 rounded font-mono text-[11px] border transition-colors hover:bg-white/[0.06] whitespace-nowrap shrink-0"
                  style={{
                    background: currentTheme.surface,
                    borderColor: currentTheme.border,
                    color: currentTheme.text,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const panes =
    activeTab?.panes && activeTab.panes.length > 0
      ? activeTab.panes
      : [
          {
            id: activeTab?.id || 'pane-1',
            lines: activeTab?.lines || [],
            shellState: activeTab?.shellState || shellState,
            isRunning: activeTab?.isRunning || isRunning,
            nanoState,
            vimState,
          },
        ];

  const isSplit = Boolean(activeTab?.splitDirection && panes.length > 1);

  return (
    <div
      className="flex flex-col h-full min-h-0"
      style={{ background: currentTheme.bg }}
      onClick={focusInput}
    >
      {/* Modern IDE Tab Bar & Split Multiplexer Toolbar */}
      <div
        className="flex items-center justify-between h-9 px-2 select-none shrink-0"
        style={{
          background: currentTheme.tabBarBg,
          borderBottom: `1px solid ${currentTheme.border}`,
        }}
      >
        <div className="flex items-center h-full gap-1 overflow-x-auto">
          {tabs.map((tab, idx) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSetActiveTab(tab.id)}
                className={`group flex items-center gap-2 px-3 h-full text-xs cursor-pointer transition-colors relative whitespace-nowrap shrink-0 ${
                  isActive ? 'font-medium' : 'opacity-60 hover:opacity-95'
                }`}
                style={{
                  background: isActive ? currentTheme.activeTabBg : 'transparent',
                  color: isActive ? currentTheme.text : currentTheme.textSecondary,
                  borderTop: isActive
                    ? `2px solid ${currentTheme.accent}`
                    : '2px solid transparent',
                }}
              >
                <TerminalIcon
                  size={12}
                  style={{ color: isActive ? currentTheme.accent : currentTheme.muted }}
                />
                <span>{tab.title}</span>
                <span
                  className="text-[10px] font-mono tabular-nums opacity-45"
                  style={{ color: currentTheme.textSecondary }}
                >
                  #{idx + 1}
                </span>
                {tabs.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                    className="opacity-40 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded transition-opacity"
                    title="Close tab"
                  >
                    <X size={11} />
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={onAddTab}
            className="flex items-center justify-center w-6 h-6 ml-1 rounded hover:bg-white/[0.06] transition-colors shrink-0"
            style={{ color: currentTheme.textSecondary }}
            title="New Terminal Tab"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Split Pane Multiplexer Controls */}
        <div className="flex items-center gap-1 pr-1 shrink-0">
          <button
            onClick={() => onSplitTab?.('horizontal')}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-white/[0.06] transition-colors whitespace-nowrap shrink-0"
            style={{ color: currentTheme.textSecondary }}
            title="Split Terminal Horizontally (tmux split-window -h)"
          >
            <Columns2 size={13} />
            <span className="hidden md:inline text-[11px]">Split Right</span>
          </button>
          <button
            onClick={() => onSplitTab?.('vertical')}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-white/[0.06] transition-colors whitespace-nowrap shrink-0"
            style={{ color: currentTheme.textSecondary }}
            title="Split Terminal Vertically (tmux split-window -v)"
          >
            <Rows2 size={13} />
            <span className="hidden md:inline text-[11px]">Split Down</span>
          </button>
        </div>
      </div>

      {/* Pane Layout Area (Stacks vertically on mobile phones if split horizontally) */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {isSplit ? (
          <div
            className={`flex-1 flex ${
              activeTab?.splitDirection === 'vertical'
                ? 'flex-col divide-y'
                : 'flex-col md:flex-row divide-y md:divide-y-0 md:divide-x'
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
