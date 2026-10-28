// Shell Environment - Manage environment variables and variable expansion

/**
 * Create the default set of environment variables for a fresh shell session.
 */
export function createDefaultEnv(): Record<string, string> {
  return {
    USER: 'user',
    HOSTNAME: 'linux-box',
    HOME: '/home/user',
    PWD: '/home/user',
    PATH: '/usr/local/bin:/usr/bin:/bin',
    SHELL: '/bin/bash',
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    EDITOR: 'nano',
  };
}

/**
 * Expand $VAR and ${VAR} references within a string.
 * Single-quoted regions are left untouched (literal).
 * Double-quoted regions allow variable expansion.
 * Backslash-escaped $ signs are preserved literally.
 */
export function expandVariables(input: string, env: Record<string, string>): string {
  let result = '';
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    // Single-quoted region: copy everything literally until closing quote
    if (ch === "'") {
      result += "'";
      i++;
      while (i < len && input[i] !== "'") {
        result += input[i];
        i++;
      }
      if (i < len) {
        result += "'";
        i++; // skip closing quote
      }
      continue;
    }

    // Backslash escape for $
    if (ch === '\\' && i + 1 < len && input[i + 1] === '$') {
      result += '$';
      i += 2;
      continue;
    }

    // Variable expansion
    if (ch === '$') {
      // ${VAR} form
      if (i + 1 < len && input[i + 1] === '{') {
        const closeBrace = input.indexOf('}', i + 2);
        if (closeBrace !== -1) {
          const varName = input.substring(i + 2, closeBrace);
          result += env[varName] ?? '';
          i = closeBrace + 1;
          continue;
        }
      }

      // $? special variable (exit code) — handled at a higher level, pass through
      if (i + 1 < len && input[i + 1] === '?') {
        result += env['?'] ?? '0';
        i += 2;
        continue;
      }

      // $VAR form — variable name consists of alphanumeric and underscores
      let varName = '';
      let j = i + 1;
      while (j < len && /[A-Za-z0-9_]/.test(input[j])) {
        varName += input[j];
        j++;
      }
      if (varName.length > 0) {
        result += env[varName] ?? '';
        i = j;
        continue;
      }

      // Lone $ — just append it
      result += ch;
      i++;
      continue;
    }

    // Regular character
    result += ch;
    i++;
  }

  return result;
}
