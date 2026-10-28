import type { TerminalTheme } from '../types';

export interface ThemeColors {
  id: TerminalTheme;
  name: string;
  bg: string;
  cardBg: string;
  tabBarBg: string;
  activeTabBg: string;
  border: string;
  text: string;
  accent: string;
  promptUser: string;
  promptDir: string;
  cursor: string;
  badge: string;
}

export const THEMES: Record<TerminalTheme, ThemeColors> = {
  slate: {
    id: 'slate',
    name: 'Default Slate',
    bg: '#0f111a',
    cardBg: '#141625',
    tabBarBg: '#141625',
    activeTabBg: '#0f111a',
    border: 'rgba(255, 255, 255, 0.07)',
    text: '#e2e8f0',
    accent: '#60a5fa',
    promptUser: '#4ade80',
    promptDir: '#60a5fa',
    cursor: '#4ade80',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  tokyo: {
    id: 'tokyo',
    name: 'Tokyo Night',
    bg: '#1a1b26',
    cardBg: '#1f2335',
    tabBarBg: '#16161e',
    activeTabBg: '#1a1b26',
    border: 'rgba(122, 162, 247, 0.15)',
    text: '#c0caf5',
    accent: '#7aa2f7',
    promptUser: '#9ece6a',
    promptDir: '#7aa2f7',
    cursor: '#7aa2f7',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  catppuccin: {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    bg: '#1e1e2e',
    cardBg: '#181825',
    tabBarBg: '#11111b',
    activeTabBg: '#1e1e2e',
    border: 'rgba(203, 166, 247, 0.15)',
    text: '#cdd6f4',
    accent: '#cba6f7',
    promptUser: '#a6e3a1',
    promptDir: '#89b4fa',
    cursor: '#f5c2e7',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    bg: '#282a36',
    cardBg: '#21222c',
    tabBarBg: '#191a21',
    activeTabBg: '#282a36',
    border: 'rgba(255, 121, 198, 0.15)',
    text: '#f8f8f2',
    accent: '#ff79c6',
    promptUser: '#50fa7b',
    promptDir: '#8be9fd',
    cursor: '#50fa7b',
    badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  },
  matrix: {
    id: 'matrix',
    name: 'Matrix Hacker',
    bg: '#040d06',
    cardBg: '#08170c',
    tabBarBg: '#030b05',
    activeTabBg: '#040d06',
    border: 'rgba(0, 255, 65, 0.25)',
    text: '#00ff41',
    accent: '#00ff41',
    promptUser: '#39ff14',
    promptDir: '#00ffff',
    cursor: '#00ff41',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
};
