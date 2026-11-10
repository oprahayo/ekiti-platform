/**
 * Curated, source-linked facts checked on 10 November 2026.
 * These are deliberately short extracts, not scraped article reproduction.
 * Sources describe their own claims and are NOT endorsements by Ekiti Civic.
 */
export type Language = 'en' | 'yo';
export type Topic = 'capital' | 'history' | 'governor' | 'lga' | 'news' | 'budget' | 'ministries' | 'health' | 'education' | 'tourism' | 'government' | 'unknown';

export interface AskSource {
  title: string;
  url: string;
  published?: string;
  publisher: string;
}
export interface AskResult {
  answer: string;
  language: Language;
  topic: Topic;
  sources: AskSource[];
  checkedAt: string;
  confidence: 'source-backed' | 'limited' | 'not-verified';
  limitation: string;
}

const official = 'Ekiti State Government';
export const KNOWLEDGE: Record<Exclude<Topic, 'news' | 'unknown'>, { en: string; yo: string; sources: AskSource[] }> = {
  capital: {
    en: 'Ado-Ekiti is the capital of Ekiti State. The state government’s About Ekiti page confirms that Ekiti was created on 1 October 1996 with Ado-Ekiti as its capital.',
    yo: 'Ado-Ekiti ni olú ìlú Ìpínlẹ̀ Èkìtì. A dá Ìpínlẹ̀ Èkìtì sílẹ̀ ní ọjọ́ kìíní oṣù kẹwàá ọdún 1996.',
    sources: [{ title: 'About Ekiti — state capital and creation', url: 'https://www.ekitistate.gov.ng/about-ekiti', publisher: official }],
  },
  history: {
    en: 'Ekiti State was created on 1 October 1996 from the former Ondo State. Its capital is Ado-Ekiti. The official state history and budget publications describe its creation and administrative geography.',
    yo: 'A dá Ìpínlẹ̀ Èkìtì sílẹ̀ ní ọjọ́ kìíní oṣù kẹwàá ọdún 1996 láti ara Ìpínlẹ̀ Ondo tẹ́lẹ̀. Ado-Ekiti ni olú ìlú rẹ̀.',
    sources: [{ title: 'About Ekiti — official overview', url: 'https://www.ekitistate.gov.ng/about-ekiti', publisher: official }],
  },
  governor: {
    en: 'As documented by Ekiti State Government releases dated 16 October 2026, Biodun Oyebanji was inaugurated for a second term as Governor of Ekiti State. For a later change in office, check the current official government site.',
    yo: 'Gẹ́gẹ́ bí ìròyìn ìjọba tí wọ́n tẹ̀ jáde ní ọjọ́ 16 oṣù kẹwàá ọdún 2026, Biodun Oyebanji bẹ̀rẹ̀ sáà kejì rẹ̀ gẹ́gẹ́ bí Gómìnà Èkìtì. Ṣàyẹ̀wò ojúlé ìjọba fún ìyípadà tuntun.',
    sources: [{ title: 'Gov. Oyebanji’s second-term inauguration — 16 October 2026', url: 'https://www.ekitistate.gov.ng/archives/33870', published: '2026-10-16', publisher: official }],
  },
  lga: {
    en: 'Ekiti State has 16 local government areas. The project’s verified geographic directory also records 177 electoral ward names, but ward polygons are not yet independently verified. You can browse the areas in Explore.',
    yo: 'Ìpínlẹ̀ Èkìtì ní ìjọba ìbílẹ̀ mẹ́rìndínlógún (16). Àtòjọ ilẹ̀ wa tún ní orúkọ wọdù ìdìbò 177, ṣùgbọ́n a kò tíì fìdí ààlà àwọn wọdù náà múlẹ̀.',
    sources: [{ title: 'Ekiti State — government overview and local governments', url: 'https://www.ekitistate.gov.ng/', publisher: official }],
  },
  budget: {
    en: 'The Ekiti State Government publishes its annual budgets, quarterly implementation reports and citizens’ budgets in both English and Yoruba. The official Finance & Budget page lists the 2026 documents. Open the source for the actual amounts rather than relying on a summary.',
    yo: 'Ìjọba Ìpínlẹ̀ Èkìtì ń tẹ àwọn ìwé ìṣúná, àkọsílẹ̀ ìmúṣẹ, àti ìwé ìṣúná fún aráàlú jáde ní Gẹ̀ẹ́sì àti Yorùbá. O lè ka àwọn ìwé ọdún 2026 lórí ojúlé ìjọba.',
    sources: [{ title: 'Ekiti Finance & Budget — 2026 publications', url: 'https://www.ekitistate.gov.ng/finance-budget', publisher: official }],
  },
  ministries: {
    en: 'Ekiti State maintains an official directory of ministries, departments and agencies, with contact addresses and links. The page includes the Ministry of Works (mow@ekitistate.gov.ng). Check the directory for the latest details; I cannot verify a phone number from this source.',
    yo: 'Àtòjọ àwọn ilé-iṣẹ́ ìjọba Èkìtì wà lórí ojúlé wọn. Ó ní ìsọfúnni ìkànnì àwọn ilé-iṣẹ́, pẹ̀lú ti Ministry of Works: mow@ekitistate.gov.ng. Ṣàyẹ̀wò ojúlé náà fún ìsọfúnni tuntun.',
    sources: [{ title: 'Ekiti MDAs Directory', url: 'https://www.ekitistate.gov.ng/mdas-directory', publisher: official }],
  },
  health: {
    en: 'The official Ekiti MDAs directory lists the Ministry of Health & Human Services (mhhs@ekitistate.gov.ng). I cannot verify which clinic is nearest to you or its current opening hours from this directory. Use a verified facility listing before traveling.',
    yo: 'Àtòjọ ìjọba Èkìtì fi Ministry of Health & Human Services hàn: mhhs@ekitistate.gov.ng. Mi ò lè fìdí ilé ìwòsàn tó sún mọ́ ọ tàbí àkókò ìṣíṣẹ́ rẹ̀ múlẹ̀ níbí.',
    sources: [{ title: 'Ekiti MDAs Directory — health services', url: 'https://www.ekitistate.gov.ng/mdas-directory', publisher: official }],
  },
  education: {
    en: 'The Ekiti MDAs directory lists the Ministry of Education (mest@ekitistate.gov.ng). Nigeria’s federal education management system also publishes school and education data. Individual school services still need to be checked against their own official listings.',
    yo: 'Àtòjọ Èkìtì fi Ministry of Education hàn: mest@ekitistate.gov.ng. Ètò ìṣàkóso ẹ̀kọ́ orílẹ̀-èdè Nàìjíríà tún ní àkọsílẹ̀ nípa àwọn ilé-ẹ̀kọ́. Ṣàyẹ̀wò ẹ̀rí ilé-ẹ̀kọ́ kọ̀ọ̀kan.',
    sources: [
      { title: 'Ekiti MDAs Directory — Ministry of Education', url: 'https://www.ekitistate.gov.ng/mdas-directory', publisher: official },
      { title: 'Nigeria Education Management Information System', url: 'https://emis.education.gov.ng/', publisher: 'Federal Ministry of Education, Nigeria' },
    ],
  },
  tourism: {
    en: 'Ekiti has an official arts, culture and tourism information section and a Bureau of Tourism Development listed in the state directory (bot@ekitistate.gov.ng). I do not yet have a verified, current directory of clubs, hotels, opening hours or events. Explore currently contains illustrative listings only.',
    yo: 'Ìjọba Èkìtì ní ẹ̀ka àṣà, iṣẹ́ ọnà àti ìrìn-àjò. Àtòjọ wọn fi Bureau of Tourism Development hàn: bot@ekitistate.gov.ng. Mi ò tíì ní àtòjọ ilé ìgbádùn, hótẹ́lì, tàbí ìṣẹ̀lẹ̀ tuntun tí a fìdí rẹ̀ múlẹ̀.',
    sources: [
      { title: 'Ekiti State — arts, culture and tourism', url: 'https://www.ekitistate.gov.ng/', publisher: official },
      { title: 'Ekiti MDAs Directory — tourism', url: 'https://www.ekitistate.gov.ng/mdas-directory', publisher: official },
    ],
  },
  government: {
    en: 'The official Ekiti State Government website publishes information about the state, administration, services, agencies, budgets and press releases. This is a government source, not an independent verification of every statement it publishes.',
    yo: 'Ojúlé ìjọba Ìpínlẹ̀ Èkìtì ní ìsọfúnni nípa ìjọba, àwọn ilé-iṣẹ́, ìṣúná, iṣẹ́ aráàlú, àti ìròyìn. Ìsọfúnni ìjọba kì í ṣe ẹ̀rí àìníṣòro fún gbogbo ohun tí a tẹ̀jáde.',
    sources: [{ title: 'Official Ekiti State Government website', url: 'https://www.ekitistate.gov.ng/', publisher: official }],
  },
};

export const NEWS_FALLBACK: AskSource = {
  title: 'Gov. Oyebanji Appoints 10 Special Advisers',
  published: '2026-11-03',
  url: 'https://www.ekitistate.gov.ng/archives/category/press-releases',
  publisher: official,
};

export const NEWS_FEED = 'https://www.ekitistate.gov.ng/feed/';
export const NEWS_CATEGORY_FEED = 'https://www.ekitistate.gov.ng/archives/category/press-releases/feed/';

export function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function topicFor(question: string): Topic {
  const q = normalize(question);
  const matches: [Topic, RegExp][] = [
    ['capital', /\\b(capital|olu ilu|olu- ilu|headquarters of ekiti)\\b/],
    ['history', /\\b(history|created|creation|founded|origin|itan|idasile)\\b/],
    ['governor', /\\b(governor|governorship|oyebanji|gomina|gomina ekiti)\\b/],
    ['lga', /\b(lga|lgas|local government|wards?|ijoba ibile|ijoba ibile melo|meloo ni|melo ni|iye ijoba)\b/],
    ['news', /\b(news|latest|today|happening|happen|recent|updates?|iroyin|kini n sele|ki lo n sele|loni|lowolowo)\b/],
    ['budget', /\b(budget|finance|expenditure|appropriation|revenue|isuna|owo ijoba)\b/],
    ['health', /\b(clinic|hospital|health|medical|doctor|pharmacy|iwosan|ilera|dokita)\b/],
    ['education', /\b(school|college|education|university|teacher|ile eko|eko|ile iwe)\b/],
    ['tourism', /\b(club|nightlife|night club|hotel|resort|ikogosi|tourism|tourist|events?|where to go|ibudo|arinajo|irin ajo|igbadun)\b/],
    ['ministries', /\b(works|ministry|ministers?|mda|office|agency|government contact|telefon|number|ile ise)\b/],
    ['government', /\b(ekiti|state government|government|nigeria|ipinle)\b/],
  ];
  for (const [topic, pattern] of matches) if (pattern.test(q)) return topic;
  return 'unknown';
}
