import React, { useState, useMemo, useEffect } from 'react';
import {
  Folder, FolderOpen, FileText, FileCode, File, ChevronRight, ArrowUp, Eye, X, Shield
} from 'lucide-react';
import type { VFSNode } from '../types';
import { VirtualFileSystem } from '../vfs/fileSystem';
import { formatPermissions } from '../vfs/permissions';

interface FileExplorerGUIProps {
  vfs: VirtualFileSystem;
  version: number;
  cwd: string;
  onNavigate: (path: string) => void;
}

function getFileIcon(node: VFSNode) {
  if (node.type === 'dir') return <Folder size={14} className="text-blue-400" />;
  const ext = node.name.split('.').pop()?.toLowerCase();
  if (['sh', 'bash'].includes(ext || '')) return <FileCode size={14} className="text-green-400" />;
  if (['json', 'js', 'ts', 'tsx'].includes(ext || '')) return <FileCode size={14} className="text-yellow-400" />;
  if (['md', 'txt', 'log'].includes(ext || '')) return <FileText size={14} className="text-slate-400" />;
  return <File size={14} className="text-slate-500" />;
}

function getFileColor(node: VFSNode): string {
  if (node.type === 'dir') return '#60a5fa';
  if (node.permissions.includes('x') && node.type === 'file') return '#4ade80';
  return '#e2e8f0';
}

function formatDate(d: Date): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatSize(size: number): string {
  if (size < 1024) return `${size}B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}K`;
  return `${(size / (1024 * 1024)).toFixed(1)}M`;
}

export const FileExplorerGUI: React.FC<FileExplorerGUIProps> = ({ vfs, version, cwd, onNavigate }) => {
  const [currentPath, setCurrentPath] = useState('/home/user');
  const [selectedFile, setSelectedFile] = useState<{ node: VFSNode; path: string } | null>(null);

  const entries = useMemo(() => {
    const node = vfs.getNode(currentPath);
    if (!node || node.type !== 'dir' || !node.children) return [];
    const children = Array.from(node.children.values());
    // Sort: directories first, then by name
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
    if (node.type === 'dir') {
      const newPath = currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`;
      navigateTo(newPath);
    } else {
      const path = currentPath === '/' ? `/${node.name}` : `${currentPath}/${node.name}`;
      setSelectedFile({ node, path });
    }
  };

  const goUp = () => {
    if (currentPath === '/') return;
    const parent = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    navigateTo(parent);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: '#12141f', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-9" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <FolderOpen size={14} className="text-blue-400" />
        <span className="text-xs font-semibold text-slate-300">File Explorer</span>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-0.5 px-3 py-1.5 flex-wrap" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
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
            <span className="text-xs text-blue-400">..</span>
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
            <span className="text-xs flex-1 truncate" style={{ color: getFileColor(entry) }}>
              {entry.name}
            </span>
            <span className="text-xs text-slate-600 tabular-nums">{formatSize(entry.size)}</span>
          </div>
        ))}

        {entries.length === 0 && (
          <div className="px-3 py-4 text-xs text-slate-600 text-center italic">Empty directory</div>
        )}
      </div>

      {/* File preview panel */}
      {selectedFile && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', maxHeight: '40%' }} className="flex flex-col">
          <div className="flex items-center justify-between px-3 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2">
              <Eye size={12} className="text-slate-500" />
              <span className="text-xs text-slate-300 font-semibold truncate">{selectedFile.node.name}</span>
            </div>
            <button onClick={() => setSelectedFile(null)} className="text-slate-600 hover:text-slate-400">
              <X size={12} />
            </button>
          </div>
          <div className="px-3 py-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Shield size={10} />{formatPermissions(selectedFile.node)}</span>
            <span>{selectedFile.node.owner}:{selectedFile.node.group}</span>
            <span>{formatSize(selectedFile.node.size)}</span>
            <span>{formatDate(selectedFile.node.updatedAt)}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-1">
            <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono" style={{ fontSize: '11px' }}>
              {(selectedFile.node.content ?? '').split('\n').slice(0, 50).join('\n')}
              {((selectedFile.node.content ?? '').split('\n').length > 50) && '\n...'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
