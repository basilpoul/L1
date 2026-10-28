import React, { useState, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Download,
  Upload,
  FlaskConical,
  CheckCircle2,
} from 'lucide-react';
import type { CustomMission, CustomMissionRule } from '../types';
import { getCustomMissions, saveCustomMissions } from '../utils/customMissions';

interface LabBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMissionsUpdated: () => void;
}

export const LabBuilderModal: React.FC<LabBuilderModalProps> = ({
  isOpen,
  onClose,
  onMissionsUpdated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<CustomMission['difficulty']>('intermediate');
  const [hint, setHint] = useState('');
  const [rules, setRules] = useState<CustomMissionRule[]>([
    { type: 'file_exists', target: '/home/user/solution.txt' },
  ]);
  const [notification, setNotification] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const showNotif = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      { type: 'file_exists', target: '/home/user/result.txt' },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRule = (index: number, patch: Partial<CustomMissionRule>) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  const handleSaveMission = () => {
    if (!title.trim()) {
      showNotif('Please provide a mission title');
      return;
    }
    if (!description.trim()) {
      showNotif('Please provide a description');
      return;
    }
    if (rules.length === 0) {
      showNotif('Please configure at least one validation rule');
      return;
    }

    const newCustomMission: CustomMission = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      difficulty,
      hint: hint.trim() || 'No hint provided.',
      rules,
      completed: false,
      isCustom: true,
    };

    const currentList = getCustomMissions();
    currentList.push(newCustomMission);
    saveCustomMissions(currentList);

    showNotif('Custom Mission successfully created!');
    onMissionsUpdated();

    // Reset form
    setTitle('');
    setDescription('');
    setHint('');
    setRules([{ type: 'file_exists', target: '/home/user/solution.txt' }]);
  };

  const handleExportJSON = () => {
    const list = getCustomMissions();
    const blob = new Blob([JSON.stringify(list, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linuxsim_custom_labs.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotif('Exported custom missions to JSON');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          const current = getCustomMissions();
          const existingIds = new Set(current.map((c) => c.id));
          for (const item of parsed) {
            if (item.title && item.rules && !existingIds.has(item.id)) {
              current.push(item);
            }
          }
          saveCustomMissions(current);
          onMissionsUpdated();
          showNotif(`Imported ${parsed.length} custom mission(s)!`);
        }
      } catch {
        showNotif('Failed to import JSON: Invalid format');
      }
    };
    reader.readAsText(file);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-[#121422] border border-white/10 shadow-2xl overflow-hidden text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#16192b]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <FlaskConical size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-wide">
                Custom Mission & Lab Builder
              </h2>
              <p className="text-xs text-slate-400">Design no-code automated Linux practice challenges</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
              title="Export Custom Labs JSON"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => importFileRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
              title="Import Custom Labs JSON"
            >
              <Upload size={13} />
              <span className="hidden sm:inline">Import</span>
            </button>
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportJSON}
            />

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Notification banner */}
        {notification && (
          <div className="px-5 py-1.5 bg-purple-500/20 border-b border-purple-500/30 text-purple-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Title & Difficulty */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="font-semibold text-slate-300">Mission Title</label>
              <input
                type="text"
                placeholder="e.g., Secure Nginx Configuration"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-purple-500/50"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-300">Difficulty Tier</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as CustomMission['difficulty'])}
                className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white outline-none focus:border-purple-500/50 cursor-pointer"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
                <option value="master">Master</option>
                <option value="architect">Architect</option>
                <option value="cloud-native">Cloud-Native</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Objective / Instructions</label>
            <textarea
              rows={2}
              placeholder="Explain the lab goal, commands to run, or files to create..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-purple-500/50 resize-none"
            />
          </div>

          {/* Hint */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-300">Hint (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Use chmod 644 and check with ls -l"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 outline-none focus:border-purple-500/50"
            />
          </div>

          {/* Rule Builder */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-200">Validation Rules</span>
                <p className="text-[11px] text-slate-400">All rules must pass to complete the mission</p>
              </div>
              <button
                type="button"
                onClick={handleAddRule}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-medium transition-all"
              >
                <Plus size={13} />
                <span>Add Condition</span>
              </button>
            </div>

            <div className="space-y-2">
              {rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-black/30 border border-white/5 flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                >
                  <select
                    value={rule.type}
                    onChange={(e) =>
                      handleUpdateRule(idx, {
                        type: e.target.value as CustomMissionRule['type'],
                      })
                    }
                    className="px-2 py-1.5 rounded-lg bg-[#1a1d2e] border border-white/10 text-slate-200 outline-none shrink-0"
                  >
                    <option value="file_exists">File Exists</option>
                    <option value="file_contains">File Contains Text</option>
                    <option value="command_executed">Command In History</option>
                    <option value="service_active">Service Is Active</option>
                  </select>

                  <input
                    type="text"
                    value={rule.target}
                    onChange={(e) => handleUpdateRule(idx, { target: e.target.value })}
                    placeholder={
                      rule.type === 'service_active'
                        ? 'e.g., nginx or ssh'
                        : rule.type === 'command_executed'
                        ? 'e.g., kubectl scale or git commit'
                        : '/path/to/target/file'
                    }
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[#141624] border border-white/10 text-white font-mono placeholder-slate-600 outline-none w-full sm:w-auto"
                  />

                  {rule.type === 'file_contains' && (
                    <input
                      type="text"
                      value={rule.pattern || ''}
                      onChange={(e) => handleUpdateRule(idx, { pattern: e.target.value })}
                      placeholder="Expected string or regex"
                      className="flex-1 px-3 py-1.5 rounded-lg bg-[#141624] border border-white/10 text-white font-mono placeholder-slate-600 outline-none w-full sm:w-auto"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveRule(idx)}
                    disabled={rules.length === 1}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30 disabled:hover:text-slate-500 disabled:hover:bg-transparent"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-white/10 bg-[#16192b]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors font-medium text-xs"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveMission}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 transition-all hover:scale-105"
          >
            Save & Publish Mission
          </button>
        </div>
      </div>
    </div>
  );
};
