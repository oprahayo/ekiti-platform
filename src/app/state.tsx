import type { Language } from '../server/ask-knowledge.ts';
import * as React from 'react';
import type { Category } from './fixtures.ts';

interface AppState {
  language: Language;
  setLanguage: (language: Language) => void;
  dark: boolean;
  toggleTheme: () => void;
  voiceOpen: boolean;
  openVoice: () => void;
  closeVoice: () => void;
  askDraft: string;
  setAskDraft: (value: string) => void;
  exploreCategory: Category;
  setExploreCategory: (value: Category) => void;
  exploreQuery: string;
  setExploreQuery: (value: string) => void;
  exploreLga: string;
  setExploreLga: (value: string) => void;
}

const Context = React.createContext<AppState | undefined>(undefined);

export function speechSupported() {
  if (typeof window === 'undefined') return false;
  const host = window as Window & {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(host.SpeechRecognition || host.webkitSpeechRecognition);
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = React.useState(() => {
    try { return localStorage.getItem('ekiti-ui-theme-v2') === 'dark'; }
    catch { return false; }
  });
  const [language, setLanguageState] = React.useState<Language>(() => {
    try { return localStorage.getItem('ekiti-ui-language') === 'yo' ? 'yo' : 'en'; }
    catch { return 'en'; }
  });
  const setLanguage = (value: Language) => {
    setLanguageState(value);
    try { localStorage.setItem('ekiti-ui-language', value); } catch { /* Works without storage */ }
  };
  const [voiceOpen, setVoiceOpen] = React.useState(false);
  const [askDraft, setAskDraft] = React.useState('');
  const [exploreCategory, setExploreCategory] = React.useState<Category>('All');
  const [exploreQuery, setExploreQuery] = React.useState('');
  const [exploreLga, setExploreLga] = React.useState('');

  React.useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('ekiti-ui-theme-v2', dark ? 'dark' : 'light'); }
    catch { /* Theme still works without writable storage. */ }
  }, [dark]);

  const value: AppState = {
    language, setLanguage,
    dark,
    toggleTheme: () => setDark((value) => !value),
    voiceOpen,
    openVoice: () => { if (speechSupported()) setVoiceOpen(true); },
    closeVoice: () => setVoiceOpen(false),
    askDraft,
    setAskDraft,
    exploreCategory, setExploreCategory,
    exploreQuery, setExploreQuery,
    exploreLga, setExploreLga,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp() {
  const context = React.useContext(Context);
  if (!context) throw new Error('AppProvider is required');
  return context;
}
