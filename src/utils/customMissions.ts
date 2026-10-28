import type { CustomMission, Mission } from '../types';
import type { VirtualFileSystem } from '../vfs/fileSystem';
import { isServiceRunning } from '../shell/commands/sysadmin';

const CUSTOM_MISSIONS_KEY = 'linuxsim_custom_missions';

export function getCustomMissions(): CustomMission[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_MISSIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load custom missions', e);
    return [];
  }
}

export function saveCustomMissions(missions: CustomMission[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_MISSIONS_KEY, JSON.stringify(missions));
  } catch (e) {
    console.error('Failed to save custom missions', e);
  }
}

export function convertCustomMissionToMission(cm: CustomMission, completed: boolean = false): Mission {
  return {
    id: cm.id,
    title: cm.title,
    description: cm.description,
    difficulty: cm.difficulty,
    hint: cm.hint,
    completed,
    validator: (vfs: VirtualFileSystem, history: string[]): boolean => {
      if (!cm.rules || cm.rules.length === 0) return true;
      for (const rule of cm.rules) {
        if (rule.type === 'file_exists') {
          const node = vfs.getNode(rule.target, true);
          if (!node) return false;
        } else if (rule.type === 'file_contains') {
          const node = vfs.getNode(rule.target, true);
          if (!node || !node.content) return false;
          if (rule.pattern && !node.content.includes(rule.pattern)) return false;
        } else if (rule.type === 'command_executed') {
          const targetCmd = rule.target.trim();
          const match = history.some((cmd) => cmd.trim().includes(targetCmd));
          if (!match) return false;
        } else if (rule.type === 'service_active') {
          const running = isServiceRunning(rule.target.trim());
          if (!running) return false;
        }
      }
      return true;
    },
  };
}
