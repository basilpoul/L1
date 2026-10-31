import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Terminal, Copy, Check, BookOpen } from 'lucide-react';
import type { CommandInfo } from '../shell/commandRegistry';

interface CheatSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandInfo[];
}

export const CheatSheetModal: React.FC<CheatSheetModalProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(text);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const categorize = (name: string): string => {
    const k8sCompose = ['kubectl', 'docker-compose'];
    const storageKernel = ['lsblk', 'mount', 'umount', 'fdisk', 'journalctl', 'dmesg', 'sysctl'];
    const recorder = ['script', 'replay'];
    const runtimes = ['python3', 'python', 'node', 'sqlite3'];
    const dnsCrypto = [
      'ip',
      'dig',
      'nslookup',
      'traceroute',
      'base64',
      'sha256sum',
      'md5sum',
      'openssl',
      'ssh-keygen',
      'ssh-copy-id',
    ];
    const multiplexJobs = ['tmux', 'watch', 'jobs', 'fg', 'bg', 'sleep', 'nohup'];
    const vim = ['vim', 'vi'];
    const git = ['git'];
    const docker = ['docker'];
    const security = ['useradd', 'userdel', 'su', 'passwd', 'groups', 'usermod', 'ufw', 'ssh', 'scp'];
    const nav = ['pwd', 'ls', 'cd', 'tree', 'find'];
    const files = ['mkdir', 'touch', 'rm', 'cp', 'mv'];
    const text = ['cat', 'echo', 'grep', 'head', 'tail', 'wc', 'sort', 'uniq', 'nano'];
    const powerText = ['sed', 'awk', 'cut', 'tr', 'diff', 'jq'];
    const archives = ['ln', 'tar', 'zip', 'unzip'];
    const sysadmin = [
      'systemctl',
      'netstat',
      'ss',
      'curl',
      'wget',
      'apt',
      'apt-get',
      'crontab',
      'cowsay',
      'figlet',
    ];
    const perm = ['chmod', 'chown', 'sudo', 'whoami', 'id'];
    const sys = [
      'neofetch',
      'uname',
      'hostname',
      'date',
      'uptime',
      'cal',
      'df',
      'du',
      'free',
      'ps',
      'top',
      'htop',
      'kill',
      'ping',
    ];
    const script = ['bash', 'sh'];

    if (k8sCompose.includes(name)) return 'Kubernetes & Compose';
    if (storageKernel.includes(name)) return 'Storage & Kernel';
    if (recorder.includes(name)) return 'Session Recording';
    if (runtimes.includes(name)) return 'Runtimes & SQL';
    if (dnsCrypto.includes(name)) return 'DNS & Cryptography';
    if (multiplexJobs.includes(name)) return 'Multiplexing & Jobs';
    if (vim.includes(name)) return 'Vim Editor';
    if (git.includes(name)) return 'Git & Version Control';
    if (docker.includes(name)) return 'Docker Containers';
    if (security.includes(name)) return 'Security & Users';
    if (powerText.includes(name)) return 'Power Text';
    if (archives.includes(name)) return 'Archives & Links';
    if (sysadmin.includes(name)) return 'SysAdmin & Network';
    if (script.includes(name)) return 'Scripting';
    if (nav.includes(name)) return 'Navigation';
    if (files.includes(name)) return 'File Ops';
    if (text.includes(name)) return 'Text & Pipes';
    if (perm.includes(name)) return 'Permissions';
    if (sys.includes(name)) return 'System';
    return 'Utilities';
  };

  const categories = [
    'all',
    'Kubernetes & Compose',
    'Storage & Kernel',
    'Session Recording',
    'Multiplexing & Jobs',
    'Runtimes & SQL',
    'DNS & Cryptography',
    'Vim Editor',
    'Git & Version Control',
    'Docker Containers',
    'Security & Users',
    'Navigation',
    'File Ops',
    'Text & Pipes',
    'Power Text',
    'Archives & Links',
    'SysAdmin & Network',
    'Permissions',
    'System',
    'Scripting',
    'Utilities',
  ];

  const filteredCommands = useMemo(() => {
    const q = search.toLowerCase().trim();
    return commands.filter((cmd) => {
      const cat = categorize(cmd.name);
      if (selectedCategory !== 'all' && cat !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        cmd.name.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.usage.toLowerCase().includes(q) ||
        cmd.flags.some(
          (f) =>
            f.flag.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
        )
      );
    });
  }, [commands, search, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/75 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div
        className="flex flex-col w-full max-w-4xl h-[90dvh] sm:h-[85vh] rounded-t-2xl sm:rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border-strong)',
          color: 'var(--theme-text)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b shrink-0"
          style={{
            background: 'var(--theme-tab-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center gap-3">
            <BookOpen size={18} style={{ color: 'var(--theme-accent)' }} />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Linux Command Documentation</h2>
              <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                Interactive manual pages, supported flags, and syntax reference
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            style={{ color: 'var(--theme-text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Segmented Category Filter */}
        <div
          className="px-6 py-3.5 border-b flex flex-col gap-3 shrink-0"
          style={{
            background: 'var(--theme-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--theme-muted)' }}
            />
            <input
              type="text"
              placeholder="Search commands, flags, or descriptions (e.g. kubectl, grep, -la, permissions)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border text-xs outline-none transition-colors"
              style={{
                background: 'var(--theme-surface)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
              autoFocus
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive ? 'bg-white/[0.09] text-white' : 'hover:text-white'
                  }`}
                  style={!isActive ? { color: 'var(--theme-text-secondary)' } : undefined}
                >
                  {cat === 'all' ? 'All Commands' : cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Command Reference Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCommands.map((cmd) => {
            const category = categorize(cmd.name);
            return (
              <div
                key={cmd.name}
                className="flex flex-col p-4 rounded-xl border transition-colors"
                style={{
                  background: 'var(--theme-card-bg)',
                  borderColor: 'var(--theme-border)',
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="font-mono text-sm font-bold"
                      style={{ color: 'var(--theme-dir)' }}
                    >
                      {cmd.name}
                    </span>
                    <span className="opacity-30">·</span>
                    <span
                      className="text-[11px]"
                      style={{ color: 'var(--theme-text-secondary)' }}
                    >
                      {category}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(cmd.usage)}
                    className="p-1 rounded hover:bg-white/[0.06] transition-colors"
                    style={{ color: 'var(--theme-text-secondary)' }}
                    title="Copy usage syntax"
                  >
                    {copiedCmd === cmd.usage ? (
                      <Check size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>

                <p
                  className="text-xs mb-3 leading-relaxed"
                  style={{ color: 'var(--theme-text-secondary)' }}
                >
                  {cmd.description}
                </p>

                <div
                  className="p-2.5 rounded-lg border mb-3 font-mono text-[11px]"
                  style={{
                    background: 'var(--theme-bg)',
                    borderColor: 'var(--theme-border)',
                    color: 'var(--theme-user)',
                  }}
                >
                  <span className="opacity-40">$ </span>
                  {cmd.usage}
                </div>

                {cmd.flags && cmd.flags.length > 0 && (
                  <div
                    className="mt-auto pt-2.5 border-t space-y-1"
                    style={{ borderColor: 'var(--theme-border)' }}
                  >
                    {cmd.flags.map((flag) => (
                      <div key={flag.flag} className="flex items-baseline gap-2.5 text-[11px]">
                        <span
                          className="font-mono font-semibold shrink-0"
                          style={{ color: 'var(--theme-dir)' }}
                        >
                          {flag.flag}
                        </span>
                        <span
                          className="leading-snug"
                          style={{ color: 'var(--theme-text-secondary)' }}
                        >
                          {flag.description}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {filteredCommands.length === 0 && (
            <div className="col-span-full py-16 text-center">
              <Terminal size={28} className="mx-auto opacity-30 mb-2" />
              <p className="text-sm font-medium">No commands match &ldquo;{search}&rdquo;</p>
              <p
                className="text-xs mt-1"
                style={{ color: 'var(--theme-text-secondary)' }}
              >
                Try searching by command name, flag, or category
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t flex items-center justify-between text-xs font-mono tabular-nums shrink-0"
          style={{
            background: 'var(--theme-tab-bg)',
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-muted)',
          }}
        >
          <span>
            Showing <strong style={{ color: 'var(--theme-text)' }}>{filteredCommands.length}</strong>{' '}
            of <strong style={{ color: 'var(--theme-text)' }}>{commands.length}</strong> commands
          </span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  );
};
