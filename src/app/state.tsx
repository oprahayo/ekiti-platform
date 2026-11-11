import { readSavedPlaces, writeSavedPlaces, PLACE_ID } from './citizen-local.ts';
import type { Language } from '../server/ask-knowledge.ts';
import * as React from 'react';
import { lgas, type Category } from './fixtures.ts';
import type { DirectoryIconName } from './DirectoryCategories.tsx';
import {acquireDevicePosition,resolveVerifiedPoint,PositionError} from './verified-location.ts';

export type EkitiLocationStatus =
  | 'prompt' | 'loading' | 'matched' | 'outside' | 'unavailable' | 'denied' | 'unmapped' | 'dismissed';

export interface EkitiLocation {
  status: EkitiLocationStatus;
  lgaName?: string;
  wardName?: string | undefined;
  message: string;
}

interface AppState {
  savedPlaceIds: string[];
  toggleSavedPlace: (id: string) => void;
  clearSavedPlaces: () => void;
  language: Language;
  setLanguage: (language: Language) => void;
  dark: boolean;
  toggleTheme: () => void;
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
  deviceLocation: EkitiLocation;
  requestDeviceLocation: () => Promise<void>;
  dismissDeviceLocation: () => void;
  selectManualArea: (id: string) => void;
}

const Context = React.createContext<AppState | undefined>(undefined);

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
  const [pendingReportText, setPendingReportText] = React.useState('');
  const [askDraft, setAskDraft] = React.useState('');
  const [exploreCategory, setExploreCategory] = React.useState<Category>('All');
  const [exploreService, setExploreService] = React.useState<DirectoryIconName | null>(null);
  const [exploreQuery, setExploreQuery] = React.useState('');
  const [exploreLga, setExploreLga] = React.useState('');
  const [deviceLocation, setDeviceLocation] = React.useState<EkitiLocation>(() => {
    try {
      return sessionStorage.getItem('ekiti-device-location-declined') === 'yes'
        ? { status: 'dismissed', message: 'You can browse Ekiti without sharing your location.' }
        : { status: 'prompt', message: 'Choose whether to use your current location.' };
    } catch {
      return { status: 'prompt', message: 'Choose whether to use your current location.' };
    }
  });
  const requestActive = React.useRef(false);

  const dismissDeviceLocation = () => {
    if (requestActive.current) return;
    setDeviceLocation({status: 'dismissed', message: 'Location sharing skipped. Explore Ekiti using categories or search.'});
    try { sessionStorage.setItem('ekiti-device-location-declined', 'yes'); } catch { /* Optional. */ }
  };
  const selectManualArea = (id: string) => {
    if (id && !lgas.some(area => area.id === id)) return;
    setExploreLga(id);
    // A manually selected area is a browse filter, never a claim of current GPS.
    setDeviceLocation({
      status: 'dismissed',
      message: id ? 'Browsing ' + lgas.find(area => area.id === id)?.name + ' by choice, not device location.' :
        'Browsing all of Ekiti without a location filter.',
    });
  };
  const requestDeviceLocation = async () => {
    if (requestActive.current) return;
    requestActive.current = true;
    setDeviceLocation({status: 'loading', message: 'Requesting permission to use your current location…'});
    try {
      if (!navigator.geolocation || !window.isSecureContext) {
        setDeviceLocation({ status:'unavailable', message:'Device location needs a secure connection and browser location access. Browse manually instead.' });
        return;
      }
      // Shared opt-in helper: never read GPS outside a direct click.
      // Explore position is ONLY a directory filter, not incident evidence.
      const point=await acquireDevicePosition(navigator.geolocation,window.isSecureContext);
      const result=await resolveVerifiedPoint(point,fetch);
      if (result.stateBoundaryStatus === 'outside') {
        setExploreLga('');
        setDeviceLocation({status: 'outside',
          message: 'Your device appears to be outside Ekiti State. Nearby Ekiti results are unavailable here, but you can still explore Ekiti categories or report an incident that happened there.'});
      } else if (result.stateBoundaryStatus === 'inside' &&
        result.consistency !== 'conflict' &&
        result.lga?.status === 'matched' && result.lga.match &&
        typeof result.lga.match.id === 'string' &&
        lgas.some(area => area.id === result.lga!.match!.id)) {
        const match = result.lga.match;
        const knownName = lgas.find(area => area.id === match.id)!.name;
        const ward = result.ward?.match;
        const wardName = result.consistency === 'consistent' &&
          result.ward?.status === 'matched' && ward?.parentId === match.id &&
          !ward.onBoundary && !result.stateOnBoundary && !match.onBoundary ?
            ward.name : undefined;
        setExploreLga(match.id);
        setDeviceLocation({
          status: 'matched', lgaName: knownName, wardName,
          message: 'Showing verified Ekiti LGA results for ' + knownName +
            (wardName ? ' · ' + wardName : '') +
            '. This is area filtering, not a distance-based nearby ranking.',
        });
      } else {
        setExploreLga('');
        setDeviceLocation({status: 'unmapped',
          message: 'Could not match the device location to one verified Ekiti LGA. Browse categories or choose an area manually.'});
      }
    } catch (error) {
      const denied=error instanceof PositionError&&error.reason==='denied';
      setDeviceLocation(denied
        ? {status:'denied',message:'Location permission was declined. You can still browse the entire directory.'}
        : {status:'unavailable',message:'Location is unavailable. You can browse Ekiti without it or try again.'});
    } finally {
      requestActive.current = false;
    }
  };

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
    pendingReportText, setPendingReportText,
    askDraft,
    setAskDraft,
    exploreService, setExploreService,
    exploreCategory, setExploreCategory,
    exploreQuery, setExploreQuery,
    exploreLga, setExploreLga,
    deviceLocation, requestDeviceLocation, dismissDeviceLocation, selectManualArea,
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp() {
  const context = React.useContext(Context);
  if (!context) throw new Error('AppProvider is required');
  return context;
}
