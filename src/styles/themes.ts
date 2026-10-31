import type React from 'react';
import type { TerminalTheme } from '../types';

export interface ThemeColors {
  id: TerminalTheme;
  name: string;
  tagline: string;
  bg: string;
  surface: string;
  elevated: string;
  cardBg: string;
  tabBarBg: string;
  activeTabBg: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  muted: string;
  accent: string;
  accentSoft: string;
  promptUser: string;
  promptDir: string;
  cursor: string;
  badge: string;
}

export const THEMES: Record<TerminalTheme, ThemeColors> = {
  slate: {
    id: 'slate',
    name: 'Linear Slate',
    tagline: 'Crisp carbon obsidian with electric cobalt accents',
    bg: '#090b10',
    surface: '#0e1118',
    elevated: '#141822',
    cardBg: '#121620',
    tabBarBg: '#0c0e15',
    activeTabBg: '#090b10',
    border: 'rgba(255, 255, 255, 0.07)',
    borderStrong: 'rgba(255, 255, 255, 0.13)',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    muted: '#64748b',
    accent: '#3b82f6',
    accentSoft: 'rgba(59, 130, 246, 0.14)',
    promptUser: '#34d399',
    promptDir: '#60a5fa',
    cursor: '#38bdf8',
    badge: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  },
  tokyo: {
    id: 'tokyo',
    name: 'Tokyo Night',
    tagline: 'Deep indigo dusk inspired by Shibuya neon',
    bg: '#13141f',
    surface: '#181a28',
    elevated: '#1f2335',
    cardBg: '#1a1d2e',
    tabBarBg: '#10111a',
    activeTabBg: '#13141f',
    border: 'rgba(122, 162, 247, 0.12)',
    borderStrong: 'rgba(122, 162, 247, 0.22)',
    text: '#c0caf5',
    textSecondary: '#9aa5ce',
    muted: '#565f89',
    accent: '#7aa2f7',
    accentSoft: 'rgba(122, 162, 247, 0.15)',
    promptUser: '#9ece6a',
    promptDir: '#7aa2f7',
    cursor: '#7dcfff',
    badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  },
  catppuccin: {
    id: 'catppuccin',
    name: 'Catppuccin Mocha',
    tagline: 'Warm pastel espresso with lavender highlights',
    bg: '#161622',
    surface: '#1b1b2a',
    elevated: '#232336',
    cardBg: '#1e1e2e',
    tabBarBg: '#11111b',
    activeTabBg: '#161622',
    border: 'rgba(203, 166, 247, 0.12)',
    borderStrong: 'rgba(203, 166, 247, 0.22)',
    text: '#cdd6f4',
    textSecondary: '#a6adc8',
    muted: '#6c7086',
    accent: '#cba6f7',
    accentSoft: 'rgba(203, 166, 247, 0.15)',
    promptUser: '#a6e3a1',
    promptDir: '#89b4fa',
    cursor: '#f5c2e7',
    badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula Pro',
    tagline: 'High-contrast gothic plum with cyber pink & cyan',
    bg: '#191a23',
    surface: '#20222e',
    elevated: '#282a36',
    cardBg: '#232531',
    tabBarBg: '#14151c',
    activeTabBg: '#191a23',
    border: 'rgba(255, 121, 198, 0.13)',
    borderStrong: 'rgba(255, 121, 198, 0.24)',
    text: '#f8f8f2',
    textSecondary: '#cbd5e1',
    muted: '#6272a4',
    accent: '#ff79c6',
    accentSoft: 'rgba(255, 121, 198, 0.15)',
    promptUser: '#50fa7b',
    promptDir: '#8be9fd',
    cursor: '#50fa7b',
    badge: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  },
  matrix: {
    id: 'matrix',
    name: 'Phosphor Matrix',
    tagline: 'Tactical monochrome CRT emerald telemetry',
    bg: '#040a06',
    surface: '#07120b',
    elevated: '#0b1c11',
    cardBg: '#09170e',
    tabBarBg: '#030704',
    activeTabBg: '#040a06',
    border: 'rgba(16, 185, 129, 0.18)',
    borderStrong: 'rgba(16, 185, 129, 0.32)',
    text: '#d1fae5',
    textSecondary: '#6ee7b7',
    muted: '#059669',
    accent: '#10b981',
    accentSoft: 'rgba(16, 185, 129, 0.15)',
    promptUser: '#34d399',
    promptDir: '#2dd4bf',
    cursor: '#10b981',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
};

export function getThemeCSSVariables(themeId: TerminalTheme): React.CSSProperties {
  const t = THEMES[themeId] || THEMES.slate;
  return {
    '--theme-bg': t.bg,
    '--theme-surface': t.surface,
    '--theme-elevated': t.elevated,
    '--theme-card-bg': t.cardBg,
    '--theme-tab-bg': t.tabBarBg,
    '--theme-active-tab': t.activeTabBg,
    '--theme-border': t.border,
    '--theme-border-strong': t.borderStrong,
    '--theme-text': t.text,
    '--theme-text-secondary': t.textSecondary,
    '--theme-muted': t.muted,
    '--theme-accent': t.accent,
    '--theme-accent-soft': t.accentSoft,
    '--theme-user': t.promptUser,
    '--theme-dir': t.promptDir,
    '--theme-cursor': t.cursor,
  } as React.CSSProperties;
}
