import test from 'node:test';
import assert from 'node:assert/strict';
import {EKITI_EMERGENCY_CONTACT} from '../src/app/ekiti-emergency-contacts.ts';

test('Ekiti emergency line is a sourced, dated telephone number',()=>{
  assert.equal(EKITI_EMERGENCY_CONTACT.number,'112');
  assert.match(EKITI_EMERGENCY_CONTACT.source,/^https:\/\/ekitistate\.gov\.ng\/help\/$/);
  assert.match(EKITI_EMERGENCY_CONTACT.secondarySource,/^https:\/\/www\.ncc\.gov\.ng\//);
  assert.match(EKITI_EMERGENCY_CONTACT.reviewedOn,/^20\d{2}-\d{2}-\d{2}$/);
});
