import type { Language } from '../server/ask-knowledge.ts';

export type JourneyStep = 'method' | 'category' | 'description' | 'location' | 'evidence'
  | 'followup' | 'contact' | 'review' | 'saved';
export type EvidenceMethod = 'Text' | 'Photo' | 'Video' | 'Audio';

export const REPORT_DRAFT_KEY = 'ekiti-guided-draft-v1';
export const CHAT_SOUND_KEY = 'ekiti-chat-sounds-v1';
export const REPORT_CATEGORIES = [
  'Emergency', 'Security', 'Roads', 'Drainage', 'Water', 'Electricity',
  'Sanitation', 'Health', 'Education', 'Environment',
  'Public facilities', 'Service delay / corruption', 'Suggestion', 'Commendation', 'Other',
] as const;
export type ReportCategory = typeof REPORT_CATEGORIES[number];

export const REPORT_STEPS: readonly JourneyStep[] = [
  'method','category','description','location','evidence','followup','contact','review',
];

const QUESTIONS: Record<Language, Record<JourneyStep,string>> = {
  en:{
    method:'How would you like to share what happened?',
    category:'What best describes the report? Choose one category.',
    description:'Tell me what happened, in your own words. A short, clear explanation is enough.',
    location:'Where in Ekiti did it happen? Choose the LGA and optionally add a community or nearby landmark.',
    evidence:'Would you like to attach evidence now? Only you can see media previews in this browser.',
    followup:'Would you like a private tracking link sent to you once real reporting launches?',
    contact:'Where should that tracking link be sent? Your contact is only held in this tab during this preview.',
    review:'Here is your draft. Check it before saving on this device.',
    saved:'Your draft is saved in this browser session. No government office has received it.',
  },
  yo:{
    method:'Báwo ni o ṣe fẹ́ ṣàlàyé ohun tí ó ṣẹlẹ̀?',
    category:'Irú ìṣẹ̀lẹ̀ wo ni èyí? Yan ẹ̀ka kan.',
    description:'Sọ ohun tí ó ṣẹlẹ̀ ní ọ̀rọ̀ tirẹ. Àlàyé kúkúrú tó ṣe kedere tó.',
    location:'Níbo ní Èkìtì ni ó ti ṣẹlẹ̀? Yan ìjọba ìbílẹ̀, o sì lè fi orúkọ àdúgbò kún un.',
    evidence:'Ṣé o fẹ́ fi ẹ̀rí kún un? Ìwọ nìkan ló lè rí àwòrán tàbí fídíò nínú aṣàwákiri yìí.',
    followup:'Ṣé o fẹ́ gba ìjápọ̀ ìtọ́pinpin nígbà tí ìròyìn gidi bá bẹ̀rẹ̀?',
    contact:'Níbo ni a ó fi ìjápọ̀ náà ránṣẹ́? Àlàyé ìbánisọ̀rọ̀ rẹ dúró ní ojú ìwé yìí nìkan.',
    review:'Wo àkójọ ìròyìn rẹ kí o tó fi pamọ́ lórí ẹ̀rọ yìí.',
    saved:'A ti fi àkójọ rẹ pamọ́ sínú aṣàwákiri yìí. Kò sí ọ́fíìsì ìjọba tó gba a.',
  },
};

export function journeyPrompt(step:JourneyStep, language:Language):string {
  return QUESTIONS[language][step];
}
export function journeyWelcome(feedback:boolean, language:Language):string {
  if (language === 'yo') return (feedback
    ? 'Káàbọ̀. Ẹ jẹ́ ká ṣàtúnṣe èrò rẹ pọ̀. '
    : 'Káàbọ̀. Màá tọ́ ọ sọ́nà láti fi ìròyìn ránṣẹ́, ìbéèrè kan lẹ́ẹ̀kan. ')
    + journeyPrompt('method', language);
  return (feedback
    ? 'Welcome. We can prepare your feedback together. '
    : 'Welcome. I will guide you through a report, one question at a time. ')
    + journeyPrompt('method', language);
}

export interface SavedJourneyDraft {
  purpose:'report'|'feedback';
  method:EvidenceMethod;
  category:ReportCategory;
  description:string;
  lgaId:string;
  community:string;
  savedAt:string;
}

/**
 * Restore only an explicitly saved, recent same-purpose draft.
 * Never parse or return contact, attachment bytes, account details or GPS.
 */
export function readJourneyDraft(raw:string | null, purpose:'report'|'feedback',
  validLgas:readonly string[], now=Date.now()):SavedJourneyDraft | null {
  if (!raw || raw.length > 6200) return null;
  try {
    const o=JSON.parse(raw) as Record<string,unknown>;
    if (!o || typeof o !== 'object' || Array.isArray(o) || o.purpose !== purpose ||
        !['Text','Photo','Video','Audio'].includes(String(o.method)) ||
        !REPORT_CATEGORIES.includes(o.category as ReportCategory) ||
        typeof o.description !== 'string' || o.description.length < 20 || o.description.length > 4000 ||
        typeof o.lgaId !== 'string' || !validLgas.includes(o.lgaId) ||
        typeof o.community !== 'string' || o.community.length > 180 ||
        typeof o.savedAt !== 'string') return null;
    const when=Date.parse(o.savedAt);
    if (!Number.isFinite(when) || when > now+60000 || now-when > 24*60*60*1000) return null;
    return {
      purpose, method:o.method as EvidenceMethod, category:o.category as ReportCategory,
      description:o.description, lgaId:o.lgaId, community:o.community, savedAt:o.savedAt,
    };
  } catch { return null; }
}
