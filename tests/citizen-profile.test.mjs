import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readSavedPlaces, writeSavedPlaces, readReviewDrafts, saveReviewDraft,
  deleteReviewDraft, SAVED_KEY, DRAFT_REVIEWS_KEY,
} from '../src/app/citizen-local.ts';

const uuid = '12345678-9abc-4def-8aaa-123456789abc';

function fakeStorage() {
  const memory = new Map();
  return {
    getItem(key) { return memory.get(key) ?? null; },
    setItem(key, value) { memory.set(key, value); },
    removeItem(key) { memory.delete(key); },
  };
}

test('guest bookmarks accept only vetted UUID-shaped identifiers, never demo IDs', () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(writeSavedPlaces([uuid, 'demo-hotel-1', 'javascript:alert(1)']), true);
  assert.deepEqual(readSavedPlaces(), [uuid]);
  localStorage.setItem(SAVED_KEY, JSON.stringify([uuid, uuid, false, 'bad']));
  assert.deepEqual(readSavedPlaces(), [uuid]);
});

test('ratings remain local drafts and never accept unbounded or invalid data', () => {
  globalThis.localStorage = fakeStorage();
  assert.equal(saveReviewDraft(uuid, 5, 'Great work'), true);
  assert.equal(saveReviewDraft('demo-hotel-1', 5, 'fake'), false);
  assert.equal(saveReviewDraft(uuid, 0, 'bad'), false);
  assert.equal(saveReviewDraft(uuid, 6, 'bad'), false);
  assert.equal(saveReviewDraft(uuid, 4, 'x'.repeat(1001)), false);
  const item = readReviewDrafts()[uuid];
  assert.equal(item.stars, 5);
  assert.equal(item.text, 'Great work');
  assert.match(item.updatedAt, /^\d{4}-\d{2}-\d{2}/);
  assert.equal(deleteReviewDraft(uuid), true);
  assert.deepEqual(readReviewDrafts(), {});
});

test('corrupted or inaccessible storage fails closed without collecting private data', () => {
  globalThis.localStorage = fakeStorage();
  localStorage.setItem(DRAFT_REVIEWS_KEY, '{bad');
  assert.deepEqual(readReviewDrafts(), {});
  localStorage.setItem(SAVED_KEY, '{bad');
  assert.deepEqual(readSavedPlaces(), []);
});
