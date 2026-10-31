import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  File,
  ChevronRight,
  ArrowUp,
  Eye,
  X,
  FilePlus,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Edit3,
  Link as LinkIcon,
  Search,
  Check,
} from 'lucide-react';
import type { VFSNode } from '../types';
import { VirtualFileSystem } from '../vfs/fileSystem';
import { formatPermissions } from '../vfs/permissions';

interface FileExplorerGUIProps {
  vfs: VirtualFileSystem;
  version: number;
  cwd: string;
  onNavigate: (path: string) => void;
  onOpenNano?: (path: string) => void;
  onRefresh?: () => void;
  onClose?: () => void;
}

function getFileIcon(node: VFSNode) {
  if (node.type === 'dir') return <Folder size={14} className="text-blue-400 shrink-0" />;
  if (node.type === 'symlink') return <LinkIcon size={14} className="text-cyan-400 shrink-0" />;
  const ext = node.name.split('.').pop()?.toLowerCase();
  if (['sh', 'bash'].includes(ext || '')) return <FileCode size={14} className="text-emerald-400 shrink-0" />;
  if (['json', 'js', 'ts', 'tsx', 'yaml', 'yml'].includes(ext || ''))
    return <FileCode size={14} className="text-amber-400 shrink-0" />;
  if (['md', 'txt', 'log', 'conf'].includes(ext || ''))
    return <FileText size={14} className="text-slate-400 shrink-0" />;
  return <File size={14} className="text-slate-500 shrink-0" />;
}

function getFileColor(node: VFSNode): string {
  if (node.type === 'dir') return 'var(--theme-dir)';
  if (node.type === 'symlink') return '#22d3ee';
  if (node.permissions.includes('x') && node.type === 'file') return 'var(--theme-user)';
  return 'var(--theme-text)';
}

function formatDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export const FileExplorerGUI: React.FC<FileExplorerGUIProps> = ({
  vfs,
  version,
  cwd,
  onNavigate,
  onOpenNano,
  onRefresh,
  onClose,
}) => {
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [selectedFile, setSelectedFile] = useState<{ node: VFSNode; path: string } | null>(null);
  const [filterQuery, setFilterQuery] = useState('');
  const [creatingMode, setCreatingMode] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const createInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingMode) {
      setTimeout(() => createInputRef.current?.focus(), 30);
    }
  }, [creatingMode]);

  const entries = useMemo(() => {
    const node = vfs.getNode(currentPath, false);
    if (!node || node.type !== 'dir' || !node.children) return [];
    const children = Array.from(node.children.values());
    const q = filterQuery.toLowerCase().trim();
    const filtered = q ? children.filter((c) => c.name.toLowerCase().includes(q)) : children;
    return filtered.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, vfs, version, filterQuery]);

  const breadcrumbs = useMemo(() => {
    if (currentPath === '/') return [{ name: 'root', path: '/' }];
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: '/', path: '/' }];
    let acc = '';
    for (const part of parts) {
      acc += '/' + part;
      crumbs.push({ name: part, path: acc });
    }
    return crumbs;
  }, [currentPath]);

  useEffect(() => {
    if (cwd && vfs.getNode(cwd)) {
      setCurrentPath(cwd);
    }
  }, [cwd, vfs]);

  const navigateTo = (path: string) => {
    setCurrentPath(path);
    setSelectedFile(null);
    setConfirmDelete(false);
    onNavigate(path);
  };

  const handleClick = (node: VFSNode) => {
    const itemPath = currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`;
    setConfirmDelete(false);
    if (node.type === 'dir') {
      navigateTo(itemPath);
    } else if (node.type === 'symlink') {
      const resolved = vfs.getNode(itemPath, true);
      if (resolved && resolved.type === 'dir') {
        navigateTo(itemPath);
      } else {
        setSelectedFile({ node, path: itemPath });
      }
    } else {
      setSelectedFile({ node, path: itemPath });
    }
  };

  const goUp = () => {
    if (currentPath === '/') return;
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    navigateTo(parent);
  };

  const handleConfirmCreate = () => {
    const trimmed = newItemName.trim();
    if (!trimmed || !creatingMode) {
      setCreatingMode(null);
      setNewItemName('');
      return;
    }
    const target = currentPath === '/' ? `/${trimmed}` : `${currentPath}/${trimmed}`;
    if (creatingMode === 'file') {
      vfs.createFile(target, '');
    } else {
      vfs.createDirectory(target);
    }
    setCreatingMode(null);
    setNewItemName('');
    onRefresh?.();
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      const target = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      vfs.writeFile(target, content);
      onRefresh?.();
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownloadFile = () => {
    if (!selectedFile) return;
    const content = selectedFile.node.content ?? '';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedFile.node.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDeleteItem = () => {
    if (!selectedFile) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    vfs.deleteNode(selectedFile.path, true);
    setSelectedFile(null);
    setConfirmDelete(false);
    onRefresh?.();
  };

  return (
    <div
      className="flex flex-col h-full border-l select-none"
      style={{
        background: 'var(--theme-surface)',
        borderColor: 'var(--theme-border)',
        color: 'var(--theme-text)',
      }}
    >
      {/* Panel Header & Action Toolbar */}
      <div
        className="flex items-center justify-between px-3.5 h-10 border-b shrink-0"
        style={{
          background: 'var(--theme-tab-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <FolderOpen size={14} style={{ color: 'var(--theme-dir)' }} />
          <span className="text-xs font-semibold tracking-tight">Virtual File System</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setCreatingMode('file');
              setNewItemName('');
            }}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
            title="New File"
          >
            <FilePlus size={13} />
          </button>
          <button
            onClick={() => {
              setCreatingMode('folder');
              setNewItemName('');
            }}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
            title="New Directory"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
            title="Upload Local File"
          >
            <Upload size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUploadFile}
          />
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-white/[0.06] transition-colors lg:hidden"
              style={{ color: 'var(--theme-text-secondary)' }}
              title="Close File Explorer"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Interactive Path Breadcrumbs */}
      <div
        className="flex items-center gap-0.5 px-3.5 py-2 flex-wrap border-b text-xs font-mono"
        style={{ borderColor: 'var(--theme-border)' }}
      >
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.path}>
            {i > 0 && <ChevronRight size={11} className="opacity-40 mx-0.5" />}
            <button
              onClick={() => navigateTo(crumb.path)}
              className="hover:underline transition-colors"
              style={{
                color:
                  i === breadcrumbs.length - 1
                    ? 'var(--theme-dir)'
                    : 'var(--theme-text-secondary)',
              }}
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Filter Bar */}
      <div
        className="px-3 py-1.5 border-b flex items-center gap-2"
        style={{
          background: 'var(--theme-bg)',
          borderColor: 'var(--theme-border)',
        }}
      >
        <Search size={12} style={{ color: 'var(--theme-muted)' }} />
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter directory entries..."
          className="bg-transparent text-xs outline-none w-full placeholder:opacity-45"
          style={{ color: 'var(--theme-text)' }}
        />
        {filterQuery && (
          <button
            onClick={() => setFilterQuery('')}
            className="opacity-60 hover:opacity-100"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Inline File / Folder Creation Row */}
      {creatingMode && (
        <div
          className="px-3 py-2 border-b flex items-center gap-1.5 animate-fadeIn"
          style={{
            background: 'var(--theme-elevated)',
            borderColor: 'var(--theme-border-strong)',
          }}
        >
          {creatingMode === 'folder' ? (
            <Folder size={13} className="text-blue-400 shrink-0" />
          ) : (
            <File size={13} className="text-emerald-400 shrink-0" />
          )}
          <input
            ref={createInputRef}
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreate();
              if (e.key === 'Escape') {
                setCreatingMode(null);
                setNewItemName('');
              }
            }}
            placeholder={creatingMode === 'folder' ? 'New folder name...' : 'New file name...'}
            className="flex-1 bg-transparent text-xs font-mono outline-none"
            style={{ color: 'var(--theme-text)' }}
          />
          <button
            onClick={handleConfirmCreate}
            className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
            title="Create"
          >
            <Check size={12} />
          </button>
          <button
            onClick={() => {
              setCreatingMode(null);
              setNewItemName('');
            }}
            className="p-1 rounded hover:bg-white/10 opacity-70"
            title="Cancel"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* High-Density File List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/[0.02]">
        {currentPath !== '/' && (
          <div
            onClick={goUp}
            className="flex items-center gap-2.5 px-3.5 py-2 cursor-pointer hover:bg-white/[0.04] transition-colors"
          >
            <ArrowUp size={13} style={{ color: 'var(--theme-dir)' }} />
            <span className="text-xs font-mono" style={{ color: 'var(--theme-dir)' }}>
              ..
            </span>
            <span className="text-[11px] ml-auto opacity-45">Parent directory</span>
          </div>
        )}

        {entries.map((entry) => {
          const isSelected = selectedFile?.node.name === entry.name;
          return (
            <div
              key={entry.name}
              onClick={() => handleClick(entry)}
              className={`flex items-center gap-2.5 px-3.5 py-2 cursor-pointer transition-colors ${
                isSelected ? 'bg-white/[0.07]' : 'hover:bg-white/[0.03]'
              }`}
            >
              {getFileIcon(entry)}
              <span
                className="text-xs flex-1 truncate font-mono"
                style={{ color: getFileColor(entry) }}
              >
                {entry.name}
                {entry.type === 'symlink' && entry.target && (
                  <span className="text-[10px] opacity-55 font-normal ml-1.5">
                    → {entry.target}
                  </span>
                )}
              </span>
              <span
                className="text-[11px] font-mono tabular-nums shrink-0"
                style={{ color: 'var(--theme-muted)' }}
              >
                {entry.type === 'dir' ? 'dir' : formatSize(entry.size)}
              </span>
            </div>
          );
        })}

        {entries.length === 0 && (
          <div className="px-4 py-10 text-xs text-center" style={{ color: 'var(--theme-muted)' }}>
            {filterQuery ? `No entries matching "${filterQuery}"` : 'Directory is empty'}
          </div>
        )}
      </div>

      {/* File Inspector & Preview Drawer */}
      {selectedFile && (
        <div
          className="border-t max-h-[46%] flex flex-col shrink-0 animate-fadeIn"
          style={{
            background: 'var(--theme-card-bg)',
            borderColor: 'var(--theme-border-strong)',
          }}
        >
          <div
            className="flex items-center justify-between px-3.5 py-2 border-b"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Eye size={13} style={{ color: 'var(--theme-accent)' }} className="shrink-0" />
              <span className="text-xs font-semibold font-mono truncate">
                {selectedFile.node.name}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onOpenNano && selectedFile.node.type === 'file' && (
                <button
                  onClick={() => onOpenNano(selectedFile.path)}
                  className="px-2 py-0.5 rounded text-[11px] font-medium hover:bg-white/10 transition-colors flex items-center gap-1"
                  style={{ color: 'var(--theme-user)' }}
                  title="Edit file in Nano"
                >
                  <Edit3 size={11} />
                  <span>Edit</span>
                </button>
              )}
              {selectedFile.node.type === 'file' && (
                <button
                  onClick={handleDownloadFile}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  style={{ color: 'var(--theme-text-secondary)' }}
                  title="Download file"
                >
                  <Download size={12} />
                </button>
              )}
              <button
                onClick={handleDeleteItem}
                className={`px-1.5 py-0.5 rounded text-[11px] transition-colors flex items-center gap-1 ${
                  confirmDelete
                    ? 'bg-rose-500/20 text-rose-300 font-semibold'
                    : 'hover:bg-white/10 text-rose-400/80 hover:text-rose-400'
                }`}
                title="Delete from VFS"
              >
                <Trash2 size={12} />
                {confirmDelete && <span>Confirm</span>}
              </button>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1 rounded opacity-60 hover:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Clean Unboxed Metadata Row with Middle Dots */}
          <div
            className="px-3.5 py-1.5 flex items-center gap-2 text-[11px] font-mono border-b overflow-x-auto whitespace-nowrap"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            <span>{formatPermissions(selectedFile.node)}</span>
            <span className="opacity-30">·</span>
            <span>
              {selectedFile.node.owner}:{selectedFile.node.group}
            </span>
            <span className="opacity-30">·</span>
            <span className="tabular-nums">{formatSize(selectedFile.node.size)}</span>
            <span className="opacity-30">·</span>
            <span className="opacity-75">{formatDate(selectedFile.node.updatedAt)}</span>
          </div>

          <div
            className="flex-1 overflow-y-auto p-3.5"
            style={{ background: 'var(--theme-bg)' }}
          >
            {selectedFile.node.type === 'symlink' ? (
              <div className="text-xs text-cyan-300 font-mono">
                Symbolic link → <strong className="text-white">{selectedFile.node.target}</strong>
              </div>
            ) : (
              <pre
                className="text-[11px] whitespace-pre-wrap font-mono leading-relaxed"
                style={{ color: 'var(--theme-text)' }}
              >
                {(selectedFile.node.content ?? '').split('\n').slice(0, 60).join('\n')}
                {(selectedFile.node.content ?? '').split('\n').length > 60 &&
                  '\n... [truncated]'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
