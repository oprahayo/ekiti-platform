import * as React from 'react';

export type CivicProductIconName =
  'search'|'report'|'feedback'|'explore'|'map'|'business'|'track'|'account'|'web';

/** Crisp, consistent line icons, bundled as SVG; no network icon package. */
export function CivicProductIcon({name,size=24}:{name:CivicProductIconName;size?:number}) {
  const artwork:Record<CivicProductIconName,React.ReactNode>={
    search:<><circle cx="10.9" cy="10.9" r="7"/><path d="m16.1 16.1 4.9 4.9"/><circle cx="10.9" cy="10.9" r="2.1" className="civic-icon-mark"/></>,
    report:<><path d="M12 2.5 2.6 20h18.8L12 2.5Z"/><path d="M12 9v5.3"/><circle cx="12" cy="17.2" r=".9" className="civic-icon-mark"/></>,
    feedback:<><path d="M20.5 11.5c0 5-3.8 8.5-9 8.5-1.5 0-3-.3-4.2-1L3 20l1.2-4C3.4 14.7 3 13.2 3 11.5 3 6.7 6.8 3 11.5 3s9 3.7 9 8.5Z"/><path d="M7.5 10.6h8M7.5 14h5"/><circle cx="18.2" cy="4.6" r="1.4" className="civic-icon-mark"/></>,
    explore:<><circle cx="12" cy="12" r="9"/><path d="m15.7 8.3-2.3 5.1-5.1 2.3 2.3-5.1 5.1-2.3Z"/><circle cx="12" cy="12" r=".8" className="civic-icon-mark"/></>,
    map:<><path d="M3 6.2 9.3 3l5.3 2.5L21 2.7v15.1L14.7 21l-5.3-2.5L3 21V6.2Z"/><path d="M9.3 3v15.5M14.7 5.5V21"/><circle cx="17.4" cy="11.7" r="1.4" className="civic-icon-mark"/></>,
    business:<><path d="M4 9.5V21h16V9.5M3 5h18l-1.2 5.2c-.3 1.1-1.2 1.8-2.2 1.8-1.1 0-1.8-.4-2.4-1.3-.4.9-1.4 1.3-2.4 1.3s-1.8-.4-2.4-1.3c-.5.9-1.4 1.3-2.4 1.3s-1.9-.7-2.2-1.8L3 5Z"/><path d="M9 21v-6h6v6"/><circle cx="19" cy="5" r="1.1" className="civic-icon-mark"/></>,
    track:<><path d="M8 4.5H5A2 2 0 0 0 3 6.5V21h18V6.5a2 2 0 0 0-2-2h-3"/><rect x="8" y="2.5" width="8" height="4" rx="1"/><path d="m8 14 2.4 2.4L16 10.7"/><circle cx="18.6" cy="17.5" r="1.1" className="civic-icon-mark"/></>,
    account:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3.2"/><path d="M5.5 18.2c1.3-3 3.4-4.3 6.5-4.3s5.2 1.3 6.5 4.3"/><circle cx="18.8" cy="5.2" r="1.2" className="civic-icon-mark"/></>,
    web:<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-3.1 3.3-3.1 14.7 0 18M12 3c3.1 3.3 3.1 14.7 0 18"/><circle cx="17.6" cy="7.2" r="1.2" className="civic-icon-mark"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" focusable="false">
    {artwork[name]}
  </svg>;
}
