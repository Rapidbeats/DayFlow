export interface Theme {
  id: string;
  name: string;
  swatch: string;
  accent: string;
  accentSoft: string;
  accentStrong: string;
  rgb: string;
}

export const THEMES: Theme[] = [
  {
    id: 'emerald',
    name: 'Emerald',
    swatch: 'linear-gradient(135deg,#7cd9a6,#4fbf83)',
    accent: '#63c38e',
    accentSoft: '#8adbb0',
    accentStrong: '#44a973',
    rgb: '99,195,142',
  },
  {
    id: 'amber',
    name: 'Amber',
    swatch: 'linear-gradient(135deg,#f0c572,#d9a44f)',
    accent: '#d9aa5f',
    accentSoft: '#f2cb8a',
    accentStrong: '#c7903d',
    rgb: '217,170,95',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    swatch: 'linear-gradient(135deg,#f0a17f,#dc7d66)',
    accent: '#de896f',
    accentSoft: '#f2af94',
    accentStrong: '#c96b54',
    rgb: '222,137,111',
  },
  {
    id: 'rose',
    name: 'Rose',
    swatch: 'linear-gradient(135deg,#e59aa6,#cf7486)',
    accent: '#d98795',
    accentSoft: '#ebb2bb',
    accentStrong: '#c46679',
    rgb: '217,135,149',
  },
  {
    id: 'violet',
    name: 'Violet',
    swatch: 'linear-gradient(135deg,#a798e6,#8573d6)',
    accent: '#8f81d7',
    accentSoft: '#b2a6ec',
    accentStrong: '#7562c9',
    rgb: '143,129,215',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    swatch: 'linear-gradient(135deg,#7fc9d7,#57a9b8)',
    accent: '#69b6c6',
    accentSoft: '#95d5df',
    accentStrong: '#4a9aa9',
    rgb: '105,182,198',
  },
  {
    id: 'blossom',
    name: 'Blossom',
    swatch: 'linear-gradient(135deg,#e2a8cf,#cd7eb0)',
    accent: '#d28fbc',
    accentSoft: '#ebbbda',
    accentStrong: '#bd6fa0',
    rgb: '210,143,188',
  },
  {
    id: 'gold',
    name: 'Gold',
    swatch: 'linear-gradient(135deg,#e4c585,#caa45b)',
    accent: '#d4b16a',
    accentSoft: '#ebd099',
    accentStrong: '#bc964b',
    rgb: '212,177,106',
  },
];

const THEME_ALIASES: Record<string, string> = {
  green: 'emerald',
  orange: 'sunset',
  pink: 'blossom',
};

export function getTheme(id: string): Theme {
  const resolvedId = THEME_ALIASES[id] || id;
  return THEMES.find((theme) => theme.id === resolvedId) || THEMES[0];
}

export function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;

  root.style.setProperty('--bg', '#0B0F1A');
  root.style.setProperty('--surface', '#121826');
  root.style.setProperty('--elevated', '#1A2236');
  root.style.setProperty('--surface2', 'rgba(255,255,255,0.04)');
  root.style.setProperty('--surface3', 'rgba(255,255,255,0.06)');
  root.style.setProperty('--text', '#E5E7EB');
  root.style.setProperty('--muted2', '#9CA3AF');
  root.style.setProperty('--muted', '#6B7280');
  root.style.setProperty('--border', 'rgba(255,255,255,0.05)');
  root.style.setProperty('--border2', 'rgba(255,255,255,0.08)');
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-soft', theme.accentSoft);
  root.style.setProperty('--accent-strong', theme.accentStrong);
  root.style.setProperty('--accent-rgb', theme.rgb);
  root.style.setProperty('--accent-glow', `rgba(${theme.rgb}, 0.20)`);
  root.style.setProperty('--accent-hover', `rgba(${theme.rgb}, 0.10)`);

  document.body.style.background = '#0B0F1A';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', '#0B0F1A');
}
