import React, { useRef, useEffect, useState } from 'react';
import { Save, LogOut } from 'lucide-react';

interface NanoEditorProps {
  filename: string;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onExit: () => void;
  modified: boolean;
}

export const NanoEditor: React.FC<NanoEditorProps> = ({
  filename,
  content,
  onContentChange,
  onSave,
  onExit,
  modified,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSaveAction = () => {
    onSave();
    setStatusMsg('[ Wrote ' + content.split('\n').length + ' lines ]');
    setTimeout(() => setStatusMsg(''), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey) {
      if (e.key === 'o' || e.key === 's') {
        e.preventDefault();
        handleSaveAction();
        return;
      }
      if (e.key === 'x') {
        e.preventDefault();
        onExit();
        return;
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onContentChange(e.target.value);
  };

  const handleSelect = () => {
    if (textareaRef.current) {
      const pos = textareaRef.current.selectionStart;
      const text = textareaRef.current.value.substring(0, pos);
      const lines = text.split('\n');
      setCursorLine(lines.length);
      setCursorCol(lines[lines.length - 1].length + 1);
    }
  };

  const lines = content.split('\n');
  const lineCount = lines.length;
  const baseName = filename.split('/').pop() || filename;

  const shortcuts = [
    ['^G', 'Help'],
    ['^O', 'Write Out'],
    ['^W', 'Where Is'],
    ['^K', 'Cut'],
    ['^C', 'Location'],
    ['^X', 'Exit'],
    ['^R', 'Read File'],
    ['^U', 'Paste'],
  ];

  return (
    <div
      className="flex flex-col h-full font-mono text-sm"
      style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
    >
      {/* Title bar */}
      <div
        className="flex items-center justify-between h-8 px-4 text-xs border-b shrink-0"
        style={{
          background: 'var(--theme-elevated)',
          borderColor: 'var(--theme-border-strong)',
        }}
      >
        <div className="flex items-center gap-3">
          <span className="font-bold" style={{ color: 'var(--theme-accent)' }}>
            GNU nano 7.2
          </span>
          <span className="opacity-30">·</span>
          <span className="font-medium">
            {baseName}
            {modified ? ' (Modified)' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAction}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 text-[11px] font-sans font-medium transition-colors"
          >
            <Save size={11} />
            <span>Save (^O)</span>
          </button>
          <button
            onClick={onExit}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 hover:bg-rose-500/25 border border-rose-500/30 text-[11px] font-sans font-medium transition-colors"
          >
            <LogOut size={11} />
            <span>Exit (^X)</span>
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Line numbers */}
        <div
          className="flex flex-col items-end pr-3 pt-2 text-xs select-none border-r tabular-nums"
          style={{
            minWidth: '44px',
            color: 'var(--theme-muted)',
            background: 'var(--theme-surface)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="leading-5" style={{ height: '20px' }}>
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onClick={handleSelect}
          className="flex-1 bg-transparent outline-none resize-none p-2 leading-5"
          style={{
            fontSize: '13px',
            tabSize: 4,
            color: 'var(--theme-text)',
            caretColor: 'var(--theme-cursor)',
          }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Status bar */}
      <div
        className="h-6 flex items-center justify-between px-4 text-xs border-t tabular-nums shrink-0"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-text-secondary)',
        }}
      >
        {statusMsg ? (
          <span className="text-emerald-400 font-semibold">{statusMsg}</span>
        ) : (
          <span>
            Line {cursorLine}, Col {cursorCol}
            {modified ? ' · Modified' : ''}
          </span>
        )}
        <span className="opacity-60">{filename}</span>
      </div>

      {/* Shortcut bar */}
      <div
        className="flex flex-wrap gap-y-1 px-3 py-1.5 border-t shrink-0"
        style={{
          background: 'var(--theme-tab-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        {shortcuts.map(([key, label]) => (
          <div
            key={key}
            className="flex items-center mr-3 text-xs"
            style={{ minWidth: '115px' }}
          >
            <span
              className="px-1.5 py-0.5 font-bold rounded text-[10px]"
              style={{
                background: 'var(--theme-elevated)',
                color: 'var(--theme-accent)',
                border: '1px solid var(--theme-border-strong)',
              }}
            >
              {key}
            </span>
            <span
              className="ml-1.5 text-[11px]"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
