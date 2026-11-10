import type { Category } from './fixtures.ts';

export type CivicIntent =
  | { kind: 'report' }
  | { kind: 'track' }
  | { kind: 'directory'; category: Category; lgaId: string }
  | { kind: 'knowledge' };

/**
 * Routing a citizen to an appropriate on-device workflow is deliberately
 * conservative. Never send a potential private report body to /api/ask.
 * Unclassified questions use source-backed knowledge responses as before.
 */
export function detectIntent(text: string): CivicIntent {
  const q = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(track (my |a |the )?(report|case|complaint)|check (my |a |the )?(case|report) (status|reference)|report status|case reference|status of my (report|complaint)|follow up (my |on )?(report|case))\b/.test(q)) {
    return { kind: 'track' };
  }
  if (/\b(i (want|need|would like) to report|report a (problem|road|issue|broken|complaint)|submit (a )?(report|complaint|feedback)|file (a )?(report|complaint)|make a complaint|bad road|broken bridge|damaged road)\b/.test(q) ||
    /\b(mo fe royin|fe fi esun|fi esun sun)\b/.test(q)) {
    return { kind: 'report' };
  }
  const seeking = /\b(find|looking for|where (can|are|is)|show me|nearby|near me|around|nearest|list|search|wa|nibo|hotels? in|hotels? around)\b/.test(q);
  if (seeking) {
    let category: Category | undefined;
    if (/\b(hotels?|guesthouse|lodging|accommodation|resort|hotẹẹli)\b/.test(q)) category = 'Hotels';
    else if (/\b(schools?|college|university)\b/.test(q)) category = 'Schools';
    else if (/\b(clinics?|hospitals?|pharmac(y|ies)|health cent(re|er))\b/.test(q)) category = 'Health';
    else if (/\b(offices?|ministries|mda)\b/.test(q)) category = 'Offices';
    if (category) {
      const lgaId = /\b(ido[\s/-]*(ekiti|osi)|aribayo)\b/.test(q) ? 'ido-osi'
        : /\bado[\s-]*ekiti\b/.test(q) ? 'ado-ekiti'
        : /\bikere\b/.test(q) ? 'ikere'
        : /\bikole\b/.test(q) ? 'ikole'
        : /\befon\b/.test(q) ? 'efon' : '';
      return { kind: 'directory', category, lgaId };
    }
  }
  return { kind: 'knowledge' };
}
