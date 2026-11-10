/** Deterministic conversation flow. No AI model, reports API or server storage. */
export type ReportKind = 'Issue' | 'Complaint' | 'Commendation';
export type ReportStage = 'describe' | 'location' | 'details' | 'review' | 'saved';
export interface AreaName { id: string; name: string; }
export interface Draft {
  kind: ReportKind;
  description: string;
  lgaId: string;
  lgaName: string;
  detail: string;
}
export interface Line { id: number; role: 'assistant' | 'user'; text: string; }
export interface Conversation {
  stage: ReportStage;
  draft: Draft;
  lines: Line[];
}
export const DRAFT_STORAGE_KEY = 'ekiti-conversation-draft-v1';
export const OLD_DRAFT_STORAGE_KEY = 'ekiti-report-preview-v2';

export const emptyDraft: Draft = { kind: 'Issue', description: '', lgaId: '', lgaName: '', detail: '' };
export function startConversation(): Conversation {
  return {
    stage: 'describe',
    draft: { ...emptyDraft },
    lines: [{
      id: 1, role: 'assistant',
      text: 'Tell me what happened in your community. I will help you prepare a private draft, not submit a report.',
    }],
  };
}

function add(state: Conversation, role: Line['role'], text: string): Conversation {
  return { ...state, lines: [...state.lines, { id: state.lines.length + 1, role, text }] };
}
function assistant(state: Conversation, text: string): Conversation { return add(state, 'assistant', text); }

function plain(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function kindFor(text: string): ReportKind {
  const q = plain(text);
  if (/\b(commend|thank|appreciat|prais|good work|well done|dupe|ope)\w*\b/.test(q)) return 'Commendation';
  if (/\b(complaint|complain|neglect|unfair|harass)\w*\b/.test(q)) return 'Complaint';
  return 'Issue';
}
export function findArea(text: string, areas: readonly AreaName[]): AreaName | undefined {
  const cleaned = plain(text);
  if (!cleaned) return undefined;
  const aliases: Record<string, string> = {
    'ido ekiti': 'ido-osi',
    'ido osi': 'ido-osi',
    'ado': 'ado-ekiti',
  };
  if (aliases[cleaned]) return areas.find(area => area.id === aliases[cleaned]);
  const found = areas.filter(area => {
    const name = plain(area.name);
    const id = plain(area.id);
    return cleaned === name || cleaned === id ||
      new RegExp('(?:^| )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$| )').test(cleaned);
  });
  return found.length === 1 ? found[0] : undefined;
}

export function submitLine(state: Conversation, raw: string, areas: readonly AreaName[]): Conversation {
  const text = raw.trim().slice(0, 4000);
  if (!text || state.stage === 'review' || state.stage === 'saved') return state;
  const next = add(state, 'user', text);
  if (state.stage === 'describe') {
    if (text.length < 20) return assistant(next, 'Could you add a little more detail? About 20 characters will help me prepare a useful draft.');
    return assistant({
      ...next, stage: 'location',
      draft: { ...next.draft, description: text, kind: kindFor(text) },
    }, 'Thank you. Which local government area did this happen in? You can type its name or choose it from the list.');
  }
  if (state.stage === 'location') {
    const area = findArea(text, areas);
    if (!area) return assistant(next, 'I could not confidently match that LGA. Please choose one from the list so I do not guess your location.');
    return chooseArea(next, area);
  }
  if (state.stage === 'details') {
    const skip = /^(no|none|skip|nothing|no more|ko si|kosi|rara)$/i.test(plain(text));
    return assistant({
      ...next, stage: 'review',
      draft: { ...next.draft, detail: skip ? '' : text },
    }, 'Here is what I understood. Check the summary and make corrections before downloading your private draft.');
  }
  return next;
}

export function chooseArea(state: Conversation, area: AreaName): Conversation {
  if (state.stage !== 'location') return state;
  const withUser = add(state, 'user', area.name);
  return assistant({
    ...withUser, stage: 'details',
    draft: { ...withUser.draft, lgaId: area.id, lgaName: area.name },
  }, 'Understood — ' + area.name + '. Is there anything else that would help explain the issue, such as a landmark, date, or impact? Say “skip” if not.');
}

export function revise(state: Conversation, field: 'description' | 'location' | 'details'): Conversation {
  if (state.stage !== 'review' && state.stage !== 'saved') return state;
  const stage = field === 'description' ? 'describe' : field === 'location' ? 'location' : 'details';
  const question = field === 'description'
    ? 'Please tell me the corrected description.'
    : field === 'location'
      ? 'Which local government area should I use instead?'
      : 'What additional details would you like to include? Say “skip” to clear them.';
  return assistant({ ...state, stage }, question);
}

export function markDownloaded(state: Conversation): Conversation {
  if (state.stage !== 'review') return state;
  return assistant({ ...state, stage: 'saved' },
    'Your file was prepared for download on this device. Nothing was submitted or assigned a tracking number. A real reference will only exist once online intake is available.');
}

export function draftAsText(draft: Draft): string {
  return [
    'Ekiti Civic — PRIVATE REPORT DRAFT',
    'Not submitted to any agency or platform',
    '',
    'Type: ' + draft.kind,
    'LGA: ' + draft.lgaName,
    'What happened:',
    draft.description,
    '',
    'Additional details:',
    draft.detail || 'None provided',
    '',
    'This is a personal text file, not an official acknowledgment or tracking receipt.',
  ].join('\n');
}

/** Migration is read-only. Old drafts remain until the citizen explicitly clears them. */
export function readConversation(): Conversation {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const candidate: unknown = JSON.parse(raw);
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        const state = candidate as Partial<Conversation>;
        if (['describe', 'location', 'details', 'review', 'saved'].includes(state.stage || '') &&
            state.draft && typeof state.draft.description === 'string' &&
            typeof state.draft.lgaId === 'string' &&
            Array.isArray(state.lines) && state.lines.length <= 40 &&
            state.lines.every(line => typeof line.text === 'string' && typeof line.id === 'number' && (line.role === 'user' || line.role === 'assistant'))) {
          return state as Conversation;
        }
      }
    }
    const previous = localStorage.getItem(OLD_DRAFT_STORAGE_KEY);
    if (previous) {
      const data = JSON.parse(previous) as Partial<Draft>;
      if (typeof data.description === 'string' && data.description.trim().length >= 20) {
        const initial = startConversation();
        const restored = submitLine(initial, data.description, []);
        return assistant(restored, 'I found an older draft on this device. Please confirm the LGA to continue.');
      }
    }
  } catch { /* Private browsing or corrupted draft: begin again. */ }
  return startConversation();
}
