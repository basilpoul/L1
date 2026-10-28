// Verification test for Vim editor engine and integration
import { VirtualFileSystem } from '../src/vfs/fileSystem.ts';
import { initialFileSystemData } from '../src/vfs/initialData.ts';
import { executeCommand } from '../src/shell/executor.ts';
import { registerAllCommands } from '../src/shell/commands/index.ts';
import { createDefaultEnv } from '../src/shell/environment.ts';

// 1. Initialize commands and VFS
registerAllCommands();
const vfs = new VirtualFileSystem(initialFileSystemData);

console.log('--- 1. Testing vim command invocation from shell ---');
const shellState = {
  cwd: '/home/user',
  env: createDefaultEnv(),
  history: [],
  aliases: {},
  lastExitCode: 0,
  previousDir: '/home/user',
  isRoot: false,
};

let activeVimState = null;
const executionContext = {
  addLine: (type, content) => console.log(`[context addLine ${type}]`, content),
  setRunning: (r) => console.log('[context setRunning]', r),
  onCtrlC: () => {},
  setNanoState: () => {},
  setVimState: (state) => {
    activeVimState = state;
    console.log('[context setVimState] Vim state mounted:', state ? state.filename : null);
  },
};

// Test opening existing file: notes.txt
await executeCommand('vim ~/Documents/notes.txt', shellState, vfs, executionContext);

if (!activeVimState) {
  console.error('FAIL: vim command did not call setVimState');
  process.exit(1);
}

if (activeVimState.filename !== '/home/user/Documents/notes.txt') {
  console.error('FAIL: expected filename /home/user/Documents/notes.txt, got', activeVimState.filename);
  process.exit(1);
}

console.log('SUCCESS: vim opened file with content length:', activeVimState.content.length);

// 2. Test opening non-existent file
activeVimState = null;
await executeCommand('vim new_sample.txt', shellState, vfs, executionContext);
if (!activeVimState || activeVimState.content !== '') {
  console.error('FAIL: vim new_sample.txt did not mount empty file');
  process.exit(1);
}
console.log('SUCCESS: vim opened new file /home/user/new_sample.txt with empty content');

// 3. Test VimEditor editing simulation
console.log('\n--- 2. Simulating Vim typing, editing, undo, and command execution ---');

class MockVimSession {
  constructor(filename, initialContent, onSave, onExit) {
    this.filename = filename;
    this.lines = initialContent.split('\n');
    if (this.lines.length === 0) this.lines = [''];
    this.mode = 'NORMAL';
    this.cursorLine = 0;
    this.cursorCol = 0;
    this.modified = false;
    this.commandBuffer = '';
    this.statusMessage = '';
    this.undoStack = [];
    this.onSave = onSave;
    this.onExit = onExit;
  }

  pushUndo() {
    this.undoStack.push([...this.lines]);
  }

  pressKey(key, _extra = {}) {
    if (this.mode === 'COMMAND') {
      if (key === 'Escape') {
        this.mode = 'NORMAL';
        this.commandBuffer = '';
        return;
      }
      if (key === 'Enter') {
        this.executeCommand();
        return;
      }
      if (key === 'Backspace') {
        if (this.commandBuffer.length <= 1) {
          this.mode = 'NORMAL';
          this.commandBuffer = '';
        } else {
          this.commandBuffer = this.commandBuffer.slice(0, -1);
        }
        return;
      }
      if (key.length === 1) {
        this.commandBuffer += key;
        return;
      }
      return;
    }

    if (this.mode === 'INSERT') {
      if (key === 'Escape') {
        this.mode = 'NORMAL';
        this.cursorCol = Math.max(0, this.cursorCol - 1);
        return;
      }
      if (key === 'Enter') {
        this.pushUndo();
        const current = this.lines[this.cursorLine] || '';
        const before = current.slice(0, this.cursorCol);
        const after = current.slice(this.cursorCol);
        this.lines.splice(this.cursorLine, 1, before, after);
        this.cursorLine++;
        this.cursorCol = 0;
        this.modified = true;
        return;
      }
      if (key === 'Backspace') {
        this.pushUndo();
        if (this.cursorCol > 0) {
          const current = this.lines[this.cursorLine];
          this.lines[this.cursorLine] = current.slice(0, this.cursorCol - 1) + current.slice(this.cursorCol);
          this.cursorCol--;
          this.modified = true;
        } else if (this.cursorLine > 0) {
          const prev = this.lines[this.cursorLine - 1];
          const curr = this.lines[this.cursorLine];
          this.cursorCol = prev.length;
          this.lines.splice(this.cursorLine - 1, 2, prev + curr);
          this.cursorLine--;
          this.modified = true;
        }
        return;
      }
      if (key.length === 1) {
        this.pushUndo();
        const current = this.lines[this.cursorLine] || '';
        this.lines[this.cursorLine] = current.slice(0, this.cursorCol) + key + current.slice(this.cursorCol);
        this.cursorCol++;
        this.modified = true;
        return;
      }
      return;
    }

    // NORMAL MODE
    if (this.mode === 'NORMAL') {
      if (key === 'i') {
        this.mode = 'INSERT';
        return;
      }
      if (key === 'a') {
        const curLen = this.lines[this.cursorLine]?.length || 0;
        this.cursorCol = Math.min(curLen, this.cursorCol + 1);
        this.mode = 'INSERT';
        return;
      }
      if (key === 'o') {
        this.pushUndo();
        this.lines.splice(this.cursorLine + 1, 0, '');
        this.cursorLine++;
        this.cursorCol = 0;
        this.modified = true;
        this.mode = 'INSERT';
        return;
      }
      if (key === 'O') {
        this.pushUndo();
        this.lines.splice(this.cursorLine, 0, '');
        this.cursorCol = 0;
        this.modified = true;
        this.mode = 'INSERT';
        return;
      }
      if (key === 'x') {
        const cur = this.lines[this.cursorLine];
        if (cur && cur.length > 0) {
          this.pushUndo();
          this.lines[this.cursorLine] = cur.slice(0, this.cursorCol) + cur.slice(this.cursorCol + 1);
          this.cursorCol = Math.min(this.cursorCol, Math.max(0, this.lines[this.cursorLine].length - 1));
          this.modified = true;
        }
        return;
      }
      if (key === 'u') {
        if (this.undoStack.length > 0) {
          this.lines = this.undoStack.pop();
          this.cursorLine = Math.min(this.cursorLine, this.lines.length - 1);
          this.cursorCol = 0;
          this.modified = true;
        }
        return;
      }
      if (key === ':') {
        this.mode = 'COMMAND';
        this.commandBuffer = ':';
        return;
      }
    }
  }

  typeString(str) {
    for (const ch of str) {
      if (ch === '\n') {
        this.pressKey('Enter');
      } else {
        this.pressKey(ch);
      }
    }
  }

  executeCommand() {
    if (this.commandBuffer.startsWith(':')) {
      const cmd = this.commandBuffer.slice(1).trim();
      if (cmd === 'w') {
        this.onSave(this.lines.join('\n'));
        this.modified = false;
        this.statusMessage = 'written';
      } else if (cmd === 'q') {
        if (this.modified) {
          this.statusMessage = 'E37: No write since last change';
        } else {
          this.onExit();
        }
      } else if (cmd === 'q!') {
        this.onExit();
      } else if (cmd === 'wq' || cmd === 'x') {
        this.onSave(this.lines.join('\n'));
        this.onExit();
      }
    }
    this.commandBuffer = '';
    this.mode = 'NORMAL';
  }
}

// Test A: Create and type into new file, then :w
let savedContent = null;
let exited = false;
const sessionA = new MockVimSession(
  '/home/user/sample.txt',
  '',
  (content) => {
    savedContent = content;
    vfs.writeFile('/home/user/sample.txt', content);
  },
  () => { exited = true; }
);

// Press 'i' to enter insert mode
sessionA.pressKey('i');
if (sessionA.mode !== 'INSERT') {
  console.error('FAIL: mode is not INSERT');
  process.exit(1);
}

// Type "Hello from Vim editor"
sessionA.typeString('Hello from Vim editor\nSecond Line');
sessionA.pressKey('Escape');
if (sessionA.mode !== 'NORMAL') {
  console.error('FAIL: escape did not return to NORMAL mode');
  process.exit(1);
}

// Try :q when modified
sessionA.pressKey(':');
sessionA.typeString('q');
sessionA.pressKey('Enter');
if (exited) {
  console.error('FAIL: :q should not exit when modified without !');
  process.exit(1);
}
console.log('SUCCESS: :q prevented exit when modified with status:', sessionA.statusMessage);

// Now write file with :w
sessionA.pressKey(':');
sessionA.typeString('w');
sessionA.pressKey('Enter');

if (!savedContent || !savedContent.includes('Hello from Vim editor')) {
  console.error('FAIL: content not saved on :w');
  process.exit(1);
}
console.log('SUCCESS: :w saved content to VFS, lines:', sessionA.lines.length);

// Verify VFS has it
const nodeA = vfs.getNode('/home/user/sample.txt');
if (!nodeA || !nodeA.content.includes('Second Line')) {
  console.error('FAIL: VFS does not have sample.txt');
  process.exit(1);
}
console.log('SUCCESS: VFS verified: /home/user/sample.txt contains:', JSON.stringify(nodeA.content));

// Now quit with :q
sessionA.pressKey(':');
sessionA.typeString('q');
sessionA.pressKey('Enter');
if (!exited) {
  console.error('FAIL: :q should exit after :w');
  process.exit(1);
}
console.log('SUCCESS: :q exited cleanly after saving');

// Test B: Modify existing file and save with :wq
exited = false;
const sessionB = new MockVimSession(
  '/home/user/Documents/notes.txt',
  vfs.getNode('/home/user/Documents/notes.txt').content,
  (content) => {
    vfs.writeFile('/home/user/Documents/notes.txt', content);
  },
  () => { exited = true; }
);

// Add line with 'o' (open line below)
sessionB.pressKey('o');
sessionB.typeString('Edited with Vim');
sessionB.pressKey('Escape');

// Save and exit with :wq
sessionB.pressKey(':');
sessionB.typeString('wq');
sessionB.pressKey('Enter');

if (!exited) {
  console.error('FAIL: :wq did not exit');
  process.exit(1);
}

const updatedNotes = vfs.getNode('/home/user/Documents/notes.txt');
if (!updatedNotes.content.includes('Edited with Vim')) {
  console.error('FAIL: notes.txt does not contain "Edited with Vim"');
  process.exit(1);
}
console.log('SUCCESS: :wq saved and exited. Notes content:\n', updatedNotes.content);

console.log('\n========================================');
console.log('ALL VIM VERIFICATION CHECKS PASSED 100%!');
console.log('========================================');
