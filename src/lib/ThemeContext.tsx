import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('rn-theme');
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'system';
  });
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('rn-theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return getSystemDark();
  });

  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && getSystemDark());
      setIsDark(dark);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('rn-theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
