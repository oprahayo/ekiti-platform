/**
 * Publicly sourced discovery examples, NOT civic.public_places rows.
 *
 * These links were checked against the institution/operator's public website
 * on 2026-11-12. Website confirmation is not a completed Ekiti Civic
 * independent review, geocoding, ownership claim or operational endorsement.
 * Do not expose them as reviewed API results, nearby pins or verified listings.
 */
export type SourcedExampleCategory = 'Health' | 'Schools' | 'Hotels';
export interface SourcedPlaceExample {
  id: string;
  name: string;
  category: SourcedExampleCategory;
  locality: string;
  lgaId: string;
  lgaName: string;
  description: string;
  sourceUrl: string;
  sourceLabel: string;
  checkedOn: string;
  aliases: readonly string[];
  reviewStatus: 'source-confirmed-only';
}

export const sourcedPlaceExamples: readonly SourcedPlaceExample[] = [
  {
    id: 'fethi-ido-ekiti',
    name: 'Federal Teaching Hospital, Ido-Ekiti',
    category: 'Health',
    locality: 'Ido-Ekiti',
    lgaId: 'ido-osi',
    lgaName: 'Ido/Osi',
    description: 'Federal teaching hospital offering specialist hospital services in Ido-Ekiti.',
    sourceUrl: 'https://fethi.gov.ng/',
    sourceLabel: 'Hospital website',
    checkedOn: '2026-11-12',
    aliases: ['FETHI', 'teaching hospital', 'hospital hospitals clinic clinics health healthcare medical'],
    reviewStatus: 'source-confirmed-only',
  },
  {
    id: 'eksuth-ado-ekiti',
    name: 'Ekiti State University Teaching Hospital',
    category: 'Health',
    locality: 'Ado-Ekiti',
    lgaId: 'ado-ekiti',
    lgaName: 'Ado-Ekiti',
    description: 'Public teaching hospital providing specialist healthcare in Ado-Ekiti.',
    sourceUrl: 'https://www.eksuth.org.ng/',
    sourceLabel: 'Hospital website',
    checkedOn: '2026-11-12',
    aliases: ['EKSUTH', 'teaching hospital', 'hospital hospitals clinic clinics health healthcare medical'],
    reviewStatus: 'source-confirmed-only',
  },
  {
    id: 'eksu-ado-ekiti',
    name: 'Ekiti State University',
    category: 'Schools',
    locality: 'Ado-Ekiti',
    lgaId: 'ado-ekiti',
    lgaName: 'Ado-Ekiti',
    description: 'University offering higher education programmes and public admission information.',
    sourceUrl: 'https://eksu.edu.ng/',
    sourceLabel: 'University website',
    checkedOn: '2026-11-12',
    aliases: ['EKSU', 'university universities school schools college colleges education campus'],
    reviewStatus: 'source-confirmed-only',
  },
  {
    id: 'fuoye-oye-ekiti',
    name: 'Federal University Oye-Ekiti',
    category: 'Schools',
    locality: 'Oye-Ekiti',
    lgaId: 'oye',
    lgaName: 'Oye',
    description: 'Federal university with its public website based in Oye-Ekiti.',
    sourceUrl: 'https://fuoye.edu.ng/',
    sourceLabel: 'University website',
    checkedOn: '2026-11-12',
    aliases: ['FUOYE', 'university universities school schools college colleges education campus'],
    reviewStatus: 'source-confirmed-only',
  },
  {
    id: 'fpa-ado-ekiti',
    name: 'The Federal Polytechnic, Ado-Ekiti',
    category: 'Schools',
    locality: 'Ado-Ekiti',
    lgaId: 'ado-ekiti',
    lgaName: 'Ado-Ekiti',
    description: 'Federal polytechnic offering National Diploma and Higher National Diploma programmes.',
    sourceUrl: 'https://fedpolyado.edu.ng/',
    sourceLabel: 'Polytechnic website',
    checkedOn: '2026-11-12',
    aliases: ['FPA', 'federal poly ado', 'polytechnic school schools college colleges education campus'],
    reviewStatus: 'source-confirmed-only',
  },
  {
    id: 'ikogosi-warm-springs',
    name: 'Ikogosi Warm Springs Resort',
    category: 'Hotels',
    locality: 'Ikogosi',
    lgaId: 'ekiti-west',
    lgaName: 'Ekiti West',
    description: 'Resort with accommodation and visits to the warm and cold springs in Ikogosi.',
    sourceUrl: 'https://www.ikogosiresort.com/',
    sourceLabel: 'Resort website',
    checkedOn: '2026-11-12',
    aliases: ['hotel hotels resort resorts accommodation lodging tourism attraction springs'],
    reviewStatus: 'source-confirmed-only',
  },
];

const omit = new Set([
  'in', 'at', 'the', 'a', 'an', 'for', 'of', 'and', 'or', 'on',
  'near', 'nearby', 'around', 'within', 'from', 'to',
  'where', 'what', 'is', 'are', 'find', 'looking', 'show', 'me',
  'please', 'list', 'search', 'ekiti', 'state', 'nigeria',
]);

const words = (text: string): string[] =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().match(/[a-z0-9]+/g) || [];

/** A local-only matcher; never substitutes for independently approved listings. */
export function findSourcedExamples(
  query: string,
  filters: {category?: SourcedExampleCategory | null; lgaId?: string | null} = {},
): SourcedPlaceExample[] {
  const trimmed = query.trim();
  if (trimmed.length > 100 || /@/.test(trimmed) ||
    /(?:\+?\d[\d\s()-]{6,}\d)/.test(trimmed) ||
    /\b(report|complaint|incident|emergency|my case|track my)\b/i.test(trimmed)) return [];

  const terms = words(trimmed).filter(word => !omit.has(word));
  if (trimmed && terms.length === 0) return [];

  return sourcedPlaceExamples.filter(place => {
    if (filters.category && place.category !== filters.category) return false;
    if (filters.lgaId && place.lgaId !== filters.lgaId) return false;
    if (!trimmed) return true;

    const index = words([
      place.name, place.category, place.locality, place.lgaName,
      place.description, ...place.aliases,
    ].join(' '));
    return terms.every(term => index.some(token =>
      token === term || (term.length >= 4 && token.startsWith(term))
    ));
  });
}
