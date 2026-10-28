import type { VFSNode } from '../types';

export interface PermissionSet {
  r: boolean;
  w: boolean;
  x: boolean;
}

export interface ParsedPermissions {
  owner: PermissionSet;
  group: PermissionSet;
  other: PermissionSet;
}

/**
 * Parse a permission string like 'rwxr-xr-x' into structured object.
 * Also handles sticky bit notation like 'rwxrwxrwt'.
 */
export function parsePermissions(perm: string): ParsedPermissions {
  // Normalize: strip leading 'd', 'l', or '-' if 10 chars
  const p = perm.length === 10 ? perm.slice(1) : perm;

  return {
    owner: {
      r: p[0] === 'r',
      w: p[1] === 'w',
      x: p[2] === 'x' || p[2] === 's' || p[2] === 'S',
    },
    group: {
      r: p[3] === 'r',
      w: p[4] === 'w',
      x: p[5] === 'x' || p[5] === 's' || p[5] === 'S',
    },
    other: {
      r: p[6] === 'r',
      w: p[7] === 'w',
      x: p[8] === 'x' || p[8] === 't' || p[8] === 'T',
    },
  };
}

/**
 * Convert 'rwxr-xr-x' to '755'.
 * Handles sticky bit 't'/'T' as leading '1'.
 */
export function permissionsToOctal(perm: string): string {
  const p = perm.length === 10 ? perm.slice(1) : perm;

  const tripleToOctal = (r: string, w: string, x: string): number => {
    let val = 0;
    if (r === 'r') val += 4;
    if (w === 'w') val += 2;
    if (x === 'x' || x === 's' || x === 't') val += 1;
    return val;
  };

  const owner = tripleToOctal(p[0], p[1], p[2]);
  const group = tripleToOctal(p[3], p[4], p[5]);
  const other = tripleToOctal(p[6], p[7], p[8]);

  // Special bits
  let special = 0;
  if (p[2] === 's' || p[2] === 'S') special += 4; // setuid
  if (p[5] === 's' || p[5] === 'S') special += 2; // setgid
  if (p[8] === 't' || p[8] === 'T') special += 1; // sticky

  if (special > 0) {
    return `${special}${owner}${group}${other}`;
  }
  return `${owner}${group}${other}`;
}

/**
 * Convert '755' to 'rwxr-xr-x'.
 * Also handles 4-digit octal like '1777'.
 */
export function octalToPermissions(octal: string): string {
  const digitToTriple = (d: number): string => {
    let s = '';
    s += d & 4 ? 'r' : '-';
    s += d & 2 ? 'w' : '-';
    s += d & 1 ? 'x' : '-';
    return s;
  };

  let special = 0;
  let ownerDigit: number;
  let groupDigit: number;
  let otherDigit: number;

  if (octal.length === 4) {
    special = parseInt(octal[0], 10);
    ownerDigit = parseInt(octal[1], 10);
    groupDigit = parseInt(octal[2], 10);
    otherDigit = parseInt(octal[3], 10);
  } else {
    ownerDigit = parseInt(octal[0], 10);
    groupDigit = parseInt(octal[1], 10);
    otherDigit = parseInt(octal[2], 10);
  }

  let result = digitToTriple(ownerDigit) + digitToTriple(groupDigit) + digitToTriple(otherDigit);

  // Apply special bits
  const chars = result.split('');
  if (special & 4) {
    // setuid
    chars[2] = chars[2] === 'x' ? 's' : 'S';
  }
  if (special & 2) {
    // setgid
    chars[5] = chars[5] === 'x' ? 's' : 'S';
  }
  if (special & 1) {
    // sticky
    chars[8] = chars[8] === 'x' ? 't' : 'T';
  }

  return chars.join('');
}

/**
 * Apply symbolic mode changes like '+x', '-w', 'u+x', 'go-w', 'a+r', 'u=rwx', etc.
 * Supports comma-separated modes like 'u+x,go-w'.
 */
export function applySymbolicMode(current: string, mode: string): string {
  // Check if mode is purely numeric (octal)
  if (/^\d{3,4}$/.test(mode)) {
    return octalToPermissions(mode);
  }

  const p = current.length === 10 ? current.slice(1) : current;
  const chars = p.split('');

  const parts = mode.split(',');

  for (const part of parts) {
    // Parse symbolic mode: [ugoa]*[+-=][rwxXst]*
    const match = part.match(/^([ugoa]*)([+\-=])([rwxXst]*)$/);
    if (!match) continue;

    let who = match[1];
    const op = match[2];
    const what = match[3];

    // Default to 'a' if no who specified
    if (who === '' || who === 'a') {
      who = 'ugo';
    }

    // Determine which permission bits to affect
    const bits = { r: what.includes('r'), w: what.includes('w'), x: what.includes('x') || what.includes('X') };

    const applyToTriple = (offset: number) => {
      if (op === '+') {
        if (bits.r) chars[offset] = 'r';
        if (bits.w) chars[offset + 1] = 'w';
        if (bits.x) chars[offset + 2] = 'x';
      } else if (op === '-') {
        if (bits.r) chars[offset] = '-';
        if (bits.w) chars[offset + 1] = '-';
        if (bits.x) chars[offset + 2] = '-';
      } else if (op === '=') {
        chars[offset] = bits.r ? 'r' : '-';
        chars[offset + 1] = bits.w ? 'w' : '-';
        chars[offset + 2] = bits.x ? 'x' : '-';
      }
    };

    if (who.includes('u')) applyToTriple(0);
    if (who.includes('g')) applyToTriple(3);
    if (who.includes('o')) applyToTriple(6);
  }

  return chars.join('');
}

/**
 * Check if a user has permission to perform an action on a node.
 */
export function checkPermission(
  node: VFSNode,
  action: 'read' | 'write' | 'execute',
  currentUser: string,
  isRoot: boolean,
): boolean {
  // Root can do anything
  if (isRoot) return true;

  const parsed = parsePermissions(node.permissions);

  let perm: PermissionSet;
  if (node.owner === currentUser) {
    perm = parsed.owner;
  } else if (node.group === currentUser) {
    perm = parsed.group;
  } else {
    perm = parsed.other;
  }

  switch (action) {
    case 'read':
      return perm.r;
    case 'write':
      return perm.w;
    case 'execute':
      return perm.x;
    default:
      return false;
  }
}

/**
 * Format permissions with type prefix: 'drwxr-xr-x' for dirs, '-rwxr-xr-x' for files.
 */
export function formatPermissions(node: VFSNode): string {
  const prefix = node.type === 'dir' ? 'd' : '-';
  return prefix + node.permissions;
}
