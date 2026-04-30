'use client';

import { SessionProvider } from 'next-auth/react';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import t, { type AdminLang, type TKeys } from '@/lib/adminI18n';

export type TDict = Record<TKeys, string>;

interface LangCtx {
  lang: AdminLang;
  setLang: (l: AdminLang) => void;
  T: TDict;
}

const LangContext = createContext<LangCtx>({
  lang: 'ru',
  setLang: () => {},
  T: t.ru as TDict,
});

export function useAdminT(): LangCtx {
  return useContext(LangContext);
}

export default function AdminProviders({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<AdminLang>('ru');

  useEffect(() => {
    const stored = localStorage.getItem('adminLang') as AdminLang | null;
    if (stored === 'en' || stored === 'ru') setLangState(stored);
  }, []);

  function setLang(l: AdminLang) {
    setLangState(l);
    localStorage.setItem('adminLang', l);
  }

  return (
    <SessionProvider>
      <LangContext.Provider value={{ lang, setLang, T: t[lang] as TDict }}>
        {children}
      </LangContext.Provider>
    </SessionProvider>
  );
}
