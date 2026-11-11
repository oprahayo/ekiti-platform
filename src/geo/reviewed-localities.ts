/**
 * Small provenance-backed Ekiti place index. This is not geocoding, GPS
 * verification or a substitute for the future sourced town gazetteer.
 * Entries should only be added after a documented public-source review.
 * Inference returns a *candidate* requiring the resident's confirmation.
 */
export interface ReviewedLocality {
  name: string;
  kind: 'town' | 'neighbourhood' | 'lga';
  lgaId: string;
  lgaName: string;
  aliases: readonly string[];
  source: string;
  /** Standalone personal names need explicit spatial context. */
  contextualOnly?: boolean;
}
const governmentLgas = 'https://www.ekitistate.gov.ng/about-ekiti/local-government';
const lgAs: readonly [string,string,readonly string[]][] = [
  ['ado-ekiti','Ado-Ekiti',['Ado Ekiti']],
  ['efon','Efon',['Efon Alaaye','Efon']],
  ['ekiti-east','Ekiti East',['Ekiti East']],
  ['ekiti-south-west','Ekiti South-West',['Ekiti South West']],
  ['ekiti-west','Ekiti West',['Ekiti West']],
  ['emure','Emure',['Emure Ekiti']],
  ['gbonyin','Gbonyin',['Gbonyin','Aiyekire LGA']],
  ['ido-osi','Ido/Osi',['Ido Osi','Ido Ekiti']],
  ['ijero','Ijero',['Ijero Ekiti']],
  ['ikere','Ikere',['Ikere Ekiti','Ikere']],
  ['ikole','Ikole',['Ikole Ekiti','Ikole']],
  ['ilejemeje','Ilejemeje',['Ilejemeje']],
  ['irepodun-ifelodun','Irepodun/Ifelodun',['Irepodun Ifelodun']],
  ['ise-orun','Ise/Orun',['Ise Orun']],
  ['moba','Moba',['Moba']],
  ['oye','Oye',['Oye Ekiti']],
];
const sourceLocalities: readonly ReviewedLocality[] = [
  {
    name:'Adebayo, Ado-Ekiti',kind:'neighbourhood',lgaId:'ado-ekiti',
    lgaName:'Ado-Ekiti',aliases:['Adebayo','Adebayo Road'],
    source:'https://www.ekitistate.gov.ng/about-ekiti/local-government/ado-ekiti',
    contextualOnly:true,
  },
  {
    name:'Iludun-Ekiti',kind:'town',lgaId:'ilejemeje',
    lgaName:'Ilejemeje',aliases:['Iludun Ekiti','Iludun'],
    source:'https://www.ekitistate.gov.ng/about-ekiti/local-government/ilejemeje',
  },
  {
    name:'Eda-Oniyo-Ekiti',kind:'town',lgaId:'ilejemeje',
    lgaName:'Ilejemeje',aliases:['Eda Oniyo Ekiti','Eda Oniyo','Edaoniyo'],
    source:'https://www.ekitistate.gov.ng/archives/28314',
  },
  {
    name:'Ikogosi-Ekiti',kind:'town',lgaId:'ekiti-west',
    lgaName:'Ekiti West',aliases:['Ikogosi Ekiti','Ikogosi'],
    source:'https://www.ekitistate.gov.ng/about-ekiti/tourism',
  },
];
export const reviewedLocalities: readonly ReviewedLocality[] = [
  ...sourceLocalities,
  ...lgAs.map(([lgaId,lgaName,aliases]):ReviewedLocality=>({
    name:lgaName,kind:'lga',lgaId,lgaName,aliases,
    source:governmentLgas,
  })),
];

export function normaliseEkitiText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLocaleLowerCase('en')
    .replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
function aliasEvidence(normalised: string, alias: string, contextualOnly: boolean):boolean {
  const a=normaliseEkitiText(alias);
  if(!a)return false;
  const wrapped=' '+normalised+' ', match=' '+a+' ';
  let at=wrapped.indexOf(match);
  while(at>=0){
    if(!contextualOnly)return true;
    const before=wrapped.slice(0,at+1).trimEnd();
    const after=wrapped.slice(at+match.length).trimStart();
    if(/\b(in|at|near|around|along|from|within|towards|toward|off|on|inside)\s*$/u.test(before) ||
       /^(road|street|area|junction|neighbourhood|neighborhood)\b/u.test(after))
      return true;
    at=wrapped.indexOf(match,at+1);
  }
  return false;
}
export type LocalityInference =
  | {status:'candidate';place:ReviewedLocality;source:'reviewed-place-name'}
  | {status:'ambiguous';lgaIds:readonly string[]}
  | {status:'unresolved'};

/** No external request, no private report text logging or persistence. */
export function inferEkitiLocality(text:string):LocalityInference {
  const normalised=normaliseEkitiText(text);
  if(normalised.length<2)return {status:'unresolved'};
  const matches=reviewedLocalities.filter(item=>
    item.aliases.some(a=>aliasEvidence(normalised,a,!!item.contextualOnly)));
  if(!matches.length)return {status:'unresolved'};
  const lgaIds=[...new Set(matches.map(item=>item.lgaId))];
  if(lgaIds.length>1)return {status:'ambiguous',lgaIds:lgaIds.sort()};
  // Prefer the named place over a broad LGA, and prefer the longest phrase.
  matches.sort((a,b)=>{
    if(a.kind==='lga' && b.kind!=='lga')return 1;
    if(b.kind==='lga' && a.kind!=='lga')return -1;
    return Math.max(...b.aliases.map(x=>normaliseEkitiText(x).length))-
      Math.max(...a.aliases.map(x=>normaliseEkitiText(x).length));
  });
  return {status:'candidate',place:matches[0],source:'reviewed-place-name'};
}
