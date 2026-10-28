// Shell Lexer - Tokenizes command strings into structured tokens
// Handles: whitespace, single/double quotes, pipes, redirects, &&, ;, escapes, $VAR/${VAR}

export type TokenType = 'word' | 'pipe' | 'redirect' | 'append' | 'and' | 'semicolon';

export interface Token {
  type: TokenType;
  value: string;
}

/**
 * Tokenize a shell command string into an array of tokens.
 *
 * Supports:
 * - Whitespace-separated words
 * - Single quotes: preserve literal content, no expansion
 * - Double quotes: allow variable expansion (handled later), preserve spaces
 * - Operators: | (pipe), > (redirect), >> (append), && (and), ; (semicolon)
 * - Backslash escaping outside of single quotes
 * - Variable references $VAR and ${VAR} are kept as-is in word tokens
 */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    // Skip whitespace
    if (input[i] === ' ' || input[i] === '\t') {
      i++;
      continue;
    }

    // Check for >> (append) — must check before single >
    if (input[i] === '>' && i + 1 < len && input[i + 1] === '>') {
      tokens.push({ type: 'append', value: '>>' });
      i += 2;
      continue;
    }

    // Check for > (redirect)
    if (input[i] === '>') {
      tokens.push({ type: 'redirect', value: '>' });
      i++;
      continue;
    }

    // Check for | (pipe) — but not ||
    if (input[i] === '|') {
      tokens.push({ type: 'pipe', value: '|' });
      i++;
      continue;
    }

    // Check for && (and)
    if (input[i] === '&' && i + 1 < len && input[i + 1] === '&') {
      tokens.push({ type: 'and', value: '&&' });
      i += 2;
      continue;
    }

    // Check for ; (semicolon)
    if (input[i] === ';') {
      tokens.push({ type: 'semicolon', value: ';' });
      i++;
      continue;
    }

    // Word token — accumulate characters, handling quotes and escapes
    let word = '';
    while (i < len) {
      const ch = input[i];

      // Unquoted whitespace ends the word
      if (ch === ' ' || ch === '\t') {
        break;
      }

      // Unquoted operator characters end the word
      if (ch === '|' || ch === ';') {
        break;
      }
      if (ch === '>' ) {
        break;
      }
      if (ch === '&' && i + 1 < len && input[i + 1] === '&') {
        break;
      }

      // Backslash escaping (outside quotes)
      if (ch === '\\' && i + 1 < len) {
        i++;
        word += input[i];
        i++;
        continue;
      }

      // Single-quoted string: everything is literal until closing quote
      if (ch === "'") {
        i++; // skip opening quote
        while (i < len && input[i] !== "'") {
          word += input[i];
          i++;
        }
        if (i < len) {
          i++; // skip closing quote
        }
        continue;
      }

      // Double-quoted string: allows escape sequences, content preserved as-is
      if (ch === '"') {
        i++; // skip opening quote
        while (i < len && input[i] !== '"') {
          if (input[i] === '\\' && i + 1 < len) {
            const next = input[i + 1];
            // In double quotes, backslash only escapes: $ ` " \ newline
            if (next === '$' || next === '`' || next === '"' || next === '\\' || next === '\n') {
              i++;
              word += input[i];
              i++;
              continue;
            }
          }
          word += input[i];
          i++;
        }
        if (i < len) {
          i++; // skip closing quote
        }
        continue;
      }

      // Normal character
      word += ch;
      i++;
    }

    if (word.length > 0) {
      tokens.push({ type: 'word', value: word });
    }
  }

  return tokens;
}
