import React, { useRef, useEffect, useState } from 'react';

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey) {
      if (e.key === 'o' || e.key === 's') {
        e.preventDefault();
        onSave();
        setStatusMsg('[ File saved ]');
        setTimeout(() => setStatusMsg(''), 2000);
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
    ['^G', 'Help'], ['^O', 'Write Out'], ['^W', 'Where Is'], ['^K', 'Cut'],
    ['^C', 'Location'], ['^X', 'Exit'], ['^R', 'Read File'], ['^U', 'Paste'],
  ];

  return (
    <div className="flex flex-col h-full font-mono text-sm" style={{ background: '#0f111a' }}>
      {/* Title bar */}
      <div className="flex items-center justify-center h-7 px-4 text-white text-xs" style={{ background: '#1e3a5f' }}>
        <span className="font-bold">GNU nano 7.2</span>
        <span className="ml-8">{baseName}{modified ? ' (Modified)' : ''}</span>
      </div>

      {/* Editor area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Line numbers */}
        <div className="flex flex-col items-end pr-2 pt-1 text-xs select-none" style={{ minWidth: '40px', color: '#4a5568', background: '#0d0f17' }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="leading-5" style={{ height: '20px' }}>{i + 1}</div>
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
          className="flex-1 bg-transparent text-slate-200 outline-none resize-none p-1 leading-5"
          style={{ fontSize: '13px', tabSize: 4 }}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Status bar */}
      <div className="h-5 flex items-center px-4 text-xs" style={{ background: '#141625', color: '#94a3b8' }}>
        {statusMsg ? (
          <span className="text-green-400">{statusMsg}</span>
        ) : (
          <span>Line {cursorLine}, Col {cursorCol}{modified ? ' — Modified' : ''}</span>
        )}
      </div>

      {/* Shortcut bar */}
      <div className="flex flex-wrap px-1 py-0.5" style={{ background: '#141625', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {shortcuts.map(([key, label]) => (
          <div key={key} className="flex items-center mr-2 text-xs" style={{ minWidth: '120px' }}>
            <span
              className="px-1 font-bold"
              style={{ background: '#e2e8f0', color: '#0f111a', borderRadius: '2px', fontSize: '11px' }}
            >
              {key}
            </span>
            <span className="ml-1 text-slate-500" style={{ fontSize: '11px' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
