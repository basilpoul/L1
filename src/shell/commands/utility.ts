import { registry } from '../commandRegistry';

export function registerUtilityCommands() {
  // history
  registry.register({
    name: 'history',
    description: 'Display command history',
    usage: 'history',
    flags: [],
    handler: (_args, _flags, shellState) => {
      const lines = shellState.history.map(
        (cmd, i) => `  ${String(i + 1).padStart(4)}  ${cmd}`
      );
      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // clear
  registry.register({
    name: 'clear',
    description: 'Clear the terminal screen',
    usage: 'clear',
    flags: [],
    handler: () => ({ stdout: '__CLEAR__', stderr: '', exitCode: 0 }),
  });

  // bash
  registry.register({
    name: 'bash',
    description: 'GNU Bourne-Again SHell and script interpreter',
    usage: 'bash [script.sh] [args...]',
    flags: [],
    handler: () => ({ stdout: 'LinuxSim bash, version 5.2.15(1)-release', stderr: '', exitCode: 0 }),
  });

  // sh
  registry.register({
    name: 'sh',
    description: 'POSIX compliant command interpreter',
    usage: 'sh [script.sh] [args...]',
    flags: [],
    handler: () => ({ stdout: 'LinuxSim sh, version 5.2.15', stderr: '', exitCode: 0 }),
  });

  // env
  registry.register({
    name: 'env',
    description: 'Display environment variables',
    usage: 'env',
    flags: [],
    handler: (_args, _flags, shellState) => {
      const lines = Object.entries(shellState.env)
        .filter(([k]) => k !== '?')
        .map(([k, v]) => `${k}=${v}`);
      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // export
  registry.register({
    name: 'export',
    description: 'Set environment variables',
    usage: 'export VAR=value',
    flags: [],
    handler: (args, _flags, shellState) => {
      if (args.length === 0) {
        const lines = Object.entries(shellState.env)
          .filter(([k]) => k !== '?')
          .map(([k, v]) => `declare -x ${k}="${v}"`);
        return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
      }
      // Handled in executor already, but as fallback:
      for (const arg of args) {
        const eqIdx = arg.indexOf('=');
        if (eqIdx !== -1) {
          shellState.env[arg.substring(0, eqIdx)] = arg.substring(eqIdx + 1);
        }
      }
      return { stdout: '', stderr: '', exitCode: 0 };
    },
  });

  // type
  registry.register({
    name: 'type',
    description: 'Display information about a command',
    usage: 'type <command>',
    flags: [],
    handler: (args, _flags, shellState) => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'type: missing argument', exitCode: 1 };
      }
      const name = args[0];
      const builtins = ['cd', 'export', 'unset', 'alias', 'unalias', 'type'];

      if (shellState.aliases[name]) {
        return { stdout: `${name} is aliased to '${shellState.aliases[name]}'`, stderr: '', exitCode: 0 };
      }
      if (builtins.includes(name)) {
        return { stdout: `${name} is a shell builtin`, stderr: '', exitCode: 0 };
      }
      if (registry.has(name)) {
        return { stdout: `${name} is /usr/bin/${name}`, stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: `type: ${name}: not found`, exitCode: 1 };
    },
  });

  // which
  registry.register({
    name: 'which',
    description: 'Locate a command',
    usage: 'which <command>',
    flags: [],
    handler: (args) => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'which: missing argument', exitCode: 1 };
      }
      const name = args[0];
      if (registry.has(name)) {
        return { stdout: `/usr/bin/${name}`, stderr: '', exitCode: 0 };
      }
      return { stdout: '', stderr: `which: no ${name} in (/usr/local/bin:/usr/bin:/bin)`, exitCode: 1 };
    },
  });

  // man
  registry.register({
    name: 'man',
    description: 'Display manual page for a command',
    usage: 'man <command>',
    flags: [],
    handler: (args) => {
      if (args.length === 0) {
        return { stdout: '', stderr: 'What manual page do you want?\nFor example, try \'man man\'.', exitCode: 1 };
      }

      const name = args[0];
      const cmd = registry.get(name);
      if (!cmd) {
        return { stdout: '', stderr: `No manual entry for ${name}`, exitCode: 1 };
      }

      const lines = [
        `<span style="font-weight:bold">${cmd.name.toUpperCase()}</span>(1)`,
        '',
        '<span style="font-weight:bold">NAME</span>',
        `       ${cmd.name} - ${cmd.description}`,
        '',
        '<span style="font-weight:bold">SYNOPSIS</span>',
        `       ${cmd.usage}`,
        '',
      ];

      if (cmd.flags.length > 0) {
        lines.push('<span style="font-weight:bold">OPTIONS</span>');
        for (const f of cmd.flags) {
          lines.push(`       <span style="font-weight:bold">${f.flag}</span>`);
          lines.push(`              ${f.description}`);
          lines.push('');
        }
      }

      lines.push('<span style="font-weight:bold">DESCRIPTION</span>');
      lines.push(`       ${cmd.description}.`);
      lines.push('');

      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });

  // help
  registry.register({
    name: 'help',
    description: 'List available commands',
    usage: 'help',
    flags: [],
    handler: () => {
      const allCmds = registry.getAll().sort((a, b) => a.name.localeCompare(b.name));
      const builtins = [
        { name: 'cd', desc: 'Change the current directory' },
        { name: 'alias', desc: 'Create command shortcuts' },
        { name: 'export', desc: 'Set environment variables' },
      ];

      const lines = [
        '<span style="font-weight:bold;color:#60a5fa">LinuxSim Shell — Available Commands</span>',
        '',
        '<span style="font-weight:bold;color:#fbbf24">Shell Builtins:</span>',
        ...builtins.map(c => `  <span style="color:#22d3ee">${c.name.padEnd(14)}</span>${c.desc}`),
        '',
        '<span style="font-weight:bold;color:#fbbf24">Registered Commands:</span>',
        ...allCmds.map(c => `  <span style="color:#22d3ee">${c.name.padEnd(14)}</span>${c.description}`),
        '',
        'Type <span style="color:#4ade80">man &lt;command&gt;</span> for detailed usage.',
      ];

      return { stdout: lines.join('\n'), stderr: '', exitCode: 0 };
    },
  });
}
