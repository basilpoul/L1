import { registry } from '../commandRegistry';
import type { CommandResult, ShellState, RecordedSession, RecordedSessionEvent } from '../../types';
import type { VirtualFileSystem } from '../../vfs/fileSystem';
import { resolvePath } from '../../vfs/pathResolver';

interface ActiveRecording {
  filename: string;
  startTime: number;
  events: RecordedSessionEvent[];
}

let activeRecording: ActiveRecording | null = null;

export function isRecordingSession(): boolean {
  return activeRecording !== null;
}

export function recordSessionEvent(type: 'command' | 'output' | 'error', data: string) {
  if (!activeRecording) return;
  const elapsed = Math.round((Date.now() - activeRecording.startTime) / 10) / 100; // seconds with 2 decimals
  activeRecording.events.push({
    timestamp: elapsed,
    type,
    data,
  });
}

export function finishRecording(vfs: VirtualFileSystem): { filename: string; count: number } | null {
  if (!activeRecording) return null;
  const rec = activeRecording;
  activeRecording = null;

  const sessionObj: RecordedSession = {
    version: 2,
    width: 80,
    height: 24,
    timestamp: Math.floor(rec.startTime / 1000),
    title: 'LinuxSim Terminal Session',
    events: rec.events,
  };

  vfs.writeFile(rec.filename, JSON.stringify(sessionObj, null, 2));
  return { filename: rec.filename, count: rec.events.length };
}

function resolve(filepath: string, shellState: ShellState): string {
  return resolvePath(filepath, shellState.cwd, shellState.env['HOME'] || '/home/user');
}

export function registerRecorderCommands() {
  // ==================== SCRIPT ====================
  registry.register({
    name: 'script',
    description: 'Make typescript of terminal session',
    usage: 'script [-a] [--stop] [filename.cast]',
    flags: [
      { flag: '-a', description: 'Append to output' },
      { flag: '--stop', description: 'Stop active recording session' },
    ],
    handler: (args, flags, shellState, vfs): CommandResult => {
      if (flags['stop'] || args[0] === '--stop' || args[0] === 'stop') {
        if (!activeRecording) {
          return { stdout: '', stderr: 'script: no active recording session', exitCode: 1 };
        }
        const res = finishRecording(vfs);
        return {
          stdout: `Script done, file is ${res?.filename || 'typescript'}`,
          stderr: '',
          exitCode: 0,
        };
      }

      if (activeRecording) {
        return {
          stdout: `script: session already being recorded to ${activeRecording.filename}. Type "exit" or "script --stop" to finish.`,
          stderr: '',
          exitCode: 0,
        };
      }

      const fileArg = args[0] || 'typescript.cast';
      const fullPath = resolve(fileArg, shellState);

      activeRecording = {
        filename: fullPath,
        startTime: Date.now(),
        events: [],
      };

      return {
        stdout: `Script started, file is ${fileArg}\nTiming data will be recorded in asciicast format. Run commands or type "exit" to finish.`,
        stderr: '',
        exitCode: 0,
      };
    },
  });

  // ==================== REPLAY ====================
  registry.register({
    name: 'replay',
    description: 'Replay a recorded terminal session (.cast)',
    usage: 'replay <filename.cast>',
    flags: [],
    handler: async (args, _flags, shellState, vfs, _stdin, context): Promise<CommandResult> => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'replay: missing filename.cast argument', exitCode: 1 };
      }

      const fileArg = args[0];
      const fullPath = resolve(fileArg, shellState);
      const node = vfs.getNode(fullPath, true);

      if (!node || !node.content) {
        return { stdout: '', stderr: `replay: ${fileArg}: No such file or directory`, exitCode: 1 };
      }

      let session: RecordedSession;
      try {
        session = JSON.parse(node.content);
      } catch {
        return { stdout: '', stderr: `replay: ${fileArg}: Invalid or corrupt session format`, exitCode: 1 };
      }

      if (!session.events || !Array.isArray(session.events)) {
        return { stdout: '', stderr: `replay: ${fileArg}: Missing events stream in session`, exitCode: 1 };
      }

      if (!context) {
        return { stdout: `[replay] Loaded session with ${session.events.length} events`, stderr: '', exitCode: 0 };
      }

      let aborted = false;
      context.onCtrlC(() => {
        aborted = true;
      });
      context.setRunning(true);

      context.addLine('system', `[ Replaying session "${session.title || fileArg}" (${session.events.length} events) - Press Ctrl+C to stop ]`);

      for (let i = 0; i < session.events.length; i++) {
        if (aborted) break;
        const ev = session.events[i];
        await new Promise((r) => setTimeout(r, 400));
        if (aborted) break;

        if (ev.type === 'command') {
          context.addLine('output', `<span style="color:#4ade80;font-weight:bold">user@linux-box</span>:<span style="color:#60a5fa;font-weight:bold">~</span>$ ${ev.data}`, true);
        } else if (ev.type === 'error') {
          context.addLine('error', ev.data);
        } else {
          context.addLine('output', ev.data);
        }
      }

      context.setRunning(false);
      return { stdout: aborted ? '\n[ Replay aborted ]' : '\n[ Replay finished ]', stderr: '', exitCode: 0 };
    },
  });
}
