import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startConversation, submitLine, chooseArea, revise, markDownloaded,
  draftAsText, findArea,
} from '../src/app/report-conversation.ts';
import { detectIntent } from '../src/app/intents.ts';

const areas = [
  { id: 'ado-ekiti', name: 'Ado-Ekiti' },
  { id: 'ido-osi', name: 'Ido/Osi' },
  { id: 'efon', name: 'Efon' },
  { id: 'ikere', name: 'Ikere' },
];
const description = 'The bridge near the local market is damaged and needs inspection.';

test('agent asks sequential questions, respects corrections, and prepares a local-only draft', () => {
  const initial = startConversation();
  assert.equal(initial.stage, 'describe');
  const short = submitLine(initial, 'bad road', areas);
  assert.equal(short.stage, 'describe');
  assert.match(short.lines.at(-1).text, /more detail/);

  const described = submitLine(short, description, areas);
  assert.equal(described.stage, 'location');
  assert.equal(described.draft.kind, 'Issue');
  assert.equal(described.draft.description, description);
  assert.match(described.lines.at(-1).text, /local government area/);

  const unknown = submitLine(described, 'unknown village', areas);
  assert.equal(unknown.stage, 'location');
  assert.equal(unknown.draft.lgaId, '');
  assert.match(unknown.lines.at(-1).text, /could not confidently match/);

  const chosen = submitLine(unknown, 'The incident happened in Ido-Ekiti', areas);
  assert.equal(chosen.stage, 'details');
  assert.equal(chosen.draft.lgaId, 'ido-osi');
  assert.equal(chosen.lines.at(-2).text, 'The incident happened in Ido-Ekiti');
  assert.equal(chosen.lines.at(-1).role, 'assistant');

  const reviewed = submitLine(chosen, 'skip', areas);
  assert.equal(reviewed.stage, 'review');
  assert.equal(reviewed.draft.detail, '');

  const changed = revise(reviewed, 'location');
  assert.equal(changed.stage, 'location');
  const moved = chooseArea(changed, areas[2]);
  const changedReview = submitLine(moved, 'Near the river after the storm.', areas);
  assert.equal(changedReview.stage, 'review');
  assert.equal(changedReview.draft.lgaId, 'efon');
  const output = draftAsText(changedReview.draft);
  assert.match(output, /PRIVATE REPORT DRAFT/);
  assert.match(output, /Efon/);
  assert.match(output, /Near the river/);
  assert.doesNotMatch(output, /DEMO-EKP-|tracking token|submitted to Ekiti State/);
  const downloaded = markDownloaded(changedReview);
  assert.equal(downloaded.stage, 'saved');
  assert.match(downloaded.lines.at(-1).text, /Nothing was submitted/);
});

test('location matching does not guess from only the word Ekiti or unclear names', () => {
  assert.equal(findArea('Ekiti', areas), undefined);
  assert.equal(findArea('Ido-Ekiti', areas)?.id, 'ido-osi');
  assert.equal(findArea('Efon', areas)?.name, 'Efon');
});

test('natural language intents stay on-device when they could contain private report text', () => {
  assert.deepEqual(detectIntent('I want to report a damaged bridge in Ido-Ekiti'),
    { kind: 'report' });
  assert.deepEqual(detectIntent('Track my report status'),
    { kind: 'track' });
  assert.deepEqual(detectIntent('Find hotels near Aribayo Ido-Ekiti'),
    { kind: 'directory', category: 'Hotels', lgaId: 'ido-osi' });
  assert.deepEqual(detectIntent('Show me a clinic in Ikole'),
    { kind: 'directory', category: 'Health', lgaId: 'ikole' });
  assert.deepEqual(detectIntent('Who is the governor of Ekiti?'), { kind: 'knowledge' });
  assert.deepEqual(detectIntent('What is the health budget?'), { kind: 'knowledge' });
});

test('report classification is draft-only and citizen-editable', () => {
  const commendation = submitLine(startConversation(),
    'Thank you for repairing the community water supply.', areas);
  assert.equal(commendation.draft.kind, 'Commendation');
  const complaint = submitLine(startConversation(),
    'I want to make a complaint about unfair treatment at the office.', areas);
  assert.equal(complaint.draft.kind, 'Complaint');
});
