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
  Shield,
  FilePlus,
  FolderPlus,
  Upload,
  Download,
  Trash2,
  Edit3,
  Link as LinkIcon,
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
}

function getFileIcon(node: VFSNode) {
  if (node.type === 'dir') return <Folder size={14} className="text-blue-400" />;
  if (node.type === 'symlink') return <LinkIcon size={14} className="text-cyan-400" />;
  const ext = node.name.split('.').pop()?.toLowerCase();
  if (['sh', 'bash'].includes(ext || '')) return <FileCode size={14} className="text-green-400" />;
  if (['json', 'js', 'ts', 'tsx'].includes(ext || '')) return <FileCode size={14} className="text-yellow-400" />;
  if (['md', 'txt', 'log'].includes(ext || '')) return <FileText size={14} className="text-slate-400" />;
  return <File size={14} className="text-slate-500" />;
}

function getFileColor(node: VFSNode): string {
  if (node.type === 'dir') return '#60a5fa';
  if (node.type === 'symlink') return '#22d3ee';
  if (node.permissions.includes('x') && node.type === 'file') return '#4ade80';
  return '#e2e8f0';
}

function formatDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatSize(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}K`;
  return `${(size / (1024 * 1024)).toFixed(1)}M`;
}

export const FileExplorerGUI: React.FC<FileExplorerGUIProps> = ({
  vfs,
  version,
  cwd,
  onNavigate,
  onOpenNano,
  onRefresh,
}) => {
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [selectedFile, setSelectedFile] = useState<{ node: VFSNode; path: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => {
    const node = vfs.getNode(currentPath, false);
    if (!node || node.type !== 'dir' || !node.children) return [];
    const children = Array.from(node.children.values());
    // Sort: directories first, then symlinks, then files
    return children.sort((a, b) => {
      if (a.type === 'dir' && b.type !== 'dir') return -1;
      if (a.type !== 'dir' && b.type === 'dir') return 1;
      return a.name.localeCompare(b.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, vfs, version]);

  const breadcrumbs = useMemo(() => {
    if (currentPath === '/') return [{ name: '/', path: '/' }];
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
    onNavigate(path);
  };

  const handleClick = (node: VFSNode) => {
    const itemPath = currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`;
    if (node.type === 'dir') {
      navigateTo(itemPath);
    } else if (node.type === 'symlink') {
      // If it points to a directory, allow navigation, otherwise inspect
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

  // Quick Actions:
  const handleNewFile = () => {
    const name = window.prompt('Enter new file name:');
    if (!name || !name.trim()) return;
    const target = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`;
    vfs.createFile(target, '');
    onRefresh?.();
  };

  const handleNewFolder = () => {
    const name = window.prompt('Enter new folder name:');
    if (!name || !name.trim()) return;
    const target = currentPath === '/' ? `/${name.trim()}` : `${currentPath}/${name.trim()}`;
    vfs.createDirectory(target);
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
    const confirmed = window.confirm(`Delete "${selectedFile.node.name}" from VFS?`);
    if (!confirmed) return;
    vfs.deleteNode(selectedFile.path, true);
    setSelectedFile(null);
    onRefresh?.();
  };

  return (
    <div className="flex flex-col h-full bg-[#12141f] border-l border-white/5">
      {/* Header & Quick Toolbar */}
      <div className="flex items-center justify-between px-3 h-10 border-b border-white/5 bg-[#141624]">
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-blue-400" />
          <span className="text-xs font-semibold text-slate-300">File Explorer</span>
        </div>

        {/* Toolbar Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleNewFile}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="New File"
          >
            <FilePlus size={13} />
          </button>
          <button
            onClick={handleNewFolder}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="New Folder"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Upload Text File from PC"
          >
            <Upload size={13} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleUploadFile}
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap border-b border-white/[0.04]">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={crumb.path}>
            {i > 0 && <ChevronRight size={10} className="text-slate-600 mx-0.5" />}
            <button
              onClick={() => navigateTo(crumb.path)}
              className="text-xs text-slate-400 hover:text-blue-400 transition-colors"
            >
              {crumb.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {/* Go up */}
        {currentPath !== '/' && (
          <div
            onClick={goUp}
            className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/[0.03] transition-colors"
          >
            <ArrowUp size={13} className="text-blue-400" />
            <span className="text-xs text-blue-400 font-mono">..</span>
          </div>
        )}

        {entries.map(entry => (
          <div
            key={entry.name}
            onClick={() => handleClick(entry)}
            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/[0.03] transition-colors ${
              selectedFile?.node.name === entry.name ? 'bg-white/[0.05]' : ''
            }`}
          >
            {getFileIcon(entry)}
            <span className="text-xs flex-1 truncate font-mono" style={{ color: getFileColor(entry) }}>
              {entry.name}
              {entry.type === 'symlink' && entry.target && (
                <span className="text-[10px] text-slate-500 font-normal ml-1">→ {entry.target}</span>
              )}
            </span>
            <span className="text-[11px] text-slate-600 tabular-nums">{formatSize(entry.size)}</span>
          </div>
        ))}

        {entries.length === 0 && (
          <div className="px-3 py-8 text-xs text-slate-600 text-center italic">Empty directory</div>
        )}
      </div>

      {/* File preview panel & drawer */}
      {selectedFile && (
        <div className="border-t border-white/10 max-h-[45%] flex flex-col bg-[#141626]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 overflow-hidden">
              <Eye size={13} className="text-blue-400 shrink-0" />
              <span className="text-xs text-slate-200 font-semibold font-mono truncate">{selectedFile.node.name}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {onOpenNano && selectedFile.node.type === 'file' && (
                <button
                  onClick={() => onOpenNano(selectedFile.path)}
                  className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                  title="Edit in Nano"
                >
                  <Edit3 size={13} />
                </button>
              )}
              {selectedFile.node.type === 'file' && (
                <button
                  onClick={handleDownloadFile}
                  className="p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-white/5 transition-colors"
                  title="Download to PC"
                >
                  <Download size={13} />
                </button>
              )}
              <button
                onClick={handleDeleteItem}
                className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                title="Delete from VFS"
              >
                <Trash2 size={13} />
              </button>
              <button onClick={() => setSelectedFile(null)} className="p-1 rounded text-slate-500 hover:text-slate-300">
                <X size={13} />
              </button>
            </div>
          </div>

          <div className="px-3 py-1.5 flex items-center justify-between text-[11px] text-slate-400 border-b border-white/[0.04]">
            <span className="flex items-center gap-1 font-mono">
              <Shield size={10} className="text-slate-500" />
              {formatPermissions(selectedFile.node)}
            </span>
            <span>{selectedFile.node.owner}:{selectedFile.node.group}</span>
            <span className="tabular-nums">{formatSize(selectedFile.node.size)}</span>
            <span className="text-slate-500">{formatDate(selectedFile.node.updatedAt)}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 bg-black/30">
            {selectedFile.node.type === 'symlink' ? (
              <div className="text-xs text-cyan-300 font-mono">
                Symbolic link pointing to: <strong className="text-white">{selectedFile.node.target}</strong>
              </div>
            ) : (
              <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed" style={{ fontSize: '11px' }}>
                {(selectedFile.node.content ?? '').split('\n').slice(0, 50).join('\n')}
                {((selectedFile.node.content ?? '').split('\n').length > 50) && '\n... [truncated]'}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
