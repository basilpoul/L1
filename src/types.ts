// VFS Node types
export interface VFSNode {
  name: string;
  type: 'file' | 'dir';
  content?: string; // only for files
  children?: Map<string, VFSNode>; // only for directories
  permissions: string; // e.g. 'rwxr-xr-x'
  owner: string; // 'user' | 'root'
  group: string; // 'user' | 'root'
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

// Serializable version for localStorage
export interface SerializedVFSNode {
  name: string;
  type: 'file' | 'dir';
  content?: string;
  children?: Record<string, SerializedVFSNode>;
  permissions: string;
  owner: string;
  group: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

// Shell types
export interface ParsedCommand {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
  rawArgs: string[]; // original args before flag parsing
}

export interface PipelineSegment {
  commands: ParsedCommand[];
  redirects: Redirect[];
}

export interface Redirect {
  type: '>' | '>>';
  target: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellState {
  cwd: string;
  env: Record<string, string>;
  history: string[];
  aliases: Record<string, string>;
  lastExitCode: number;
  previousDir: string;
  isRoot: boolean; // sudo mode
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  html?: boolean; // if true, render as HTML
  timestamp: Date;
}

export interface TerminalTab {
  id: string;
  title: string;
  lines: TerminalLine[];
  shellState: ShellState;
  isRunning: boolean; // for async commands like ping
  nanoState?: NanoState | null;
}

export interface NanoState {
  filename: string;
  content: string;
  cursorLine: number;
  cursorCol: number;
  modified: boolean;
  scrollOffset: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  hint: string;
  validator: (vfs: any, history: string[]) => boolean;
  completed: boolean;
}

export interface ProcessInfo {
  pid: number;
  user: string;
  cpu: string;
  mem: string;
  vsz: string;
  rss: string;
  tty: string;
  stat: string;
  start: string;
  time: string;
  command: string;
}
