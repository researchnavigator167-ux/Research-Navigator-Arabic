import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Language } from './i18n';
import { t as translate } from './i18n';

interface AppContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem('rn-lang');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });

  const isRTL = lang === 'ar';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  }, [lang, isRTL]);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('rn-lang', newLang);
  };

  const t = (key: string) => translate(lang, key);

  return (
    <AppContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
