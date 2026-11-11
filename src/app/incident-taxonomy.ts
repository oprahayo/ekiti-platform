import type { ReportCategory } from './report-journey-state.ts';

export type IncidentLanguage = 'en' | 'yo';
export type DangerAnswer = 'unknown' | 'yes' | 'no';
export interface IncidentChoice {
  id: string;
  label: Record<IncidentLanguage, string>;
}
export interface IncidentSpec {
  prompt: Record<IncidentLanguage, string>;
  choices: readonly IncidentChoice[];
}
const choice = (id:string,en:string,yo:string):IncidentChoice => ({id,label:{en,yo}});
/** Questions describe potential impact, not a claim of emergency-service triage. */
export const INCIDENT_TAXONOMY: Record<ReportCategory, IncidentSpec> = {
  Emergency: {
    prompt:{en:'Which immediate concern best describes the situation?',
      yo:'Kí ni ìṣòro pàjáwìrì tó sunmọ́ jù lọ?'},
    choices:[choice('injury','Someone is hurt','Ẹnìkan fara pa'),
      choice('fire','Fire or smoke','Iná tàbí èéfín'),
      choice('immediate_threat','Threat to personal safety','Ewu sí ààbò ẹni'),
      choice('other','Other immediate concern','Ìṣòro pàjáwìrì míì')],
  },
  Security: {
    prompt:{en:'What kind of safety concern is this?',
      yo:'Irú ìṣòro ààbò wo ni èyí?'},
    choices:[choice('theft','Theft or property crime','Olè jíjà tàbí ìwà ọ̀daràn'),
      choice('harassment','Harassment or threats','Ìdúnni mọ́ra tàbí ìhalẹ̀'),
      choice('unsafe_area','Unsafe public area','Àgbègbè tí kò ní ààbò'),
      choice('other','Another safety issue','Ìṣòro ààbò míì')],
  },
  Roads: {
    prompt:{en:'What is the main road problem?',
      yo:'Kí ni ìṣòro ọ̀nà pàtàkì náà?'},
    choices:[choice('potholes','Potholes or damaged surface','Ihò tàbí àbùkù ọ̀nà'),
      choice('blocked','Road blocked or impassable','Ọ̀nà dí tàbí kò ṣeé kọjá'),
      choice('signage','Missing signs or crossings','Àmì ọ̀nà tàbí ibi ìkọjá kò sí'),
      choice('other','Other road problem','Ìṣòro ọ̀nà míì')],
  },
  Drainage: {
    prompt:{en:'What is happening with the drainage?',
      yo:'Kí ló ń ṣẹlẹ̀ sí ọ̀nà ìṣàn omi?'},
    choices:[choice('blocked','Blocked drainage','Ọ̀nà ìṣàn omi dí'),
      choice('flooding','Flooding','Ìkún omi'),
      choice('broken','Damaged drainage structure','Ìbàjẹ́ ọ̀nà ìṣàn omi'),
      choice('other','Other drainage issue','Ìṣòro míì')],
  },
  Water: {
    prompt:{en:'What is wrong with the water service?',
      yo:'Kí ni ìṣòro pẹ̀lú omi?'},
    choices:[choice('no_supply','No water supply','Omi kò sí'),
      choice('unsafe','Unsafe or contaminated water','Omi tí kò dáa láti lò'),
      choice('leak','Broken pipe or leak','Páìpù fọ́ tàbí ń jo'),
      choice('other','Other water issue','Ìṣòro omi míì')],
  },
  Electricity: {
    prompt:{en:'What is the main electricity concern?',
      yo:'Kí ni ìṣòro iná mànàmáná pàtàkì náà?'},
    choices:[choice('outage','Power outage','Iná mànàmáná kò sí'),
      choice('hazard','Exposed wire or electrical danger','Wáyà tí ó lewu'),
      choice('transformer','Transformer or pole problem','Ìṣòro transformer tàbí òpó'),
      choice('other','Other electricity issue','Ìṣòro iná míì')],
  },
  Sanitation: {
    prompt:{en:'What sanitation problem should be described?',
      yo:'Kí ni ìṣòro ìmọ́tótó náà?'},
    choices:[choice('waste','Uncollected waste','Ìdọ̀tí tí a kò kó'),
      choice('sewage','Sewage or open dumping','Ìdọ̀tí omi tàbí ìdọ̀tí níta'),
      choice('public_toilet','Public toilet or hygiene concern','Ìṣòro ilé ìgbọ̀nsẹ̀ tàbí ìmọ́tótó'),
      choice('other','Other sanitation problem','Ìṣòro ìmọ́tótó míì')],
  },
  Health: {
    prompt:{en:'Which health-service concern applies?',
      yo:'Ìṣòro iṣẹ́ ìlera wo ló kan ọ̀rọ̀ yìí?'},
    choices:[choice('access','Cannot access a clinic or care','Kò rọrùn láti rí ìtọ́jú'),
      choice('staffing','Staff or medicine unavailable','Òṣìṣẹ́ tàbí oogun kò sí'),
      choice('facility','Unsafe or damaged health facility','Ilé ìwòsàn tí kò dáa'),
      choice('other','Other health concern','Ìṣòro ìlera míì')],
  },
  Education: {
    prompt:{en:'Which education issue are you reporting?',
      yo:'Ìṣòro ẹ̀kọ́ wo ni o fẹ́ sọ?'},
    choices:[choice('facility','Damaged school facility','Ilé ẹ̀kọ́ ti bàjẹ́'),
      choice('access','Cannot access schooling','Ìṣòro wíwọlé sí ẹ̀kọ́'),
      choice('resources','Missing teachers or materials','Olùkọ́ tàbí ohun èlò kò pé'),
      choice('other','Other education issue','Ìṣòro ẹ̀kọ́ míì')],
  },
  Environment: {
    prompt:{en:'What environmental concern applies?',
      yo:'Ìṣòro àyíká wo ni èyí?'},
    choices:[choice('pollution','Air, land or water pollution','Ìdọ̀tí afẹ́fẹ́, ilẹ̀ tàbí omi'),
      choice('erosion','Erosion or damaged land','Ìjẹ̀gbìn ilẹ̀'),
      choice('tree','Dangerous tree or vegetation','Igi tàbí ewéko tí ó lewu'),
      choice('other','Other environmental issue','Ìṣòro àyíká míì')],
  },
  'Public facilities': {
    prompt:{en:'Which public facility issue applies?',
      yo:'Ìṣòro ilé tàbí ohun èlò ìjọba wo ni èyí?'},
    choices:[choice('broken','Broken or inaccessible facility','Ohun èlò tí ó bàjẹ́'),
      choice('maintenance','Maintenance needed','A nílò àtúnṣe'),
      choice('access','Accessibility barrier','Ìṣòro wíwọlé'),
      choice('other','Other public facility issue','Ìṣòro ohun èlò míì')],
  },
  'Service delay / corruption': {
    prompt:{en:'What kind of service issue do you want to document?',
      yo:'Irú ìṣòro iṣẹ́ wo ni o fẹ́ ṣàkọsílẹ̀?'},
    choices:[choice('delay','Unexplained delay','Ìdádúró láìsí ìdí'),
      choice('fee','Unclear fee or payment request','Owo tàbí ìbéèrè ìsanwó tí kò ye'),
      choice('conduct','Conduct or fairness concern','Ìṣòro ìwà tàbí ìdájọ́ òdodo'),
      choice('other','Other service concern','Ìṣòro iṣẹ́ míì')],
  },
  Suggestion: {
    prompt:{en:'What is your suggestion about?',
      yo:'Kí ni àbá rẹ dá lórí?'},
    choices:[choice('improvement','Improve an existing service','Ṣàtúnṣe iṣẹ́ tó wà'),
      choice('new_service','Introduce a new service','Bẹ̀rẹ̀ iṣẹ́ tuntun'),
      choice('policy','Change a policy or process','Yí ìlànà padà'),
      choice('other','Other suggestion','Àbá míì')],
  },
  Commendation: {
    prompt:{en:'What are you recognising?',
      yo:'Kí ni o fẹ́ yìn?'},
    choices:[choice('staff','Helpful staff member or team','Òṣìṣẹ́ tàbí ẹgbẹ́ rere'),
      choice('service','A useful service','Iṣẹ́ tí ó wúlò'),
      choice('project','A completed community project','Iṣẹ́ agbègbè tí a parí'),
      choice('other','Other positive outcome','Ohun rere míì')],
  },
  Other: {
    prompt:{en:'What best fits your report?',
      yo:'Èwo ló bá ìròyìn rẹ mu jù?'},
    choices:[choice('community','Community issue','Ìṣòro agbègbè'),
      choice('service','Public service issue','Ìṣòro iṣẹ́ ìjọba'),
      choice('feedback','General feedback','Èrò gbogbogbò'),
      choice('other','Something else','Ohun míì')],
  },
};

export function taxonomyQuestion(category:ReportCategory, language:IncidentLanguage):string {
  return INCIDENT_TAXONOMY[category].prompt[language];
}
export function taxonomyChoiceLabel(category:ReportCategory,id:string,language:IncidentLanguage):string|null {
  return INCIDENT_TAXONOMY[category].choices.find(item=>item.id===id)?.label[language] ?? null;
}
export function hasValidTaxonomyChoice(category:ReportCategory,id:string):boolean {
  return !!taxonomyChoiceLabel(category,id,'en');
}
export type ReviewSignal = 'immediate_safety_concern'|'manual_review_required';
/** A conservative user-declared signal, NOT automated emergency dispatch or case priority. */
export function reviewSignal(category:ReportCategory,danger:DangerAnswer):ReviewSignal {
  return category==='Emergency' || danger==='yes' ?
    'immediate_safety_concern' : 'manual_review_required';
}

export interface SimilarDraftInput {
  purpose:'report'|'feedback';
  category:ReportCategory;
  lgaId:string;
  description:string;
}
/** Compare ONLY to an explicitly saved draft from this same tab. No API calls. */
export function possibleSameTabDraft(current:SimilarDraftInput, saved:SimilarDraftInput|null):boolean {
  if (!saved || saved.purpose!==current.purpose ||
    saved.category!==current.category || saved.lgaId!==current.lgaId) return false;
  const stop=new Set(['the','a','an','at','in','on','near','to','and','for','by','of','is',
    'has','was','are','there','this','that','with','it','we','our','from','now','very']);
  const words=(value:string)=>new Set(value.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').split(/[^a-z0-9]+/)
    .filter(part=>part.length>2 && !stop.has(part)).slice(0,240));
  const left=words(current.description),right=words(saved.description);
  if (left.size<4 || right.size<4) return false;
  let overlap=0;
  for(const part of left) if(right.has(part)) overlap++;
  return overlap>=4 && overlap/Math.min(left.size,right.size)>=0.72;
}
