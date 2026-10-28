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

  // Close on Escape
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
    const dnsCrypto = ['ip', 'dig', 'nslookup', 'traceroute', 'base64', 'sha256sum', 'md5sum', 'openssl', 'ssh-keygen', 'ssh-copy-id'];
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
    const sysadmin = ['systemctl', 'netstat', 'ss', 'curl', 'wget', 'apt', 'apt-get', 'crontab', 'cowsay', 'figlet'];
    const perm = ['chmod', 'chown', 'sudo', 'whoami', 'id'];
    const sys = ['neofetch', 'uname', 'hostname', 'date', 'uptime', 'cal', 'df', 'du', 'free', 'ps', 'top', 'htop', 'kill', 'ping'];
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
          (f) => f.flag.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
        )
      );
    });
  }, [commands, search, selectedCategory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div
        className="flex flex-col w-full max-w-4xl h-[85vh] bg-[#121422] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#16182a]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <BookOpen size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">Linux Command Reference</h2>
              <p className="text-xs text-slate-400">Searchable guide for supported commands and syntax</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div className="px-6 py-3.5 border-b border-white/5 bg-[#141626]/80 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search commands, flags, descriptions (e.g. grep, -la, permissions)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500/50 transition-colors"
              autoFocus
            />
          </div>

          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-blue-600/30 text-blue-400 border border-blue-500/30'
                    : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                {cat === 'all' ? 'All Commands' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Command List Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCommands.map((cmd) => {
            const category = categorize(cmd.name);
            return (
              <div
                key={cmd.name}
                className="flex flex-col p-4 rounded-xl bg-[#16182c]/70 border border-white/5 hover:border-blue-500/30 transition-all hover:bg-[#181a32]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-cyan-400">{cmd.name}</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                      {category}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(cmd.usage)}
                    className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"
                    title="Copy usage syntax"
                  >
                    {copiedCmd === cmd.usage ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                </div>

                <p className="text-xs text-slate-300 mb-3">{cmd.description}</p>

                {/* Syntax */}
                <div className="p-2 rounded-lg bg-black/40 border border-white/5 mb-3 font-mono text-[11px] text-emerald-400">
                  <span className="text-slate-500">$ </span>
                  {cmd.usage}
                </div>

                {/* Flags Table */}
                {cmd.flags && cmd.flags.length > 0 && (
                  <div className="mt-auto pt-2 border-t border-white/5">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 block mb-1.5">
                      Supported Flags
                    </span>
                    <div className="space-y-1">
                      {cmd.flags.map((flag) => (
                        <div key={flag.flag} className="flex items-baseline gap-2 text-[11px]">
                          <span className="font-mono font-semibold text-blue-400 shrink-0">
                            {flag.flag}
                          </span>
                          <span className="text-slate-400 leading-tight">{flag.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredCommands.length === 0 && (
            <div className="col-span-full py-16 text-center">
              <Terminal size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">No commands match "{search}"</p>
              <p className="text-xs text-slate-600 mt-1">Try searching by category or flag name</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/5 bg-[#141626] flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing <strong className="text-slate-300">{filteredCommands.length}</strong> of{' '}
            <strong className="text-slate-300">{commands.length}</strong> commands
          </span>
          <span className="font-mono text-[11px]">Tip: Press [Esc] to exit</span>
        </div>
      </div>
    </div>
  );
};
