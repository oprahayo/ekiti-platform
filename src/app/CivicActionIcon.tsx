import * as React from 'react';

export type CivicIconName = 'report' | 'feedback' | 'ask' | 'explore' | 'listing';

/**
 * Original, multi-layer vector pictograms. They render as SVG at any DPR,
 * including offline, without remote icon fonts or colour-only meaning.
 */
export default function CivicActionIcon({name}: {name:CivicIconName}) {
  const gradientId = 'civic-icon-' + name;
  const palette: Record<CivicIconName,[string,string,string]> = {
    report:['#FF665E','#DA263B','#FFC65E'],
    feedback:['#8B6AFF','#6144D7','#54D9CF'],
    ask:['#42A8FF','#245DE2','#FFCD5C'],
    explore:['#38CFA6','#138F91','#FFCF66'],
    listing:['#FFAB4A','#ED5F4F','#6B8CFF'],
  };
  const [light,dark,accent] = palette[name];
  return <svg className="welcome-action-icon" viewBox="0 0 64 64" width="52" height="52"
    fill="none" aria-hidden="true" data-icon={name} focusable="false">
    <defs>
      <linearGradient id={gradientId+'-bg'} x1="7" y1="5" x2="55" y2="59" gradientUnits="userSpaceOnUse">
        <stop stopColor={light}/><stop offset="1" stopColor={dark}/>
      </linearGradient>
      <linearGradient id={gradientId+'-shine'} x1="9" y1="7" x2="53" y2="56" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" stopOpacity=".42"/><stop offset=".85" stopColor="#FFFFFF" stopOpacity="0"/>
      </linearGradient>
    </defs>
    <rect x="5" y="6" width="54" height="54" rx="17" fill={gradientId?'url(#'+gradientId+'-bg)':'none'}/>
    <rect x="5.7" y="6.7" width="52.6" height="52.6" rx="16.3"
      fill={'url(#'+gradientId+'-shine)'}/>
    <path d="M13 17c7-7 23-10 37-2" stroke="#FFFFFF" strokeOpacity=".28"
      strokeWidth="2.4" strokeLinecap="round"/>
    {name==='report' && <>
      <path d="M32 17 14 47a3 3 0 0 0 2.7 4.5h30.6A3 3 0 0 0 50 47L32 17Z"
        fill="#FFF9EE" stroke="#7C2330" strokeWidth="1.8" strokeLinejoin="round"/>
      <rect x="29.3" y="27" width="5.4" height="13.6" rx="2.7" fill="#E13E42"/>
      <circle cx="32" cy="45.7" r="3" fill="#E13E42"/>
      <circle cx="49.5" cy="16.5" r="5.6" fill={accent} stroke="#FFFFFF" strokeWidth="2"/>
    </>}
    {name==='feedback' && <>
      <path d="M14 24a10 10 0 0 1 10-10h17a10 10 0 0 1 10 10v10a10 10 0 0 1-10 10H27l-11 7 2-10a10 10 0 0 1-4-8V24Z"
        fill="#FFFFFF" stroke="#4632A4" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M23 27h19M23 34h13" stroke="#6C4ADF" strokeWidth="3.6" strokeLinecap="round"/>
      <circle cx="47" cy="44" r="8.2" fill={accent} stroke="#FFFFFF" strokeWidth="2"/>
      <path d="m43.6 44 2.2 2.2 4.1-5" stroke="#075D5A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </>}
    {name==='ask' && <>
      <path d="M31.5 14a20 20 0 0 0-15.8 32.3L12 53l9.1-3A20 20 0 1 0 31.5 14Z"
        fill="#F9FDFF" stroke="#1647A8" strokeWidth="1.7" strokeLinejoin="round"/>
      <path d="M25.8 26c1.1-5 11.8-6.2 12.3 1.2.4 4.9-5.3 5.7-6.2 10.4"
        stroke="#2570E1" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="32" cy="43.4" r="2.7" fill="#2570E1"/>
      <path d="M47 12.5V21M42.8 16.8h8.5" stroke={accent} strokeWidth="3.8" strokeLinecap="round"/>
    </>}
    {name==='explore' && <>
      <path d="M31.8 13c-11 0-18.5 8.5-18.5 18.9 0 12.6 18.5 23.4 18.5 23.4S50.3 44.5 50.3 32c0-10.4-7.5-19-18.5-19Z"
        fill="#FFFFFF" stroke="#076C6B" strokeWidth="1.8" strokeLinejoin="round"/>
      <circle cx="31.8" cy="31.3" r="10.4" fill="#4DD7B4" stroke="#148B85" strokeWidth="2"/>
      <circle cx="31.8" cy="31.3" r="4.2" fill="#FFFFFF"/>
      <path d="m45 17 3.5-5 3.4 5" fill={accent} stroke="#FFFFFF" strokeWidth="1.7" strokeLinejoin="round"/>
    </>}
    {name==='listing' && <>
      <rect x="14" y="27" width="36" height="26" rx="3.7" fill="#FFFFFF" stroke="#A74340" strokeWidth="1.7"/>
      <path d="m12 27 5-13h30l5 13v4a5 5 0 0 1-10 0 5 5 0 0 1-10 0 5 5 0 0 1-10 0 5 5 0 0 1-10 0v-4Z"
        fill="#FFF3DA" stroke="#9E3F37" strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="m22 14-3.6 13m13.6-13v13m10-13 3.6 13" stroke="#F06A4D" strokeWidth="3"/>
      <rect x="28" y="38" width="10" height="15" rx="1.4" fill="#77B7FB"/>
      <rect x="18" y="37" width="7" height="7" rx="1.5" fill="#80D8C7"/>
    </>}
  </svg>;
}
