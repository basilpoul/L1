// Shell Parser - Parse tokens into structured pipeline chains
import type { Token } from './lexer';
import type { ParsedCommand, Redirect } from '../types';

/**
 * A pipeline is one or more stages connected by pipes.
 * Multiple pipelines can be chained with && or ;.
 */
export interface Pipeline {
  segments: PipelineStage[];
  chainOp?: '&&' | ';'; // operator that follows this pipeline (connecting it to the next)
}

export interface PipelineStage {
  command: ParsedCommand;
  redirects: Redirect[];
}

/**
 * Expand combined short flags like -la into -l -a.
 * Leaves long flags (--help) and single char flags (-l) as-is.
 */
function expandFlags(args: string[]): string[] {
  const result: string[] = [];
  for (const arg of args) {
    // Combined short flags: starts with single dash, more than 2 chars, no = sign, not a negative number
    if (
      arg.startsWith('-') &&
      !arg.startsWith('--') &&
      arg.length > 2 &&
      !arg.includes('=') &&
      !/^-\d+/.test(arg)
    ) {
      // Expand each character into its own flag
      for (let i = 1; i < arg.length; i++) {
        result.push('-' + arg[i]);
      }
    } else {
      result.push(arg);
    }
  }
  return result;
}

/**
 * Parse an array of flag-expanded args into flags and positional arguments.
 *
 * Rules:
 * - `--flag` → { flag: true }
 * - `--flag=value` → { flag: "value" }
 * - `-f` → { f: true }
 * - `-n 10` where n is a flag that takes a value → handled by the caller (we treat it as { n: true } here
 *    and let the caller decide, unless the next arg looks like a value)
 * - `--` stops flag parsing; everything after is positional
 * - Non-flag args are positional
 */
export function parseFlags(args: string[]): {
  flags: Record<string, string | boolean>;
  positional: string[];
} {
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  let stopParsing = false;

  const expanded = expandFlags(args);

  for (let i = 0; i < expanded.length; i++) {
    const arg = expanded[i];

    if (stopParsing) {
      positional.push(arg);
      continue;
    }

    if (arg === '--') {
      stopParsing = true;
      continue;
    }

    // Long flag: --name or --name=value
    if (arg.startsWith('--')) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        flags[arg.substring(2, eqIdx)] = arg.substring(eqIdx + 1);
      } else {
        flags[arg.substring(2)] = true;
      }
      continue;
    }

    // Short flag: -x
    if (arg.startsWith('-') && arg.length === 2 && !/^\d$/.test(arg[1])) {
      const flagChar = arg[1];
      // Peek at the next arg to see if it's a value for this flag
      if (i + 1 < expanded.length && !expanded[i + 1].startsWith('-')) {
        // Could be a value — we'll store it. Commands can decide if they want it.
        // Heuristic: if next arg looks like a file path or number, treat as value
        const next = expanded[i + 1];
        if (/^\d+$/.test(next)) {
          flags[flagChar] = next;
          i++;
        } else {
          flags[flagChar] = true;
        }
      } else {
        flags[flagChar] = true;
      }
      continue;
    }

    // Not a flag — positional
    positional.push(arg);
  }

  return { flags, positional };
}

/**
 * Parse a token array into an array of Pipeline chains.
 *
 * 1. Split on `;` and `&&` to get chains.
 * 2. Within each chain, split on `|` to get pipeline stages.
 * 3. For each stage, extract redirect tokens and build a ParsedCommand.
 */
export function parseTokens(tokens: Token[]): Pipeline[] {
  if (tokens.length === 0) return [];

  const pipelines: Pipeline[] = [];

  // Split into chains by ; and &&
  const chains: { tokens: Token[]; chainOp?: '&&' | ';' }[] = [];
  let currentChainTokens: Token[] = [];

  for (const token of tokens) {
    if (token.type === 'and' || token.type === 'semicolon') {
      if (currentChainTokens.length > 0) {
        chains.push({
          tokens: currentChainTokens,
          chainOp: token.type === 'and' ? '&&' : ';',
        });
        currentChainTokens = [];
      }
    } else {
      currentChainTokens.push(token);
    }
  }

  // Last chain (no trailing operator)
  if (currentChainTokens.length > 0) {
    chains.push({ tokens: currentChainTokens });
  }

  for (const chain of chains) {
    const pipeline: Pipeline = {
      segments: [],
      chainOp: chain.chainOp,
    };

    // Split chain tokens by pipe
    const stages: Token[][] = [];
    let currentStageTokens: Token[] = [];

    for (const token of chain.tokens) {
      if (token.type === 'pipe') {
        if (currentStageTokens.length > 0) {
          stages.push(currentStageTokens);
          currentStageTokens = [];
        }
      } else {
        currentStageTokens.push(token);
      }
    }
    if (currentStageTokens.length > 0) {
      stages.push(currentStageTokens);
    }

    // Process each stage
    for (const stageTokens of stages) {
      const redirects: Redirect[] = [];
      const words: string[] = [];

      for (let i = 0; i < stageTokens.length; i++) {
        const tok = stageTokens[i];

        if (tok.type === 'redirect' || tok.type === 'append') {
          // Next word token is the redirect target
          const redirectType: '>' | '>>' = tok.type === 'append' ? '>>' : '>';
          if (i + 1 < stageTokens.length && stageTokens[i + 1].type === 'word') {
            redirects.push({ type: redirectType, target: stageTokens[i + 1].value });
            i++; // skip target
          }
        } else if (tok.type === 'word') {
          words.push(tok.value);
        }
      }

      if (words.length === 0) continue;

      const command = words[0];
      const rawArgs = words.slice(1);
      const { flags, positional } = parseFlags(rawArgs);

      pipeline.segments.push({
        command: {
          command,
          args: positional,
          flags,
          rawArgs,
        },
        redirects,
      });
    }

    if (pipeline.segments.length > 0) {
      pipelines.push(pipeline);
    }
  }

  return pipelines;
}
