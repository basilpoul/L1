// VFS Node types
export interface VFSNode {
  name: string;
  type: 'file' | 'dir' | 'symlink';
  content?: string; // only for files
  target?: string; // target path for symlinks
  children?: Map<string, VFSNode>; // only for directories
  permissions: string; // e.g. 'rwxr-xr-x' or 'lrwxrwxrwx'
  owner: string; // 'user' | 'root'
  group: string; // 'user' | 'root'
  size: number;
  createdAt: Date;
  updatedAt: Date;
}

// Serializable version for localStorage
export interface SerializedVFSNode {
  name: string;
  type: 'file' | 'dir' | 'symlink';
  content?: string;
  target?: string;
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

export interface BackgroundJob {
  id: number; // 1, 2, 3...
  pid: number;
  command: string;
  status: 'Running' | 'Done' | 'Stopped';
  startTime: Date;
}

export interface StreamingState {
  type: 'watch' | 'tail';
  target: string;
  interval?: number;
  lastOutput?: string;
}

export interface ShellState {
  cwd: string;
  env: Record<string, string>;
  history: string[];
  aliases: Record<string, string>;
  lastExitCode: number;
  previousDir: string;
  isRoot: boolean; // sudo mode
  userStack?: { user: string; home: string; isRoot: boolean }[];
  remoteSession?: { host: string; hostname: string; user: string; cwd: string } | null;
  jobs?: BackgroundJob[];
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'system';
  content: string;
  html?: boolean; // if true, render as HTML
  timestamp: Date;
}

export interface TerminalPane {
  id: string;
  lines: TerminalLine[];
  shellState: ShellState;
  isRunning: boolean;
  nanoState?: NanoState | null;
  vimState?: VimState | null;
  streamingState?: StreamingState | null;
}

export interface TerminalTab {
  id: string;
  title: string;
  lines: TerminalLine[];
  shellState: ShellState;
  isRunning: boolean; // for async commands like ping
  nanoState?: NanoState | null;
  vimState?: VimState | null;
  panes?: TerminalPane[];
  activePaneId?: string;
  splitDirection?: 'horizontal' | 'vertical' | null;
}

export interface NanoState {
  filename: string;
  content: string;
  cursorLine: number;
  cursorCol: number;
  modified: boolean;
  scrollOffset: number;
}

export interface VimState {
  filename: string;
  content: string;
  mode?: 'NORMAL' | 'INSERT' | 'VISUAL' | 'COMMAND';
  cursorLine?: number;
  cursorCol?: number;
  modified?: boolean;
}

export type TerminalTheme = 'slate' | 'tokyo' | 'catppuccin' | 'dracula' | 'matrix';

export interface Mission {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master' | 'architect' | 'cloud-native';
  hint: string;
  validator: (vfs: any, history: string[]) => boolean;
  completed: boolean;
  isCustom?: boolean;
}

export interface K8sPod {
  name: string;
  namespace: string;
  ready: string;
  status: 'Running' | 'Pending' | 'Terminating' | 'CrashLoopBackOff';
  restarts: number;
  age: string;
  ip: string;
  node: string;
  deployment?: string;
  image?: string;
}

export interface K8sDeployment {
  name: string;
  namespace: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
  image: string;
  replicas: number;
}

export interface K8sService {
  name: string;
  namespace: string;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  clusterIP: string;
  externalIP: string;
  ports: string;
  age: string;
  selector: Record<string, string>;
}

export interface K8sClusterState {
  nodes: { name: string; status: string; roles: string; age: string; version: string; internalIP: string }[];
  namespaces: string[];
  deployments: K8sDeployment[];
  pods: K8sPod[];
  services: K8sService[];
}

export interface BlockDevice {
  name: string;
  majMin: string;
  rm: boolean;
  size: string;
  ro: boolean;
  type: 'disk' | 'part' | 'rom';
  mountpoint: string | null;
  fsType?: string;
  children?: BlockDevice[];
}

export interface StorageState {
  devices: BlockDevice[];
  mountedVolumes: Record<string, { device: string; mountpoint: string; files: Record<string, string> }>;
}

export interface RecordedSessionEvent {
  timestamp: number;
  type: 'command' | 'output' | 'error';
  data: string;
}

export interface RecordedSession {
  version: 2;
  width: number;
  height: number;
  timestamp: number;
  title: string;
  events: RecordedSessionEvent[];
}

export interface CustomMissionRule {
  type: 'file_exists' | 'file_contains' | 'command_executed' | 'service_active';
  target: string;
  pattern?: string;
}

export interface CustomMission {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master' | 'architect' | 'cloud-native';
  hint: string;
  rules: CustomMissionRule[];
  completed: boolean;
  isCustom: true;
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
