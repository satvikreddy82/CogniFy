import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

export type ThemeId =
  | 'theme-a'
  | 'theme-b'
  | 'theme-c'
  | 'theme-d'
  | 'theme-e'
  | 'theme-f'
  | 'theme-g'
  | 'theme-h'
  | 'theme-i';

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  primary: string;
  secondary: string;
  description: string;
}

export const THEMES: ThemeMeta[] = [
  { id: 'theme-a', label: 'Orange + Navy',        primary: '#FF6B00', secondary: '#102A43', description: 'Energetic, confident, professional' },
  { id: 'theme-b', label: 'Emerald + Gold',       primary: '#047857', secondary: '#D4AF37', description: 'Elegant, academic, premium' },
  { id: 'theme-c', label: 'Violet + Yellow',      primary: '#7357D8', secondary: '#FFD84D', description: 'Expressive, contemporary, creative' },
  { id: 'theme-d', label: 'Green + Blush',        primary: '#315C4C', secondary: '#F2A7B5', description: 'Soft, friendly, calm' },
  { id: 'theme-e', label: 'Plum + Mint',          primary: '#593C8F', secondary: '#A8D5BA', description: 'Refined, creative, balanced' },
  { id: 'theme-f', label: 'Navy + Cyan',          primary: '#00D4FF', secondary: '#0B1F3A', description: 'Technical, modern, AI-focused' },
  { id: 'theme-g', label: 'Charcoal + Blue',      primary: '#3B82F6', secondary: '#18181B', description: 'Sophisticated, focused, professional' },
  { id: 'theme-h', label: 'Black + Lime',         primary: '#B6FF00', secondary: '#111111', description: 'Bold, high contrast, energetic' },
  { id: 'theme-i', label: 'Red + Cream',          primary: '#D72638', secondary: '#FFF3E0', description: 'Distinctive, warm, editorial' },
];

interface ThemeContextValue {
  theme: ThemeId;
  appearance: AppearanceMode;
  isDark: boolean;
  setTheme: (t: ThemeId) => void;
  setAppearance: (a: AppearanceMode) => void;
  themes: ThemeMeta[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_THEME = 'cognify:theme';
const STORAGE_APPEARANCE = 'cognify:appearance';

function resolveIsDark(mode: AppearanceMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    return (localStorage.getItem(STORAGE_THEME) as ThemeId) || 'theme-a';
  });

  const [appearance, setAppearanceState] = useState<AppearanceMode>(() => {
    return (localStorage.getItem(STORAGE_APPEARANCE) as AppearanceMode) || 'system';
  });

  const [isDark, setIsDark] = useState(() => resolveIsDark(
    (localStorage.getItem(STORAGE_APPEARANCE) as AppearanceMode) || 'system'
  ));

  // Apply theme and appearance to <html>
  const applyToDOM = useCallback((t: ThemeId, a: AppearanceMode) => {
    const dark = resolveIsDark(a);
    const html = document.documentElement;
    html.setAttribute('data-theme', t);
    html.classList.toggle('dark', dark);
    html.classList.toggle('light', !dark);
    setIsDark(dark);
  }, []);

  useEffect(() => {
    applyToDOM(theme, appearance);
  }, [theme, appearance, applyToDOM]);

  // Listen to system preference changes
  useEffect(() => {
    if (appearance !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyToDOM(theme, 'system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [appearance, theme, applyToDOM]);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_THEME, t);
  }, []);

  const setAppearance = useCallback((a: AppearanceMode) => {
    setAppearanceState(a);
    localStorage.setItem(STORAGE_APPEARANCE, a);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, appearance, isDark, setTheme, setAppearance, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
