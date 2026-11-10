import * as React from 'react';
import type { Category } from './fixtures.ts';

/**
 * Category grid is presentation taxonomy only. The reviewed-directory database
 * currently supports four coarse categories; other trades are browse-ready,
 * not falsely described as populated or verified.
 */
export type DirectoryIconName =
  | 'hotel' | 'food' | 'hospital' | 'school' | 'nightlife' | 'office'
  | 'plumber' | 'salon' | 'carpenter' | 'electrician' | 'cleaner' | 'painter'
  | 'locksmith' | 'mover' | 'gardener' | 'mechanic' | 'builder' | 'roofer'
  | 'transport' | 'market' | 'tourism' | 'agriculture' | 'bank' | 'other';

export interface DirectoryCategory {
  id: DirectoryIconName;
  label: string;
  keywords: string;
  group?: Exclude<Category, 'All'>;
}

export const directoryCategories: readonly DirectoryCategory[] = [
  { id: 'hotel', label: 'Hotels', keywords: 'hotel lodging guesthouse resort accommodation stay', group: 'Hotels' },
  { id: 'food', label: 'Restaurants', keywords: 'food eatery buka cafe restaurant catering' },
  { id: 'hospital', label: 'Hospitals', keywords: 'clinic health pharmacy doctor hospital', group: 'Health' },
  { id: 'school', label: 'Schools', keywords: 'education academy campus learning university', group: 'Schools' },
  { id: 'nightlife', label: 'Nightlife', keywords: 'club bars nightlife lounge music entertainment' },
  { id: 'office', label: 'Govt Offices', keywords: 'government public offices agency ministry', group: 'Offices' },
  { id: 'plumber', label: 'Plumbers', keywords: 'plumbing pipes water repairs' },
  { id: 'salon', label: 'Hairdressers', keywords: 'hairdresser barber salon hair beauty' },
  { id: 'carpenter', label: 'Carpenters & Joiners', keywords: 'carpenter joiner furniture woodcraft' },
  { id: 'electrician', label: 'Electricians', keywords: 'electrical wiring power electrician' },
  { id: 'cleaner', label: 'Cleaners', keywords: 'cleaning housekeeping laundry janitorial' },
  { id: 'painter', label: 'Painters', keywords: 'painting decorators paint' },
  { id: 'locksmith', label: 'Locksmiths', keywords: 'locks keys security locksmiths' },
  { id: 'mover', label: 'Movers', keywords: 'delivery relocation logistics movers haulage' },
  { id: 'gardener', label: 'Gardeners', keywords: 'landscaping plants gardening gardener' },
  { id: 'mechanic', label: 'Mechanics', keywords: 'car repair auto mechanic vehicle' },
  { id: 'builder', label: 'Builders', keywords: 'construction building contractors' },
  { id: 'roofer', label: 'Roofers', keywords: 'roof roofing roofers repairs' },
  { id: 'transport', label: 'Transport', keywords: 'bus taxi keke transportation' },
  { id: 'market', label: 'Markets & Shops', keywords: 'market shop retail grocery supermarket' },
  { id: 'tourism', label: 'Tourism', keywords: 'attractions travel waterfall ikogosi places' },
  { id: 'agriculture', label: 'Agriculture', keywords: 'farms farmer crops poultry produce' },
  { id: 'bank', label: 'Banks', keywords: 'finance atm bank cooperative' },
  { id: 'other', label: 'More Services', keywords: 'business professional services other' },
];

export function DirectoryMark() {
  // Original Yellow Pages book + location mark, not a government emblem.
  return <svg className="directory-mark" viewBox="0 0 76 72" aria-hidden="true" fill="none"
    stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M37 58C26 51 17 49 6 53V11c12-4 23-1 31 6v41Z"/>
    <path d="M37 58c11-7 20-9 32-5V11c-12-4-23-1-32 6v41Z"/>
    <path d="M37 17v41M12 18c8-2 14 0 20 5M43 23c7-5 13-6 20-5"/>
    <path d="M19 29c7-1 11 1 13 4M43 34c5-4 10-5 17-4" stroke="var(--directory-yellow)" strokeWidth="5"/>
    <path d="M56 41c0-5 4-8 8-8s8 3 8 8-8 14-8 14-8-9-8-14Z" fill="var(--directory-yellow)" strokeWidth="2.5"/>
    <circle cx="64" cy="41" r="2" fill="currentColor" stroke="none"/>
  </svg>;
}

const art: Record<DirectoryIconName, React.ReactNode> = {
  hotel: <><path d="M9 52V21h46v31M17 21V13h30v8M9 47h46"/><path d="M18 29h9v10h-9zM37 29h9v10h-9z" fill="var(--directory-yellow)" /><path d="M28 52V42h8v10"/></>,
  food: <><circle cx="31" cy="34" r="17"/><circle cx="31" cy="34" r="10" fill="var(--directory-yellow)" /><path d="M10 9v13m5-13v13m5-13v13m-5 0v32M52 9v45m0-45c-9 9-9 20 0 23"/></>,
  hospital: <><path d="M12 55V20h40v35M22 20V10h20v10M8 55h48" /><path d="M26 28h12v6h-12v9h-6V34h6z" fill="var(--directory-yellow)" /><path d="M36 55V44h9v11"/></>,
  school: <><path d="m7 25 25-13 25 13-25 13L7 25ZM16 32v14c9 7 23 7 32 0V32M56 26v18"/><path d="m24 42 8 3 8-3" stroke="var(--directory-yellow)" strokeWidth="6"/></>,
  nightlife: <><path d="M17 15v25m0 0a7 7 0 1 1-7-7c2 0 5 1 7 3M17 15l20-5v26m0 0a7 7 0 1 1-7-7c3 0 5 1 7 3"/><path d="M17 15 37 10v8l-20 5z" fill="var(--directory-yellow)"/><path d="M47 46l3 6 6 3-6 2-3 5-2-5-5-2 5-3z"/></>,
  office: <><path d="M9 56h46M13 52V26h38v26M9 26l23-14 23 14z"/><path d="M23 30v20m9-20v20m9-20v20" stroke="var(--directory-yellow)" strokeWidth="6"/><path d="M17 30v22m15-22v22m15-22v22"/></>,
  plumber: <><path d="M8 12h13v14h9v14h10V26h16v14H43v11H27V39H16V26H8z" /><path d="M16 29h10v8H16z" fill="var(--directory-yellow)"/><path d="M10 8h9m-9 22h9M46 22h8M46 44h8"/></>,
  salon: <><path d="M8 22v17h14V22H8zM22 25h13c7 0 12-4 12-11H22M35 27v24c0 5 11 5 11 0V40h8"/><path d="M22 14h25v10H22z" fill="var(--directory-yellow)"/><path d="M8 31H4m25 7v7"/></>,
  carpenter: <><path d="m13 48 27-27M30 15l9-9 9 2 6 10-8 8-6-6-22 32c-5 6-13 0-5-4Z"/><path d="m18 45 21-22" stroke="var(--directory-yellow)" strokeWidth="6"/></>,
  electrician: <><path d="M34 6 15 35h15l-3 23 23-34H34z"/><path d="m35 14-13 19h11l-2 16 12-19H30z" fill="var(--directory-yellow)" /><path d="M8 22 4 19m50 29 6 3M8 48l-4 3M55 14l4-4"/></>,
  cleaner: <><path d="M24 14h17v8l-6 6 7 9v17H17V37l7-9zM21 14V8h25v6M24 22h16"/><path d="M24 37h11v10H24z" fill="var(--directory-yellow)"/><path d="m49 18 2 5 5 2-5 2-2 5-2-5-5-2 5-2zM50 43l2 3 3 2-3 2-2 3-2-3-3-2 3-2z"/></>,
  painter: <><path d="M7 15h44v15H7zM51 23h7v11H35v8M35 42v14"/><path d="M12 19h34v7H12z" fill="var(--directory-yellow)" /><path d="M20 30v7m0 0c0 5 7 5 7 0v-7M27 30v5"/></>,
  locksmith: <><path d="M15 28v-9c0-10 7-15 17-15s17 5 17 15v9M23 28v-9c0-5 4-8 9-8s9 3 9 8v9"/><rect x="10" y="28" width="44" height="29" rx="8"/><path d="M32 34a6 6 0 0 0-3 11v6h6v-6a6 6 0 0 0-3-11" fill="var(--directory-yellow)"/></>,
  mover: <><path d="M7 24h31v26H7zM38 32h10l10 12v6H38zM48 32v11h10"/><path d="M12 29h21v15H12z" fill="var(--directory-yellow)"/><circle cx="19" cy="51" r="5" fill="var(--directory-bg)"/><circle cx="48" cy="51" r="5" fill="var(--directory-bg)"/><path d="M3 32h4M1 39h6"/></>,
  gardener: <><path d="M32 56V32M32 42c-14 0-23-7-23-22 14 0 23 8 23 22ZM32 34c0-16 8-23 23-23 0 16-8 23-23 23Z"/><path d="M32 42c-9 0-16-4-19-14M32 34c5-10 12-15 19-19" stroke="var(--directory-yellow)" strokeWidth="5"/><path d="M13 56c3-7 10-10 19-10s16 3 19 10z"/></>,
  mechanic: <><path d="M45 7a16 16 0 0 0-18 20L9 45a7 7 0 0 0 10 10l18-18A16 16 0 0 0 57 19l-10 10-12-2-2-12Z"/><path d="m15 48 22-22" stroke="var(--directory-yellow)" strokeWidth="6"/></>,
  builder: <><path d="M10 43c0-16 8-27 22-29 14 2 22 13 22 29M12 44h40c5 0 7 7 0 9H12c-7-2-5-9 0-9ZM26 16v22m12-22v22"/><path d="M17 36c2-9 5-12 9-15v17H17zM47 36c-2-9-5-12-9-15v17h9z" fill="var(--directory-yellow)"/></>,
  roofer: <><path d="m5 35 27-24 27 24M14 34v22h36V34M28 56V44h9v12M47 21v-9h8v16"/><path d="m11 34 21-19 21 19" stroke="var(--directory-yellow)" strokeWidth="6"/></>,
  transport: <><rect x="8" y="12" width="48" height="39" rx="7"/><path d="M9 30h46M21 12v18m22-18v18M13 42h9m20 0h9"/><path d="M14 17h35v11H14z" fill="var(--directory-yellow)"/><circle cx="19" cy="53" r="4" fill="var(--directory-bg)"/><circle cx="45" cy="53" r="4" fill="var(--directory-bg)"/></>,
  market: <><path d="M10 25h44v31H10zM7 25l7-15h36l7 15"/><path d="M7 25c0 10 11 10 12 0 1 10 12 10 13 0 1 10 12 10 13 0 1 10 11 10 12 0" fill="var(--directory-yellow)"/><path d="M20 56V39h13v17M41 39h9v9h-9z"/></>,
  tourism: <><path d="M32 58s-20-18-20-32a20 20 0 0 1 40 0c0 14-20 32-20 32Z"/><circle cx="32" cy="26" r="10" fill="var(--directory-yellow)"/><path d="m24 30 9-11 7 10M24 38l8-7 8 7"/></>,
  agriculture: <><path d="M32 56V12m0 33C18 46 11 39 11 26c13 0 21 7 21 19Zm0-12c0-13 8-21 21-21 0 13-8 21-21 21Z"/><path d="M32 44c-8-3-14-8-17-14M32 32c6-6 10-10 17-13" stroke="var(--directory-yellow)" strokeWidth="5"/><path d="M19 57h26M24 52h16"/></>,
  bank: <><path d="m7 23 25-14 25 14v6H7zM12 54h40M8 59h48M16 30v23m12-23v23m12-23v23m8-23v23"/><path d="M16 15h32l-16 9z" fill="var(--directory-yellow)"/></>,
  other: <><rect x="8" y="8" width="20" height="20" rx="4" fill="var(--directory-yellow)"/><rect x="36" y="8" width="20" height="20" rx="4"/><rect x="8" y="36" width="20" height="20" rx="4"/><path d="M46 36v20M36 46h20"/></>,
};

export function DirectoryIcon({ name }: { name: DirectoryIconName }) {
  return <svg className="directory-tile-icon" viewBox="0 0 64 64" aria-hidden="true"
    fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    {art[name]}
  </svg>;
}

export function categoryForGroup(group: Category): DirectoryCategory | undefined {
  if (group === 'All') return undefined;
  return directoryCategories.find(item => item.group === group);
}
