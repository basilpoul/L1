/**
 * Normalize a path: resolve '.', '..', remove trailing/double slashes.
 * Always returns an absolute path starting with '/'.
 */
export function normalizePath(path: string): string {
  // Replace backslashes
  let p = path.replace(/\\/g, '/');

  // Remove trailing slash (except for root)
  // Collapse multiple slashes
  p = p.replace(/\/+/g, '/');

  const parts = p.split('/');
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === '' || part === '.') {
      continue;
    } else if (part === '..') {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }

  const result = '/' + resolved.join('/');
  return result;
}

/**
 * Resolve a path against a current working directory and home directory.
 * Handles '~', '.', '..', and relative paths.
 */
export function resolvePath(path: string, cwd: string, home: string): string {
  if (!path || path === '') {
    return normalizePath(cwd);
  }

  let resolved: string;

  if (path === '~' || path.startsWith('~/')) {
    // Home directory expansion
    resolved = home + path.slice(1);
  } else if (path === '-') {
    // Previous directory - caller should handle this, but return cwd as fallback
    return normalizePath(cwd);
  } else if (path.startsWith('/')) {
    // Absolute path
    resolved = path;
  } else {
    // Relative path
    resolved = cwd + '/' + path;
  }

  return normalizePath(resolved);
}

/**
 * Get the parent directory of a path.
 * Returns '/' for top-level paths and root itself.
 */
export function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';

  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash <= 0) return '/';

  return normalized.slice(0, lastSlash);
}

/**
 * Get the basename (last component) of a path.
 */
export function getBasename(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';

  const lastSlash = normalized.lastIndexOf('/');
  return normalized.slice(lastSlash + 1);
}

/**
 * Join multiple path segments together and normalize.
 */
export function joinPath(...parts: string[]): string {
  if (parts.length === 0) return '/';

  let combined = parts[0];
  for (let i = 1; i < parts.length; i++) {
    if (parts[i].startsWith('/')) {
      combined = parts[i];
    } else {
      combined = combined + '/' + parts[i];
    }
  }

  return normalizePath(combined);
}

/**
 * Split a path into its component parts.
 * '/home/user' => ['home', 'user']
 * '/' => []
 */
export function splitPath(path: string): string[] {
  const normalized = normalizePath(path);
  if (normalized === '/') return [];

  return normalized.slice(1).split('/');
}

/**
 * Check if a path is absolute (starts with '/').
 */
export function isAbsolute(path: string): boolean {
  return path.startsWith('/');
}

/**
 * Simple glob matching supporting '*' and '?' wildcards.
 * '*' matches zero or more characters.
 * '?' matches exactly one character.
 */
export function matchGlob(name: string, pattern: string): boolean {
  // Convert glob pattern to regex
  let regexStr = '^';

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    switch (c) {
      case '*':
        regexStr += '.*';
        break;
      case '?':
        regexStr += '.';
        break;
      case '.':
      case '(':
      case ')':
      case '+':
      case '|':
      case '^':
      case '$':
      case '{':
      case '}':
      case '[':
      case ']':
      case '\\':
        regexStr += '\\' + c;
        break;
      default:
        regexStr += c;
    }
  }

  regexStr += '$';

  try {
    const regex = new RegExp(regexStr);
    return regex.test(name);
  } catch {
    return name === pattern;
  }
}
