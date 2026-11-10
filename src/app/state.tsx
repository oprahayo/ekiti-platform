import { readSavedPlaces, writeSavedPlaces, PLACE_ID } from './citizen-local.ts';
import type { Language } from '../server/ask-knowledge.ts';
import * as React from 'react';
import type { Category } from './fixtures.ts';
import type { DirectoryIconName } from './DirectoryCategories.tsx';

interface AppState {
  savedPlaceIds: string[];
  toggleSavedPlace: (id: string) => void;
  clearSavedPlaces: () => void;
  language: Language;
  setLanguage: (language: Language) => void;
  dark: boolean;
  toggleTheme: () => void;
  voiceOpen: boolean;
  openVoice: () => void;
  closeVoice: () => void;
  reportSpeech: string;
  setReportSpeech: (value: string) => void;
  trackSpeech: string;
  setTrackSpeech: (value: string) => void;
  pendingReportText: string;
  setPendingReportText: (value: string) => void;
  askDraft: string;
  setAskDraft: (value: string) => void;
  exploreService: DirectoryIconName | null;
  setExploreService: (value: DirectoryIconName | null) => void;
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
  const [savedPlaceIds, setSavedPlaceIds] = React.useState<string[]>(readSavedPlaces);
  const toggleSavedPlace = (id: string) => {
    if (!PLACE_ID.test(id)) return;
    setSavedPlaceIds(ids => {
      const updated = ids.includes(id) ? ids.filter(item => item !== id) : [...ids,id].slice(0,60);
      if (!writeSavedPlaces(updated)) return ids;
      return updated;
    });
  };
  const clearSavedPlaces = () => {
    if (writeSavedPlaces([])) setSavedPlaceIds([]);
  };
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
  const [reportSpeech, setReportSpeech] = React.useState('');
  const [trackSpeech, setTrackSpeech] = React.useState('');
  const [pendingReportText, setPendingReportText] = React.useState('');
  const [askDraft, setAskDraft] = React.useState('');
  const [exploreCategory, setExploreCategory] = React.useState<Category>('All');
  const [exploreService, setExploreService] = React.useState<DirectoryIconName | null>(null);
  const [exploreQuery, setExploreQuery] = React.useState('');
  const [exploreLga, setExploreLga] = React.useState('');

  React.useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('ekiti-ui-theme-v2', dark ? 'dark' : 'light'); }
    catch { /* Theme still works without writable storage. */ }
  }, [dark]);

  const value: AppState = {
    savedPlaceIds, toggleSavedPlace, clearSavedPlaces,
    language, setLanguage,
    dark,
    toggleTheme: () => setDark((value) => !value),
    voiceOpen,
    openVoice: () => { if (speechSupported()) setVoiceOpen(true); },
    closeVoice: () => setVoiceOpen(false),
    reportSpeech, setReportSpeech,
    trackSpeech, setTrackSpeech,
    pendingReportText, setPendingReportText,
    askDraft,
    setAskDraft,
    exploreService, setExploreService,
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
