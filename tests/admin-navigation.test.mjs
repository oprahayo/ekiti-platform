import test from 'node:test';
import assert from 'node:assert/strict';
import { adminViewUrl, isCaseView, readAdminView } from '../admin/src/navigation.ts';

test('only whitelisted admin views are accepted and unknown URLs fail to Cases', () => {
  for (const view of ['all','inbox','assigned','awaiting','escalated','resolved','moderation','routing','analytics']) {
    assert.equal(readAdminView('?view='+view),view);
  }
  assert.equal(readAdminView('?view=private-token'),'all');
  assert.equal(readAdminView('?view=ALL'),'all');
  assert.equal(readAdminView(''),'all');
});
test('only harmless section state enters URL and case filters are recognized', () => {
  assert.equal(adminViewUrl('moderation','/admin/'),'/admin/?view=moderation');
  assert.equal(adminViewUrl('awaiting','/'), '/?view=awaiting');
  assert.equal(isCaseView('inbox'),true);
  assert.equal(isCaseView('routing'),false);
  assert.throws(() => adminViewUrl('invalid','/'));
});
