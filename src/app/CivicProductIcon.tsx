import * as React from 'react';

export type CivicProductIconName =
  'search'|'report'|'feedback'|'explore'|'map'|'business'|'track'|'account'|'web';

/**
 * Nine purpose-drawn Ekiti Civic product emblems. Different visual metaphors,
 * a shared 24px geometry and no external icon/fonts to download.
 */
export function CivicProductIcon({name,size=24}:{name:CivicProductIconName;size?:number}) {
  const artwork:Record<CivicProductIconName,React.ReactNode>={
    search:<>
      <circle cx="10.4" cy="10.2" r="6.5"/>
      <path d="m15.2 15.2 5.1 5.1" className="civic-icon-emphasis"/>
      <path d="m8.1 10.2 1.6 1.6 3.4-3.5" className="civic-icon-emphasis"/>
      <circle cx="18.5" cy="4.7" r="1.1" className="civic-icon-fill"/>
    </>,
    report:<>
      <path d="M5 3.2h9.7L19 7.6V21H5z"/>
      <path d="M14.7 3.2v4.5H19"/>
      <path d="M8 11h7M8 14.3h4.8"/>
      <path d="M15.7 15.4v4.4M13.5 17.6h4.4" className="civic-icon-emphasis"/>
    </>,
    feedback:<>
      <path d="M3.2 5.3h13.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.8 3v-3.1h-1a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z"/>
      <path d="M6.3 9.6h7.3M6.3 12.9h4.2"/>
      <circle cx="18.4" cy="5.5" r="3.1" fill="var(--surface)" className="civic-icon-emphasis"/>
      <path d="m17.2 5.5.9 1 1.6-2" className="civic-icon-emphasis"/>
    </>,
    explore:<>
      <circle cx="12" cy="12" r="9"/>
      <path d="m15.6 8.4-2.4 4.8-4.8 2.4 2.4-4.8z" className="civic-icon-emphasis"/>
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>
      <circle cx="12" cy="12" r="1" className="civic-icon-fill"/>
    </>,
    map:<>
      <path d="m2.7 6.1 6.1-3 6.2 2.6 6.3-2.6v14.8L15 21l-6.2-2.6-6.1 2.7V6.1Z"/>
      <path d="M8.8 3.1v15.3M15 5.7V21"/>
      <path d="M17.3 7.4a3 3 0 0 0-3 3c0 2 3 5.1 3 5.1s3-3.1 3-5.1a3 3 0 0 0-3-3Z" fill="var(--surface)" className="civic-icon-emphasis"/>
      <circle cx="17.3" cy="10.4" r=".7" className="civic-icon-fill"/>
    </>,
    business:<>
      <path d="M4 10.7V21h16V10.7"/>
      <path d="M3 5h18l-1 5.3c-.4 2-2.5 2.5-4.1.9-1.1 1.5-3.2 1.5-4.3 0-1.1 1.5-3.2 1.5-4.3 0C5.7 12.8 3.4 12.3 3 10.3L3 5Z"/>
      <path d="M8.3 21v-5.9h7.4V21"/>
      <path d="M5.5 5V2.9h13V5" className="civic-icon-emphasis"/>
    </>,
    track:<>
      <path d="M5.1 3.4h13.8v17.2H5.1z"/>
      <circle cx="9" cy="8" r="1.1" className="civic-icon-fill"/>
      <path d="M12 8h4.2M9 11.1v4.6" strokeDasharray="2.5 2.1"/>
      <circle cx="9" cy="16.7" r="1.1"/>
      <path d="m12 16.7 1.9 1.9 3.4-4.1" className="civic-icon-emphasis"/>
    </>,
    account:<>
      <circle cx="11.3" cy="8.6" r="3.2"/>
      <path d="M4.6 20.5c.2-4.5 2.5-6.8 6.7-6.8 2.1 0 3.8.6 5 2"/>
      <path d="m17.9 12.5 4 1.5v3.2c0 2.3-1.8 3.6-4 4.6-2.2-1-4-2.3-4-4.6V14z" className="civic-icon-emphasis"/>
      <path d="m16.5 17 1.1 1.1 2-2.2" className="civic-icon-emphasis"/>
    </>,
    web:<>
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18M12 3c-3.2 3.4-3.2 14.6 0 18M12 3c3.2 3.4 3.2 14.6 0 18"/>
      <circle cx="17.8" cy="6.7" r="1.8" fill="var(--surface)" className="civic-icon-emphasis"/>
      <circle cx="6.2" cy="17.4" r="1" className="civic-icon-fill"/>
    </>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.65"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {artwork[name]}
  </svg>;
}
