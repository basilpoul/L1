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

    showNotif('Custom lab mission published to curriculum.');
    onMissionsUpdated();

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
          showNotif(`Imported ${parsed.length} custom mission(s)`);
        }
      } catch {
        showNotif('Failed to import JSON: Invalid format');
      }
    };
    reader.readAsText(file);
    if (importFileRef.current) importFileRef.current.value = '';
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fadeIn select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--theme-surface)',
          borderColor: 'var(--theme-border-strong)',
          color: 'var(--theme-text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 border-b"
          style={{
            background: 'var(--theme-tab-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <FlaskConical size={17} style={{ color: 'var(--theme-accent)' }} />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Custom Lab Builder</h2>
              <p className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>
                Author automated Linux verification scenarios and state assertions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border hover:bg-white/[0.06] transition-colors"
              style={{
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-secondary)',
              }}
              title="Export Custom Labs JSON"
            >
              <Download size={12} />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={() => importFileRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border hover:bg-white/[0.06] transition-colors"
              style={{
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text-secondary)',
              }}
              title="Import Custom Labs JSON"
            >
              <Upload size={12} />
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
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              style={{ color: 'var(--theme-text-secondary)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {notification && (
          <div className="px-5 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>{notification}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="font-semibold block">Mission Title</label>
              <input
                type="text"
                placeholder="e.g., Harden SSH Daemon Configuration"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border outline-none"
                style={{
                  background: 'var(--theme-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold block">Difficulty Tier</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as CustomMission['difficulty'])}
                className="w-full px-3 py-2 rounded-lg border outline-none cursor-pointer"
                style={{
                  background: 'var(--theme-bg)',
                  borderColor: 'var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
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

          <div className="space-y-1.5">
            <label className="font-semibold block">Objective &amp; Instructions</label>
            <textarea
              rows={2}
              placeholder="Describe the target outcome, files to modify, or services to configure..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border outline-none resize-none"
              style={{
                background: 'var(--theme-bg)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold block">Hint (Optional)</label>
            <input
              type="text"
              placeholder="e.g., Check permissions with ls -l and restart ssh"
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border outline-none"
              style={{
                background: 'var(--theme-bg)',
                borderColor: 'var(--theme-border)',
                color: 'var(--theme-text)',
              }}
            />
          </div>

          {/* Validation Rules */}
          <div
            className="space-y-2.5 pt-3 border-t"
            style={{ borderColor: 'var(--theme-border)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold">Validation Assertions</span>
                <p className="text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>
                  All conditions must pass for the mission to complete
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddRule}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md border font-medium transition-colors hover:bg-white/[0.06]"
                style={{
                  borderColor: 'var(--theme-border-strong)',
                  color: 'var(--theme-text)',
                }}
              >
                <Plus size={12} style={{ color: 'var(--theme-accent)' }} />
                <span>Add Assertion</span>
              </button>
            </div>

            <div className="space-y-2">
              {rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-lg border flex flex-col sm:flex-row gap-2 items-start sm:items-center"
                  style={{
                    background: 'var(--theme-card-bg)',
                    borderColor: 'var(--theme-border)',
                  }}
                >
                  <select
                    value={rule.type}
                    onChange={(e) =>
                      handleUpdateRule(idx, {
                        type: e.target.value as CustomMissionRule['type'],
                      })
                    }
                    className="px-2.5 py-1.5 rounded-md border outline-none shrink-0"
                    style={{
                      background: 'var(--theme-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
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
                        ? 'e.g., kubectl scale'
                        : '/path/to/target/file'
                    }
                    className="flex-1 px-3 py-1.5 rounded-md border font-mono outline-none w-full sm:w-auto"
                    style={{
                      background: 'var(--theme-bg)',
                      borderColor: 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />

                  {rule.type === 'file_contains' && (
                    <input
                      type="text"
                      value={rule.pattern || ''}
                      onChange={(e) => handleUpdateRule(idx, { pattern: e.target.value })}
                      placeholder="Expected string or regex"
                      className="flex-1 px-3 py-1.5 rounded-md border font-mono outline-none w-full sm:w-auto"
                      style={{
                        background: 'var(--theme-bg)',
                        borderColor: 'var(--theme-border)',
                        color: 'var(--theme-text)',
                      }}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveRule(idx)}
                    disabled={rules.length === 1}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-30"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2.5 px-5 py-3 border-t"
          style={{
            background: 'var(--theme-tab-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border font-medium text-xs hover:bg-white/[0.06] transition-colors"
            style={{
              borderColor: 'var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSaveMission}
            className="px-4 py-1.5 rounded-lg font-semibold text-xs text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--theme-accent)' }}
          >
            Save &amp; Publish Mission
          </button>
        </div>
      </div>
    </div>
  );
};
