// Command Registry - Central registry for all shell commands
import type { VirtualFileSystem } from '../vfs/fileSystem';
import type { CommandResult, ShellState } from '../types';

/**
 * Handler function signature for a shell command.
 */
export type CommandHandler = (
  args: string[],
  flags: Record<string, string | boolean>,
  shellState: ShellState,
  vfs: VirtualFileSystem,
  stdin?: string,
  context?: ExecutionContext
) => CommandResult | Promise<CommandResult>;

/**
 * Execution context provided to commands that need interactive/streaming behavior.
 */
export interface ExecutionContext {
  addLine: (type: 'output' | 'error' | 'system', content: string, html?: boolean) => void;
  setRunning: (running: boolean) => void;
  onCtrlC: (handler: () => void) => void;
  setNanoState: (state: any) => void;
}

/**
 * Full command metadata including handler, description, and flag info.
 */
export interface CommandInfo {
  name: string;
  description: string;
  usage: string;
  flags: { flag: string; description: string }[];
  handler: CommandHandler;
}

/**
 * Central registry that commands register themselves with.
 * Provides lookup and enumeration of available commands.
 */
class CommandRegistry {
  private commands: Map<string, CommandInfo> = new Map();

  /**
   * Register a new command. Overwrites any existing command with the same name.
   */
  register(info: CommandInfo): void {
    this.commands.set(info.name, info);
  }

  /**
   * Look up a command by name.
   */
  get(name: string): CommandInfo | undefined {
    return this.commands.get(name);
  }

  /**
   * Check if a command is registered.
   */
  has(name: string): boolean {
    return this.commands.has(name);
  }

  /**
   * Get all registered command info objects.
   */
  getAll(): CommandInfo[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get all registered command names, sorted alphabetically.
   */
  getNames(): string[] {
    return Array.from(this.commands.keys()).sort();
  }
}

/** Singleton command registry instance. */
export const registry = new CommandRegistry();
