import { registry } from '../commandRegistry';
import type { CommandResult, BackgroundJob } from '../../types';
import { resolvePath } from '../../vfs/pathResolver';
import { executeCommand } from '../executor';

export function registerJobControlCommands() {
  // sleep
  registry.register({
    name: 'sleep',
    description: 'Delay for a specified amount of time',
    usage: 'sleep <seconds>',
    flags: [],
    handler: async (args, _flags, _shellState, _vfs, _stdin, context): Promise<CommandResult> => {
      const sec = parseFloat(args[0]) || 1;
      if (!context) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      let aborted = false;
      context.onCtrlC(() => {
        aborted = true;
      });
      context.setRunning(true);

      const ms = Math.min(sec * 1000, 30000); // cap max foreground sleep to 30s for responsiveness
      const step = 100;
      let elapsed = 0;

      while (elapsed < ms && !aborted) {
        await new Promise((resolve) => setTimeout(resolve, step));
        elapsed += step;
      }

      context.setRunning(false);
      return { stdout: '', stderr: '', exitCode: aborted ? 130 : 0 };
    },
  });

  // jobs
  registry.register({
    name: 'jobs',
    description: 'List active background jobs',
    usage: 'jobs [-l]',
    flags: [{ flag: '-l', description: 'List process IDs in addition to normal information' }],
    handler: (_args, flags, shellState): CommandResult => {
      const jobs = shellState.jobs || [];
      const showPids = Boolean(flags['l']);

      if (jobs.length === 0) {
        return { stdout: '', stderr: '', exitCode: 0 };
      }

      const lines = jobs.map((job, idx) => {
        const marker = idx === jobs.length - 1 ? '+' : '-';
        if (showPids) {
          return `[${job.id}]${marker}  ${job.pid} ${job.status.padEnd(10)} ${job.command} &`;
        }
        return `[${job.id}]${marker}  ${job.status.padEnd(10)} ${job.command} &`;
      });

      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // fg
  registry.register({
    name: 'fg',
    description: 'Bring a background job into the foreground',
    usage: 'fg [%job_id]',
    flags: [],
    handler: async (args, _flags, shellState, _vfs, _stdin, context): Promise<CommandResult> => {
      const jobs = shellState.jobs || [];
      if (jobs.length === 0) {
        return { stdout: '', stderr: 'fg: current: no such job', exitCode: 1 };
      }

      let targetJob: BackgroundJob | undefined;
      if (args[0]) {
        const cleanId = parseInt(args[0].replace('%', ''), 10);
        targetJob = jobs.find((j) => j.id === cleanId || j.pid === cleanId);
      } else {
        targetJob = jobs[jobs.length - 1];
      }

      if (!targetJob) {
        return { stdout: '', stderr: `fg: ${args[0] || ''}: no such job`, exitCode: 1 };
      }

      // Output the command being brought to foreground
      context?.addLine('output', targetJob.command);

      // Remove from background jobs
      shellState.jobs = jobs.filter((j) => j.id !== targetJob!.id);

      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // bg
  registry.register({
    name: 'bg',
    description: 'Resume a suspended job in the background',
    usage: 'bg [%job_id]',
    flags: [],
    handler: (args, _flags, shellState): CommandResult => {
      const jobs = shellState.jobs || [];
      if (jobs.length === 0) {
        return { stdout: '', stderr: 'bg: current: no such job', exitCode: 1 };
      }

      let targetJob: BackgroundJob | undefined;
      if (args[0]) {
        const cleanId = parseInt(args[0].replace('%', ''), 10);
        targetJob = jobs.find((j) => j.id === cleanId || j.pid === cleanId);
      } else {
        targetJob = jobs[jobs.length - 1];
      }

      if (!targetJob) {
        return { stdout: '', stderr: `bg: ${args[0] || ''}: no such job`, exitCode: 1 };
      }

      targetJob.status = 'Running';
      return { stdout: `[${targetJob.id}]+ ${targetJob.command} &`, stderr: '', exitCode: 0 };
    },
  });

  // nohup
  registry.register({
    name: 'nohup',
    description: 'Run a command immune to hangups',
    usage: 'nohup <command> [args...]',
    flags: [],
    handler: async (args, _flags, shellState, vfs, _stdin, context): Promise<CommandResult> => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'nohup: missing operand', exitCode: 1 };
      }

      const innerCmd = args.join(' ');
      const msg = "nohup: ignoring input and appending output to 'nohup.out'";

      if (context) {
        context.addLine('output', msg);
      }

      const res = await executeCommand(innerCmd, shellState, vfs, {
        ...context!,
        addLine: () => {},
        setRunning: () => {},
      });

      const outPath = resolvePath('nohup.out', shellState.cwd, shellState.env['HOME'] || '/home/user');
      const existing = vfs.getNode(outPath)?.content || '';
      const newContent = (existing ? existing + '\n' : '') + (res.stdout || res.stderr);
      vfs.writeFile(outPath, newContent);

      return { stdout: '', stderr: '', exitCode: res.exitCode };
    },
  });

  // tmux
  registry.register({
    name: 'tmux',
    description: 'Terminal multiplexer',
    usage: 'tmux [split-window -h | -v]',
    flags: [],
    handler: (args, _flags, _shellState, _vfs, _stdin, context): CommandResult => {
      if (!context?.triggerSplit) {
        return { stdout: 'tmux: split panes supported in terminal window toolbar', stderr: '', exitCode: 0 };
      }

      const isVertical = args.includes('-v') || (args.includes('split-window') && args.includes('-v'));
      const direction = isVertical ? 'vertical' : 'horizontal';

      context.triggerSplit(direction);
      return { stdout: `[tmux] pane created (${direction} split)`, stderr: '', exitCode: 0 };
    },
  });

  // watch
  registry.register({
    name: 'watch',
    description: 'Execute a program periodically, showing output fullscreen',
    usage: 'watch [-n <seconds>] <command>',
    flags: [{ flag: '-n', description: 'Interval in seconds (default 2)' }],
    handler: (args, flags, _shellState, _vfs, _stdin, context): CommandResult => {
      if (!context?.setStreamingState) {
        return { stdout: '', stderr: 'watch: streaming context not available', exitCode: 1 };
      }

      const intervalSec = typeof flags['n'] === 'string' ? parseFloat(flags['n']) : 2;
      const cmdToWatch = args.join(' ');

      if (!cmdToWatch) {
        return { stdout: '', stderr: 'watch: missing command to watch', exitCode: 1 };
      }

      context.setStreamingState({
        type: 'watch',
        target: cmdToWatch,
        interval: intervalSec,
      });

      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });
}
