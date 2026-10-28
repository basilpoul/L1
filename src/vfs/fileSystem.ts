import type { VFSNode, SerializedVFSNode, CommandResult } from '../types';
import { octalToPermissions } from './permissions';
import {
  normalizePath,
  splitPath,
  getParentPath,
  getBasename,
  joinPath,
  resolvePath,
} from './pathResolver';
import { createInitialFileSystem } from './initialData';

const STORAGE_KEY = 'linux-sim-vfs';
const SAVE_DEBOUNCE_MS = 500;

export class VirtualFileSystem {
  private root: VFSNode;
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const saved = this.loadFromStorage();
    if (saved) {
      this.root = saved;
    } else {
      this.root = createInitialFileSystem();
      this.save();
    }
  }

  // ─── Core Operations ───────────────────────────────────────────

  /**
   * Get a node by its absolute path.
   * If followSymlinks is true, transparently resolves symlink nodes to their target.
   */
  getNode(path: string, followSymlinks: boolean = true, depth: number = 0): VFSNode | null {
    if (depth > 12) return null; // recursion loop guard
    const normalized = normalizePath(path);
    if (normalized === '/') return this.root;

    const parts = splitPath(normalized);
    let current: VFSNode = this.root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      // If current node is a symlink, resolve it to its target directory
      if (current.type === 'symlink') {
        const target = current.target ? resolvePath(current.target, currentPath, '/home/user') : null;
        if (!target) return null;
        const targetNode = this.getNode(target, true, depth + 1);
        if (!targetNode) return null;
        current = targetNode;
      }

      if (current.type !== 'dir' || !current.children) {
        return null;
      }

      const child = current.children.get(part);
      if (!child) return null;

      currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;

      if (isLast) {
        if (child.type === 'symlink' && followSymlinks) {
          const parentOfLink = getParentPath(currentPath);
          const target = child.target ? resolvePath(child.target, parentOfLink, '/home/user') : null;
          if (!target) return null;
          return this.getNode(target, true, depth + 1);
        }
        return child;
      }

      current = child;
    }

    return current;
  }

  /**
   * Create a symbolic link pointing to targetPath.
   */
  createSymlink(
    linkPath: string,
    targetPath: string,
    owner: string = 'user',
  ): CommandResult {
    const normalized = normalizePath(linkPath);
    const parentPath = getParentPath(normalized);
    const linkName = getBasename(normalized);

    const parent = this.getNode(parentPath, true);
    if (!parent) {
      return {
        stdout: '',
        stderr: `ln: failed to create symbolic link '${linkPath}': No such file or directory`,
        exitCode: 1,
      };
    }
    if (parent.type !== 'dir' || !parent.children) {
      return {
        stdout: '',
        stderr: `ln: failed to create symbolic link '${linkPath}': Not a directory`,
        exitCode: 1,
      };
    }

    if (parent.children.has(linkName)) {
      return {
        stdout: '',
        stderr: `ln: failed to create symbolic link '${linkPath}': File exists`,
        exitCode: 1,
      };
    }

    const now = new Date();
    const node: VFSNode = {
      name: linkName,
      type: 'symlink',
      target: targetPath,
      permissions: 'rwxrwxrwx',
      owner,
      group: owner,
      size: targetPath.length,
      createdAt: now,
      updatedAt: now,
    };

    parent.children.set(linkName, node);
    parent.updatedAt = now;
    this.save();

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Create a file at the given path with content.
   */
  createFile(
    path: string,
    content: string,
    permissions: string = 'rw-r--r--',
    owner: string = 'user',
  ): CommandResult {
    const normalized = normalizePath(path);
    const parentPath = getParentPath(normalized);
    const fileName = getBasename(normalized);

    const parent = this.getNode(parentPath);
    if (!parent) {
      return {
        stdout: '',
        stderr: `cannot create file '${path}': No such file or directory`,
        exitCode: 1,
      };
    }
    if (parent.type !== 'dir' || !parent.children) {
      return {
        stdout: '',
        stderr: `cannot create file '${path}': Not a directory`,
        exitCode: 1,
      };
    }

    if (parent.children.has(fileName)) {
      return {
        stdout: '',
        stderr: `cannot create file '${path}': File exists`,
        exitCode: 1,
      };
    }

    const now = new Date();
    const node: VFSNode = {
      name: fileName,
      type: 'file',
      content,
      permissions,
      owner,
      group: owner,
      size: new Blob([content]).size,
      createdAt: now,
      updatedAt: now,
    };

    parent.children.set(fileName, node);
    parent.updatedAt = now;
    this.save();

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Create a directory at the given path.
   * If recursive is true, creates all intermediate directories.
   */
  createDirectory(
    path: string,
    recursive: boolean = false,
    permissions: string = 'rwxr-xr-x',
    owner: string = 'user',
  ): CommandResult {
    const normalized = normalizePath(path);

    if (recursive) {
      return this.mkdirRecursive(normalized, permissions, owner);
    }

    const parentPath = getParentPath(normalized);
    const dirName = getBasename(normalized);

    const parent = this.getNode(parentPath);
    if (!parent) {
      return {
        stdout: '',
        stderr: `cannot create directory '${path}': No such file or directory`,
        exitCode: 1,
      };
    }
    if (parent.type !== 'dir' || !parent.children) {
      return {
        stdout: '',
        stderr: `cannot create directory '${path}': Not a directory`,
        exitCode: 1,
      };
    }

    if (parent.children.has(dirName)) {
      return {
        stdout: '',
        stderr: `cannot create directory '${path}': File exists`,
        exitCode: 1,
      };
    }

    const now = new Date();
    const node: VFSNode = {
      name: dirName,
      type: 'dir',
      children: new Map(),
      permissions,
      owner,
      group: owner,
      size: 4096,
      createdAt: now,
      updatedAt: now,
    };

    parent.children.set(dirName, node);
    parent.updatedAt = now;
    this.save();

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Delete a node at the given path.
   * If recursive is true, deletes directories with contents.
   */
  deleteNode(path: string, recursive: boolean = false): CommandResult {
    const normalized = normalizePath(path);

    if (normalized === '/') {
      return {
        stdout: '',
        stderr: "cannot remove '/': Permission denied",
        exitCode: 1,
      };
    }

    const node = this.getNode(normalized);
    if (!node) {
      return {
        stdout: '',
        stderr: `cannot remove '${path}': No such file or directory`,
        exitCode: 1,
      };
    }

    if (node.type === 'dir' && !recursive) {
      if (node.children && node.children.size > 0) {
        return {
          stdout: '',
          stderr: `cannot remove '${path}': Is a directory`,
          exitCode: 1,
        };
      }
    }

    const parentPath = getParentPath(normalized);
    const name = getBasename(normalized);
    const parent = this.getNode(parentPath);

    if (!parent || !parent.children) {
      return {
        stdout: '',
        stderr: `cannot remove '${path}': No such file or directory`,
        exitCode: 1,
      };
    }

    parent.children.delete(name);
    parent.updatedAt = new Date();
    this.save();

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Copy a node from srcPath to destPath.
   */
  copyNode(
    srcPath: string,
    destPath: string,
    recursive: boolean = false,
  ): CommandResult {
    const srcNorm = normalizePath(srcPath);
    const destNorm = normalizePath(destPath);

    const srcNode = this.getNode(srcNorm);
    if (!srcNode) {
      return {
        stdout: '',
        stderr: `cannot stat '${srcPath}': No such file or directory`,
        exitCode: 1,
      };
    }

    if (srcNode.type === 'dir' && !recursive) {
      return {
        stdout: '',
        stderr: `cp: -r not specified; omitting directory '${srcPath}'`,
        exitCode: 1,
      };
    }

    // Determine final destination path
    let finalDestPath = destNorm;
    const destNode = this.getNode(destNorm);

    if (destNode && destNode.type === 'dir') {
      // Copy into destination directory
      finalDestPath = joinPath(destNorm, srcNode.name);
    }

    // Check if destination already exists
    const existing = this.getNode(finalDestPath);
    if (existing && existing.type === 'dir' && srcNode.type === 'file') {
      return {
        stdout: '',
        stderr: `cannot overwrite directory '${destPath}' with non-directory`,
        exitCode: 1,
      };
    }

    // Create the copy
    const cloned = this.deepCloneNode(srcNode, getBasename(finalDestPath));
    const parentPath = getParentPath(finalDestPath);
    const parent = this.getNode(parentPath);

    if (!parent || parent.type !== 'dir' || !parent.children) {
      return {
        stdout: '',
        stderr: `cannot create '${finalDestPath}': No such file or directory`,
        exitCode: 1,
      };
    }

    parent.children.set(cloned.name, cloned);
    parent.updatedAt = new Date();
    this.save();

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Move (rename) a node from srcPath to destPath.
   */
  moveNode(srcPath: string, destPath: string): CommandResult {
    const srcNorm = normalizePath(srcPath);
    const destNorm = normalizePath(destPath);

    if (srcNorm === '/') {
      return {
        stdout: '',
        stderr: "cannot move '/'",
        exitCode: 1,
      };
    }

    const srcNode = this.getNode(srcNorm);
    if (!srcNode) {
      return {
        stdout: '',
        stderr: `cannot stat '${srcPath}': No such file or directory`,
        exitCode: 1,
      };
    }

    // Determine final destination
    let finalDestPath = destNorm;
    const destNode = this.getNode(destNorm);

    if (destNode && destNode.type === 'dir') {
      finalDestPath = joinPath(destNorm, srcNode.name);
    }

    // Prevent moving a directory into itself
    if (finalDestPath.startsWith(srcNorm + '/') || finalDestPath === srcNorm) {
      return {
        stdout: '',
        stderr: `cannot move '${srcPath}' to a subdirectory of itself`,
        exitCode: 1,
      };
    }

    // Remove from source
    const srcParentPath = getParentPath(srcNorm);
    const srcName = getBasename(srcNorm);
    const srcParent = this.getNode(srcParentPath);

    if (!srcParent || !srcParent.children) {
      return {
        stdout: '',
        stderr: `cannot stat '${srcPath}': No such file or directory`,
        exitCode: 1,
      };
    }

    // Check destination parent exists
    const destParentPath = getParentPath(finalDestPath);
    const destName = getBasename(finalDestPath);
    const destParent = this.getNode(destParentPath);

    if (!destParent || destParent.type !== 'dir' || !destParent.children) {
      return {
        stdout: '',
        stderr: `cannot move to '${destPath}': No such file or directory`,
        exitCode: 1,
      };
    }

    // Perform the move
    srcParent.children.delete(srcName);
    srcParent.updatedAt = new Date();

    srcNode.name = destName;
    destParent.children.set(destName, srcNode);
    destParent.updatedAt = new Date();
    this.save();

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Read a file's content. Returns content in stdout.
   */
  readFile(path: string): CommandResult {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);

    if (!node) {
      return {
        stdout: '',
        stderr: `${path}: No such file or directory`,
        exitCode: 1,
      };
    }

    if (node.type === 'dir') {
      return {
        stdout: '',
        stderr: `${path}: Is a directory`,
        exitCode: 1,
      };
    }

    return {
      stdout: node.content ?? '',
      stderr: '',
      exitCode: 0,
    };
  }

  /**
   * Write content to a file. Creates the file if it doesn't exist.
   * If append is true, appends to existing content.
   */
  writeFile(
    path: string,
    content: string,
    append: boolean = false,
  ): CommandResult {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);

    if (node) {
      if (node.type === 'dir') {
        return {
          stdout: '',
          stderr: `${path}: Is a directory`,
          exitCode: 1,
        };
      }

      if (append) {
        node.content = (node.content ?? '') + content;
      } else {
        node.content = content;
      }

      node.size = new Blob([node.content]).size;
      node.updatedAt = new Date();
      this.save();

      return { stdout: '', stderr: '', exitCode: 0 };
    }

    // File doesn't exist — create it
    return this.createFile(normalized, content);
  }

  /**
   * List the children of a directory.
   */
  listDirectory(path: string): VFSNode[] | null {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);

    if (!node || node.type !== 'dir' || !node.children) {
      return null;
    }

    return Array.from(node.children.values());
  }

  // ─── Metadata ──────────────────────────────────────────────────

  /**
   * Set permissions on a node. Accepts octal ('755') or symbolic ('rwxr-xr-x').
   */
  setPermissions(path: string, permissions: string): CommandResult {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);

    if (!node) {
      return {
        stdout: '',
        stderr: `chmod: cannot access '${path}': No such file or directory`,
        exitCode: 1,
      };
    }

    // Convert octal to symbolic if needed
    let perm = permissions;
    if (/^\d{3,4}$/.test(permissions)) {
      perm = octalToPermissions(permissions);
    }

    node.permissions = perm;
    node.updatedAt = new Date();
    this.save();

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Set owner (and optionally group) on a node.
   */
  setOwner(path: string, owner: string, group?: string): CommandResult {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);

    if (!node) {
      return {
        stdout: '',
        stderr: `chown: cannot access '${path}': No such file or directory`,
        exitCode: 1,
      };
    }

    node.owner = owner;
    if (group !== undefined) {
      node.group = group;
    }
    node.updatedAt = new Date();
    this.save();

    return { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Get the size of a node. For directories, computes recursive size.
   */
  getSize(node: VFSNode): number {
    if (node.type === 'file') {
      return node.size;
    }

    let total = 4096; // directory entry size
    if (node.children) {
      for (const child of node.children.values()) {
        total += this.getSize(child);
      }
    }
    return total;
  }

  // ─── Persistence ───────────────────────────────────────────────

  /**
   * Save the VFS to localStorage with debouncing.
   */
  save(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      try {
        const serialized = this.serialize();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      } catch (e) {
        console.error('Failed to save VFS to localStorage:', e);
      }
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Reset the VFS to its initial state.
   */
  reset(): void {
    this.root = createInitialFileSystem();
    // Force immediate save on reset
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    try {
      const serialized = this.serialize();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch (e) {
      console.error('Failed to save VFS to localStorage:', e);
    }
  }

  // ─── Snapshots ────────────────────────────────────────────────
  /**
   * Export the entire Virtual File System state as a JSON string snapshot.
   */
  exportSnapshot(): string {
    return JSON.stringify(this.serialize(), null, 2);
  }

  /**
   * Import and restore a VFS snapshot from a JSON string.
   */
  importSnapshot(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      const root = VirtualFileSystem.deserialize(parsed);
      this.root = root;
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.serialize()));
      return true;
    } catch (e) {
      console.error('Failed to import VFS snapshot', e);
      return false;
    }
  }

  // ─── Serialization ────────────────────────────────────────────

  /**
   * Serialize the VFS tree to a plain JSON-safe object.
   */
  serialize(): SerializedVFSNode {
    return VirtualFileSystem.serializeNode(this.root);
  }

  private static serializeNode(node: VFSNode): SerializedVFSNode {
    const serialized: SerializedVFSNode = {
      name: node.name,
      type: node.type,
      permissions: node.permissions,
      owner: node.owner,
      group: node.group,
      size: node.size,
      createdAt: node.createdAt.toISOString(),
      updatedAt: node.updatedAt.toISOString(),
    };

    if (node.type === 'file') {
      serialized.content = node.content ?? '';
    }

    if (node.type === 'symlink') {
      serialized.target = node.target;
    }

    if (node.type === 'dir' && node.children) {
      serialized.children = {};
      for (const [name, child] of node.children) {
        serialized.children[name] = VirtualFileSystem.serializeNode(child);
      }
    }

    return serialized;
  }

  /**
   * Deserialize a plain object back into a VFSNode tree.
   */
  static deserialize(data: SerializedVFSNode): VFSNode {
    const node: VFSNode = {
      name: data.name,
      type: data.type,
      permissions: data.permissions,
      owner: data.owner,
      group: data.group,
      size: data.size,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    };

    if (data.type === 'file') {
      node.content = data.content ?? '';
    }

    if (data.type === 'symlink') {
      node.target = data.target;
    }

    if (data.type === 'dir' && data.children) {
      node.children = new Map();
      for (const [name, childData] of Object.entries(data.children)) {
        node.children.set(name, VirtualFileSystem.deserialize(childData));
      }
    }

    return node;
  }

  // ─── Traversal ─────────────────────────────────────────────────

  /**
   * Find all paths matching a predicate starting from startPath.
   */
  findNodes(
    startPath: string,
    predicate: (node: VFSNode, path: string) => boolean,
  ): string[] {
    const normalized = normalizePath(startPath);
    const startNode = this.getNode(normalized);
    if (!startNode) return [];

    const results: string[] = [];
    this.walkTree(startNode, normalized, predicate, results);
    return results;
  }

  /**
   * Generate an ASCII tree representation of the filesystem.
   */
  getTree(
    path: string,
    prefix: string = '',
    maxDepth: number = Infinity,
  ): string {
    const normalized = normalizePath(path);
    const node = this.getNode(normalized);
    if (!node) return '';

    const lines: string[] = [];
    // Root line
    lines.push(node.name === '/' ? '.' : node.name);
    if (node.type === 'dir' && node.children) {
      this.buildTree(node, prefix, 0, maxDepth, lines);
    }

    return lines.join('\n');
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private loadFromStorage(): VFSNode | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const data: SerializedVFSNode = JSON.parse(stored);
      return VirtualFileSystem.deserialize(data);
    } catch (e) {
      console.error('Failed to load VFS from localStorage:', e);
      return null;
    }
  }

  private mkdirRecursive(
    path: string,
    permissions: string,
    owner: string,
  ): CommandResult {
    const parts = splitPath(path);
    let currentPath = '';

    for (const part of parts) {
      currentPath += '/' + part;
      const existing = this.getNode(currentPath);

      if (existing) {
        if (existing.type !== 'dir') {
          return {
            stdout: '',
            stderr: `cannot create directory '${currentPath}': Not a directory`,
            exitCode: 1,
          };
        }
        // Directory already exists, continue
        continue;
      }

      // Create the intermediate directory
      const parentPath = getParentPath(currentPath);
      const dirName = getBasename(currentPath);
      const parent = this.getNode(parentPath);

      if (!parent || parent.type !== 'dir' || !parent.children) {
        return {
          stdout: '',
          stderr: `cannot create directory '${currentPath}': No such file or directory`,
          exitCode: 1,
        };
      }

      const now = new Date();
      const newDir: VFSNode = {
        name: dirName,
        type: 'dir',
        children: new Map(),
        permissions,
        owner,
        group: owner,
        size: 4096,
        createdAt: now,
        updatedAt: now,
      };

      parent.children.set(dirName, newDir);
      parent.updatedAt = now;
    }

    this.save();
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  private deepCloneNode(node: VFSNode, newName?: string): VFSNode {
    const now = new Date();
    const clone: VFSNode = {
      name: newName ?? node.name,
      type: node.type,
      permissions: node.permissions,
      owner: node.owner,
      group: node.group,
      size: node.size,
      createdAt: now,
      updatedAt: now,
    };

    if (node.type === 'file') {
      clone.content = node.content ?? '';
    }

    if (node.type === 'symlink') {
      clone.target = node.target;
    }

    if (node.type === 'dir' && node.children) {
      clone.children = new Map();
      for (const [childName, childNode] of node.children) {
        clone.children.set(childName, this.deepCloneNode(childNode));
      }
    }

    return clone;
  }

  private walkTree(
    node: VFSNode,
    currentPath: string,
    predicate: (node: VFSNode, path: string) => boolean,
    results: string[],
  ): void {
    if (predicate(node, currentPath)) {
      results.push(currentPath);
    }

    if (node.type === 'dir' && node.children) {
      for (const [name, child] of node.children) {
        const childPath =
          currentPath === '/' ? '/' + name : currentPath + '/' + name;
        this.walkTree(child, childPath, predicate, results);
      }
    }
  }

  private buildTree(
    node: VFSNode,
    prefix: string,
    depth: number,
    maxDepth: number,
    lines: string[],
  ): void {
    if (depth >= maxDepth) return;
    if (node.type !== 'dir' || !node.children) return;

    const entries = Array.from(node.children.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    entries.forEach((child, index) => {
      const isLast = index === entries.length - 1;
      const connector = isLast ? '└── ' : '├── ';
      const childPrefix = isLast ? '    ' : '│   ';

      lines.push(prefix + connector + child.name);

      if (child.type === 'dir' && child.children) {
        this.buildTree(child, prefix + childPrefix, depth + 1, maxDepth, lines);
      }
    });
  }
}
