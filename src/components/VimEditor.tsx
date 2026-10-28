import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VimEditorProps {
  filename: string;
  content: string;
  onSave: (newContent: string) => void;
  onExit: () => void;
}

type VimMode = 'NORMAL' | 'INSERT' | 'VISUAL' | 'COMMAND';

export const VimEditor: React.FC<VimEditorProps> = ({
  filename,
  content: initialContent,
  onSave,
  onExit,
}) => {
  const [lines, setLines] = useState<string[]>(() => {
    const split = initialContent.split('\n');
    return split.length === 0 ? [''] : split;
  });
  const [mode, setMode] = useState<VimMode>('NORMAL');
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  const [modified, setModified] = useState(false);
  const [commandBuffer, setCommandBuffer] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [visualStart, setVisualStart] = useState<{ line: number; col: number } | null>(null);
  const [searchPattern, setSearchPattern] = useState('');
  const [yankBuffer, setYankBuffer] = useState<{ text: string; isLine: boolean } | null>(null);
  const [undoStack, setUndoStack] = useState<string[][]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const lastKeyRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  const baseName = filename.split('/').pop() || filename;

  // Auto-focus the editor container
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const pushUndo = useCallback((currentLines: string[]) => {
    setUndoStack(prev => [...prev.slice(-30), currentLines]);
  }, []);

  // Clamp column within current line bounds
  const clampCol = useCallback((col: number, lineIdx: number, isInsertMode: boolean) => {
    const max = isInsertMode
      ? (lines[lineIdx] ? lines[lineIdx].length : 0)
      : Math.max(0, (lines[lineIdx] ? lines[lineIdx].length - 1 : 0));
    return Math.max(0, Math.min(col, max));
  }, [lines]);

  // Execute Vim command-line input (: or /)
  const executeCommand = useCallback(() => {
    if (commandBuffer.startsWith(':')) {
      const cmd = commandBuffer.slice(1).trim();

      if (cmd === 'w' || cmd.startsWith('w ')) {
        const fullText = lines.join('\n');
        onSave(fullText);
        setModified(false);
        const bytes = new Blob([fullText]).size;
        setStatusMessage(`"${baseName}" ${lines.length}L, ${bytes}B written`);
      } else if (cmd === 'q') {
        if (modified) {
          setStatusMessage('E37: No write since last change (add ! to override)');
        } else {
          onExit();
          return;
        }
      } else if (cmd === 'q!') {
        onExit();
        return;
      } else if (cmd === 'wq' || cmd === 'x' || cmd === 'wq!') {
        const fullText = lines.join('\n');
        onSave(fullText);
        onExit();
        return;
      } else if (cmd === 'set nu' || cmd === 'set number') {
        setShowLineNumbers(true);
        setStatusMessage('');
      } else if (cmd === 'set nonu' || cmd === 'set nonumber') {
        setShowLineNumbers(false);
        setStatusMessage('');
      } else if (cmd === 'help') {
        setStatusMessage('Vim commands: :w (write), :q (quit), :wq (save & quit), :q! (force quit), :set nu/nonu');
      } else if (cmd === '') {
        setStatusMessage('');
      } else {
        setStatusMessage(`E492: Not an editor command: ${cmd}`);
      }
    } else if (commandBuffer.startsWith('/')) {
      const pattern = commandBuffer.slice(1);
      if (pattern) {
        setSearchPattern(pattern);
        // Find first occurrence at or after cursor
        let foundLine = -1;
        let foundCol = -1;
        for (let l = cursorLine; l < lines.length; l++) {
          const startSearch = l === cursorLine ? cursorCol + 1 : 0;
          const idx = lines[l].indexOf(pattern, startSearch);
          if (idx !== -1) {
            foundLine = l;
            foundCol = idx;
            break;
          }
        }
        if (foundLine === -1) {
          // Wrap search from top
          for (let l = 0; l <= cursorLine; l++) {
            const idx = lines[l].indexOf(pattern);
            if (idx !== -1) {
              foundLine = l;
              foundCol = idx;
              break;
            }
          }
        }
        if (foundLine !== -1) {
          setCursorLine(foundLine);
          setCursorCol(foundCol);
          setStatusMessage(`/${pattern}`);
        } else {
          setStatusMessage(`E486: Pattern not found: ${pattern}`);
        }
      }
    }
    setCommandBuffer('');
    setMode('NORMAL');
  }, [commandBuffer, lines, modified, baseName, onSave, onExit, cursorLine, cursorCol]);

  // Jump to next or previous search match
  const jumpSearch = useCallback((forward: boolean) => {
    if (!searchPattern) return;
    const totalLines = lines.length;
    let found = false;

    if (forward) {
      for (let offset = 0; offset < totalLines; offset++) {
        const l = (cursorLine + offset) % totalLines;
        const startFrom = offset === 0 ? cursorCol + 1 : 0;
        const idx = lines[l].indexOf(searchPattern, startFrom);
        if (idx !== -1) {
          setCursorLine(l);
          setCursorCol(idx);
          found = true;
          break;
        }
      }
    } else {
      for (let offset = 0; offset < totalLines; offset++) {
        const l = (cursorLine - offset + totalLines) % totalLines;
        const endAt = offset === 0 ? cursorCol : lines[l].length;
        const idx = lines[l].lastIndexOf(searchPattern, endAt - 1);
        if (idx !== -1) {
          setCursorLine(l);
          setCursorCol(idx);
          found = true;
          break;
        }
      }
    }
    if (!found) {
      setStatusMessage(`Pattern not found: ${searchPattern}`);
    }
  }, [searchPattern, lines, cursorLine, cursorCol]);

  // Handle all keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // COMMAND MODE (typing : or /)
    if (mode === 'COMMAND') {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMode('NORMAL');
        setCommandBuffer('');
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        executeCommand();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        if (commandBuffer.length <= 1) {
          setMode('NORMAL');
          setCommandBuffer('');
        } else {
          setCommandBuffer(prev => prev.slice(0, -1));
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setCommandBuffer(prev => prev + e.key);
        return;
      }
      return;
    }

    // INSERT MODE
    if (mode === 'INSERT') {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMode('NORMAL');
        setCursorCol(prev => Math.max(0, prev - 1));
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursorCol(c => Math.max(0, c - 1));
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCursorCol(c => Math.min(lines[cursorLine]?.length || 0, c + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (cursorLine > 0) {
          setCursorLine(l => l - 1);
          setCursorCol(c => clampCol(c, cursorLine - 1, true));
        }
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (cursorLine < lines.length - 1) {
          setCursorLine(l => l + 1);
          setCursorCol(c => clampCol(c, cursorLine + 1, true));
        }
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        pushUndo(lines);
        if (cursorCol > 0) {
          const current = lines[cursorLine];
          const updated = current.slice(0, cursorCol - 1) + current.slice(cursorCol);
          const newLines = [...lines];
          newLines[cursorLine] = updated;
          setLines(newLines);
          setCursorCol(c => c - 1);
          setModified(true);
        } else if (cursorLine > 0) {
          const prevLine = lines[cursorLine - 1];
          const current = lines[cursorLine];
          const newLines = [...lines.slice(0, cursorLine - 1), prevLine + current, ...lines.slice(cursorLine + 1)];
          setLines(newLines);
          setCursorLine(l => l - 1);
          setCursorCol(prevLine.length);
          setModified(true);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        pushUndo(lines);
        const current = lines[cursorLine];
        const before = current.slice(0, cursorCol);
        const after = current.slice(cursorCol);
        const newLines = [...lines.slice(0, cursorLine), before, after, ...lines.slice(cursorLine + 1)];
        setLines(newLines);
        setCursorLine(l => l + 1);
        setCursorCol(0);
        setModified(true);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        pushUndo(lines);
        const current = lines[cursorLine];
        const updated = current.slice(0, cursorCol) + '  ' + current.slice(cursorCol);
        const newLines = [...lines];
        newLines[cursorLine] = updated;
        setLines(newLines);
        setCursorCol(c => c + 2);
        setModified(true);
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        pushUndo(lines);
        const current = lines[cursorLine] || '';
        const updated = current.slice(0, cursorCol) + e.key + current.slice(cursorCol);
        const newLines = [...lines];
        newLines[cursorLine] = updated;
        setLines(newLines);
        setCursorCol(c => c + 1);
        setModified(true);
        return;
      }
      return;
    }

    // VISUAL MODE
    if (mode === 'VISUAL') {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMode('NORMAL');
        setVisualStart(null);
        return;
      }
      if (e.key === 'd' || e.key === 'x') {
        e.preventDefault();
        if (visualStart) {
          pushUndo(lines);
          const startL = Math.min(visualStart.line, cursorLine);
          const endL = Math.max(visualStart.line, cursorLine);
          const deleted = lines.slice(startL, endL + 1).join('\n');
          setYankBuffer({ text: deleted, isLine: true });
          const newLines = [...lines.slice(0, startL), ...lines.slice(endL + 1)];
          setLines(newLines.length === 0 ? [''] : newLines);
          setCursorLine(Math.min(startL, Math.max(0, newLines.length - 1)));
          setCursorCol(0);
          setModified(true);
          setMode('NORMAL');
          setVisualStart(null);
        }
        return;
      }
      if (e.key === 'y') {
        e.preventDefault();
        if (visualStart) {
          const startL = Math.min(visualStart.line, cursorLine);
          const endL = Math.max(visualStart.line, cursorLine);
          const yanked = lines.slice(startL, endL + 1).join('\n');
          setYankBuffer({ text: yanked, isLine: true });
          setStatusMessage(`${endL - startL + 1} lines yanked`);
          setMode('NORMAL');
          setVisualStart(null);
        }
        return;
      }
    }

    // NORMAL MODE KEYBINDINGS
    if (mode === 'NORMAL' || mode === 'VISUAL') {
      const now = Date.now();
      const prevKey = lastKeyRef.current;
      const isDouble = (now - lastKeyTimeRef.current) < 600;
      lastKeyRef.current = e.key;
      lastKeyTimeRef.current = now;

      // Double-key combinations (gg, dd, yy)
      if (isDouble && prevKey === 'g' && e.key === 'g') {
        e.preventDefault();
        setCursorLine(0);
        setCursorCol(0);
        return;
      }

      if (isDouble && prevKey === 'd' && e.key === 'd') {
        e.preventDefault();
        pushUndo(lines);
        const removed = lines[cursorLine];
        setYankBuffer({ text: removed, isLine: true });
        const newLines = lines.length > 1
          ? [...lines.slice(0, cursorLine), ...lines.slice(cursorLine + 1)]
          : [''];
        setLines(newLines);
        setCursorLine(l => Math.min(l, newLines.length - 1));
        setCursorCol(c => clampCol(c, Math.min(cursorLine, newLines.length - 1), false));
        setModified(true);
        setStatusMessage('1 line less');
        return;
      }

      if (isDouble && prevKey === 'y' && e.key === 'y') {
        e.preventDefault();
        setYankBuffer({ text: lines[cursorLine], isLine: true });
        setStatusMessage('1 line yanked');
        return;
      }

      // Single Navigation keys
      if (e.key === 'h' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setCursorCol(c => Math.max(0, c - 1));
        return;
      }
      if (e.key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault();
        setCursorCol(c => clampCol(c + 1, cursorLine, false));
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (cursorLine > 0) {
          const nextL = cursorLine - 1;
          setCursorLine(nextL);
          setCursorCol(c => clampCol(c, nextL, false));
        }
        return;
      }
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (cursorLine < lines.length - 1) {
          const nextL = cursorLine + 1;
          setCursorLine(nextL);
          setCursorCol(c => clampCol(c, nextL, false));
        }
        return;
      }
      if (e.key === '0' || e.key === 'Home') {
        e.preventDefault();
        setCursorCol(0);
        return;
      }
      if (e.key === '$' || e.key === 'End') {
        e.preventDefault();
        setCursorCol(Math.max(0, (lines[cursorLine]?.length || 1) - 1));
        return;
      }
      if (e.key === 'G') {
        e.preventDefault();
        setCursorLine(lines.length - 1);
        setCursorCol(0);
        return;
      }
      if (e.key === 'w') {
        e.preventDefault();
        const curLine = lines[cursorLine] || '';
        const match = curLine.slice(cursorCol + 1).search(/\S/);
        if (match !== -1) {
          setCursorCol(cursorCol + 1 + match);
        } else if (cursorLine < lines.length - 1) {
          setCursorLine(cursorLine + 1);
          setCursorCol(0);
        }
        return;
      }
      if (e.key === 'b') {
        e.preventDefault();
        if (cursorCol > 0) {
          const curLine = lines[cursorLine] || '';
          const rev = curLine.slice(0, cursorCol).split('').reverse().join('');
          const match = rev.search(/\S/);
          if (match !== -1) {
            setCursorCol(cursorCol - 1 - match);
          } else {
            setCursorCol(0);
          }
        } else if (cursorLine > 0) {
          setCursorLine(cursorLine - 1);
          setCursorCol(Math.max(0, (lines[cursorLine - 1]?.length || 1) - 1));
        }
        return;
      }

      // Search navigation
      if (e.key === 'n') {
        e.preventDefault();
        jumpSearch(true);
        return;
      }
      if (e.key === 'N') {
        e.preventDefault();
        jumpSearch(false);
        return;
      }

      // Enter Command Mode
      if (e.key === ':') {
        e.preventDefault();
        setMode('COMMAND');
        setCommandBuffer(':');
        setStatusMessage('');
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        setMode('COMMAND');
        setCommandBuffer('/');
        setStatusMessage('');
        return;
      }

      // Enter Visual Mode
      if (e.key === 'v') {
        e.preventDefault();
        setMode('VISUAL');
        setVisualStart({ line: cursorLine, col: cursorCol });
        return;
      }

      // Enter Insert Mode Variations
      if (e.key === 'i') {
        e.preventDefault();
        setMode('INSERT');
        return;
      }
      if (e.key === 'a') {
        e.preventDefault();
        const curLineLen = lines[cursorLine]?.length || 0;
        setCursorCol(c => Math.min(curLineLen, c + 1));
        setMode('INSERT');
        return;
      }
      if (e.key === 'I') {
        e.preventDefault();
        const nonWs = (lines[cursorLine] || '').search(/\S/);
        setCursorCol(nonWs !== -1 ? nonWs : 0);
        setMode('INSERT');
        return;
      }
      if (e.key === 'A') {
        e.preventDefault();
        setCursorCol(lines[cursorLine]?.length || 0);
        setMode('INSERT');
        return;
      }
      if (e.key === 'o') {
        e.preventDefault();
        pushUndo(lines);
        const newLines = [...lines.slice(0, cursorLine + 1), '', ...lines.slice(cursorLine + 1)];
        setLines(newLines);
        setCursorLine(cursorLine + 1);
        setCursorCol(0);
        setModified(true);
        setMode('INSERT');
        return;
      }
      if (e.key === 'O') {
        e.preventDefault();
        pushUndo(lines);
        const newLines = [...lines.slice(0, cursorLine), '', ...lines.slice(cursorLine)];
        setLines(newLines);
        setCursorCol(0);
        setModified(true);
        setMode('INSERT');
        return;
      }

      // Character Deletion
      if (e.key === 'x') {
        e.preventDefault();
        const cur = lines[cursorLine];
        if (cur && cur.length > 0) {
          pushUndo(lines);
          const updated = cur.slice(0, cursorCol) + cur.slice(cursorCol + 1);
          const newLines = [...lines];
          newLines[cursorLine] = updated;
          setLines(newLines);
          setCursorCol(c => clampCol(c, cursorLine, false));
          setModified(true);
        }
        return;
      }

      // Paste
      if (e.key === 'p') {
        e.preventDefault();
        if (yankBuffer) {
          pushUndo(lines);
          if (yankBuffer.isLine) {
            const pasteLines = yankBuffer.text.split('\n');
            const newLines = [
              ...lines.slice(0, cursorLine + 1),
              ...pasteLines,
              ...lines.slice(cursorLine + 1),
            ];
            setLines(newLines);
            setCursorLine(cursorLine + 1);
            setCursorCol(0);
          } else {
            const cur = lines[cursorLine] || '';
            const updated = cur.slice(0, cursorCol + 1) + yankBuffer.text + cur.slice(cursorCol + 1);
            const newLines = [...lines];
            newLines[cursorLine] = updated;
            setLines(newLines);
            setCursorCol(c => c + yankBuffer.text.length);
          }
          setModified(true);
        }
        return;
      }

      // Undo
      if (e.key === 'u') {
        e.preventDefault();
        if (undoStack.length > 0) {
          const lastState = undoStack[undoStack.length - 1];
          setUndoStack(prev => prev.slice(0, -1));
          setLines(lastState);
          setCursorLine(l => Math.min(l, lastState.length - 1));
          setCursorCol(0);
          setModified(true);
          setStatusMessage('1 change; before #');
        } else {
          setStatusMessage('Already at oldest change');
        }
        return;
      }
    }
  };

  // Calculate percentage through file
  const pct = lines.length <= 1
    ? 'All'
    : cursorLine === 0
    ? 'Top'
    : cursorLine === lines.length - 1
    ? 'Bot'
    : `${Math.round(((cursorLine + 1) / lines.length) * 100)}%`;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => containerRef.current?.focus()}
      className="flex flex-col h-full font-mono text-sm outline-none select-none cursor-text"
      style={{ background: '#0f111a', color: '#c0caf5' }}
    >
      {/* Buffer Area */}
      <div className="flex-1 overflow-y-auto p-1 leading-5">
        {lines.map((lineText, lineIdx) => {
          const isCursorLine = lineIdx === cursorLine;
          const isSelected =
            mode === 'VISUAL' &&
            visualStart &&
            lineIdx >= Math.min(visualStart.line, cursorLine) &&
            lineIdx <= Math.max(visualStart.line, cursorLine);

          return (
            <div
              key={lineIdx}
              className={`flex items-start ${isCursorLine ? 'bg-slate-800/20' : ''}`}
            >
              {showLineNumbers && (
                <span
                  className="w-10 text-right pr-3 select-none text-xs shrink-0"
                  style={{ color: isCursorLine ? '#e0af68' : '#414868' }}
                >
                  {lineIdx + 1}
                </span>
              )}

              <div className="flex-1 whitespace-pre-wrap break-all min-h-[20px]">
                {lineText.length === 0 ? (
                  isCursorLine ? (
                    <span
                      className={`inline-block w-2 h-4 align-middle ${
                        mode === 'INSERT'
                          ? 'border-l-2 border-green-400 animate-pulse'
                          : 'bg-slate-300 text-black'
                      }`}
                    >
                      &nbsp;
                    </span>
                  ) : null
                ) : (
                  lineText.split('').map((char, charIdx) => {
                    const isCharCursor = isCursorLine && charIdx === cursorCol;
                    let bg = '';
                    let fg = '';

                    if (isCharCursor) {
                      if (mode === 'INSERT') {
                        bg = 'border-l-2 border-green-400';
                      } else {
                        bg = 'bg-slate-200 text-black';
                      }
                    } else if (isSelected) {
                      bg = 'bg-indigo-600/50 text-white';
                    }

                    return (
                      <span
                        key={charIdx}
                        className={`${bg} ${fg} ${isCharCursor && mode === 'NORMAL' ? 'font-bold' : ''}`}
                      >
                        {char}
                      </span>
                    );
                  })
                )}
                {/* When cursor is at the end of line in insert/normal mode */}
                {isCursorLine && cursorCol >= lineText.length && lineText.length > 0 && (
                  <span
                    className={`inline-block w-2 h-4 align-middle ${
                      mode === 'INSERT'
                        ? 'border-l-2 border-green-400 animate-pulse'
                        : 'bg-slate-300 text-black'
                    }`}
                  >
                    &nbsp;
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* Tildes below content (classic Vim) */}
        {Array.from({ length: Math.max(0, 16 - lines.length) }, (_, i) => (
          <div key={`tilde-${i}`} className="flex items-center text-blue-500/40 select-none">
            {showLineNumbers && <span className="w-10 text-right pr-3">&nbsp;</span>}
            <span>~</span>
          </div>
        ))}
      </div>

      {/* Bottom Status & Command Bar */}
      <div
        className="flex items-center justify-between px-3 py-1 text-xs select-none border-t border-slate-800"
        style={{ background: '#1a1b26' }}
      >
        <div className="flex items-center gap-3">
          {mode === 'COMMAND' ? (
            <span className="font-bold text-amber-400">{commandBuffer}</span>
          ) : mode === 'INSERT' ? (
            <span className="font-bold text-emerald-400">-- INSERT --</span>
          ) : mode === 'VISUAL' ? (
            <span className="font-bold text-purple-400">-- VISUAL --</span>
          ) : statusMessage ? (
            <span className="text-slate-300">{statusMessage}</span>
          ) : (
            <span className="text-slate-400">
              "{baseName}" {modified ? '[Modified] ' : ''}{lines.length} lines
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-slate-400 font-mono">
          <span>{pct}</span>
          <span>
            {cursorLine + 1},{cursorCol + 1}
          </span>
        </div>
      </div>
    </div>
  );
};
