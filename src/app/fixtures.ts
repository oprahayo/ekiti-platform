/** All entries below are illustrative UI fixtures, NOT a verified directory. */
export type Category = 'All' | 'Health' | 'Schools' | 'Offices' | 'Hotels';

export const lgas = [
  { id: 'ado-ekiti', name: 'Ado-Ekiti' },
  { id: 'efon', name: 'Efon' },
  { id: 'ekiti-east', name: 'Ekiti East' },
  { id: 'ekiti-south-west', name: 'Ekiti South-West' },
  { id: 'ekiti-west', name: 'Ekiti West' },
  { id: 'emure', name: 'Emure' },
  { id: 'gbonyin', name: 'Gbonyin' },
  { id: 'ido-osi', name: 'Ido/Osi' },
  { id: 'ijero', name: 'Ijero' },
  { id: 'ikere', name: 'Ikere' },
  { id: 'ikole', name: 'Ikole' },
  { id: 'ilejemeje', name: 'Ilejemeje' },
  { id: 'irepodun-ifelodun', name: 'Irepodun/Ifelodun' },
  { id: 'ise-orun', name: 'Ise/Orun' },
  { id: 'moba', name: 'Moba' },
  { id: 'oye', name: 'Oye' },
] as const;

export const categories: Category[] = ['All', 'Health', 'Schools', 'Offices', 'Hotels'];

export interface DemoPlace {
  id: string;
  name: string;
  category: Exclude<Category, 'All'>;
  lgaId: string;
  description: string;
}

export const demoPlaces: DemoPlace[] = [
  { id: 'demo-health-1', name: 'Sample community health center', category: 'Health', lgaId: 'ado-ekiti', description: 'Illustrative health listing, not a verified clinic.' },
  { id: 'demo-school-1', name: 'Example neighborhood school', category: 'Schools', lgaId: 'ikere', description: 'Illustrative school listing, not a verified institution.' },
  { id: 'demo-office-1', name: 'Demo public information office', category: 'Offices', lgaId: 'ado-ekiti', description: 'Illustrative office listing, not an official government contact.' },
  { id: 'demo-hotel-1', name: 'Sample guesthouse', category: 'Hotels', lgaId: 'efon', description: 'Illustrative hotel listing, not a verified business.' },
  { id: 'demo-health-2', name: 'Example local clinic', category: 'Health', lgaId: 'ikole', description: 'Illustrative healthcare listing, not a verified clinic.' },
];

export const voiceExamples = [
  'Where is the nearest clinic?',
  'Report a broken streetlight',
  'What is the Ministry of Works phone number?',
  'Find hotels in Ikogosi',
] as const;

/** These are demo answer fragments, not AI-generated claims or verified responses. */
export function demoAnswer(question: string): { text: string; source: string; confidence: string } {
  const q = question.toLocaleLowerCase();
  if (q.includes('lga') || q.includes('local government')) {
    return {
      text: 'Ekiti State has 16 local government areas in the verified geographic reference directory. For individual areas, open Explore.',
      source: 'Project geographic directory · staging data',
      confidence: 'LGA names verified; ward boundaries not verified',
    };
  }
  return {
    text: 'There is not enough verified information connected to answer this question yet. You can browse the illustrative Explore directory or prepare a private report draft.',
    source: 'No source available · demo',
    confidence: 'This is a demo response, not a live AI answer',
  };
}

export interface DemoEvent {
  title: string;
  evidence: string;
  state: 'recorded' | 'claimed' | 'waiting';
  detail: string;
}

/** Sample presentation only. Neither the IDs nor the events refer to real reports. */
export const demoTimeline: DemoEvent[] = [
  { title: 'Submitted', evidence: 'Demo event · not stored', state: 'recorded', detail: 'An illustrative receipt was created for UI testing only.' },
  { title: 'Routed', evidence: 'Demo rule-based suggestion', state: 'claimed', detail: 'An agency destination would require verification.' },
  { title: 'Sent', evidence: 'No dispatch record', state: 'waiting', detail: 'This demo has not contacted an organization.' },
  { title: 'Acknowledged', evidence: 'No acknowledgment', state: 'waiting', detail: 'No official acknowledgment has occurred.' },
  { title: 'Responded', evidence: 'No response', state: 'waiting', detail: 'No reply has been recorded.' },
  { title: 'Resolved — claimed', evidence: 'Not independently verified', state: 'claimed', detail: 'Sample status only; no claim of actual resolution.' },
];

export const demoMetrics = [
  { label: 'Reports filed', value: 120, unit: '', percent: null, negative: false },
  { label: 'Acknowledged within 14 days', value: 58, unit: '%', percent: 58, negative: false },
  { label: 'No response after 30 days', value: 22, unit: '%', percent: 22, negative: true },
  { label: 'Cases with recorded follow-up', value: 39, unit: '%', percent: 39, negative: false },
] as const;
