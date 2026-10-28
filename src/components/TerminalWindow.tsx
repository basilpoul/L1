import React, { useRef, useEffect, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import type { TerminalTab, ShellState, NanoState, VimState } from '../types';
import type { VirtualFileSystem } from '../vfs/fileSystem';
import { NanoEditor } from './NanoEditor';
import { VimEditor } from './VimEditor';
import { getGitBranchInfo } from '../shell/commands/git';

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
}

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
}) => {
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Auto-scroll to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [activeTab?.lines.length]);

  // Focus input on click
  const focusInput = useCallback(() => {
    if (inputRef.current && !nanoState && !vimState) {
      inputRef.current.focus();
    }
  }, [nanoState, vimState]);

  // Auto-focus on mount and tab switch
  useEffect(() => {
    focusInput();
  }, [activeTabId, focusInput]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
      return;
    }
    onKeyDown(e);
  };

  const displayCwd = shellState.cwd === (shellState.env['HOME'] || '/home/user')
    ? '~'
    : shellState.cwd.replace(shellState.env['HOME'] || '/home/user', '~');

  if (nanoState) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#0f111a' }}>
        <NanoEditor
          filename={nanoState.filename}
          content={nanoState.content}
          onContentChange={onNanoContentChange}
          onSave={onNanoSave}
          onExit={onNanoExit}
          modified={nanoState.modified}
        />
      </div>
    );
  }

  if (vimState) {
    return (
      <div className="flex flex-col h-full" style={{ background: '#0f111a' }}>
        <VimEditor
          filename={vimState.filename}
          content={vimState.content}
          onSave={(c) => onVimSave?.(c)}
          onExit={() => onVimExit?.()}
        />
      </div>
    );
  }

  // Calculate prompt details
  let promptHtml = '';
  if (shellState.remoteSession) {
    const s = shellState.remoteSession;
    promptHtml = `<span style="color:#4ade80;font-weight:bold">${s.user}@${s.hostname}</span>:<span style="color:#60a5fa;font-weight:bold">${s.cwd}</span>$ `;
  } else {
    const user = shellState.env['USER'] || 'user';
    const isRoot = shellState.isRoot || user === 'root';
    const promptChar = isRoot ? '#' : '$';
    const gitInfo = vfs ? getGitBranchInfo(shellState.cwd, vfs) : null;
    const gitBadge = gitInfo ? ` <span style="color:#a78bfa;font-weight:bold">(${gitInfo.branch}${gitInfo.isDirty ? '*' : ''})</span>` : '';
    promptHtml = `<span style="color:#4ade80;font-weight:bold">${user}@linux-box</span>:<span style="color:#60a5fa;font-weight:bold">${displayCwd}</span>${gitBadge}${promptChar} `;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0f111a' }} onClick={focusInput}>
      {/* Tab bar */}
      <div className="flex items-center h-8 px-1" style={{ background: '#141625', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => onSetActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 h-7 rounded-t text-xs cursor-pointer transition-colors ${
              tab.id === activeTabId
                ? 'text-slate-200'
                : 'text-slate-500 hover:text-slate-400'
            }`}
            style={tab.id === activeTabId ? { background: '#0f111a' } : {}}
          >
            <span>{tab.title}</span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
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
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Output area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-sm leading-relaxed"
        style={{ fontSize: '13px' }}
      >
        {activeTab?.lines.map(line => (
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
                  'text-slate-300'
                }
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
              >
                {line.content}
              </span>
            )}
          </div>
        ))}

        {/* Input line */}
        {!isRunning && (
          <div className="flex items-center min-h-[1.3em]">
            <span
              dangerouslySetInnerHTML={{
                __html: promptHtml,
              }}
            />
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => onInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-transparent text-slate-200 outline-none w-full font-mono caret-green-400"
                style={{ fontSize: '13px' }}
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
