import test from 'node:test';
import assert from 'node:assert/strict';
import {sourcedPlaceExamples,findSourcedExamples} from '../src/app/sourced-examples.ts';

test('source catalog contains distinct public sources with no reviewed status or coordinates',()=>{
  assert.equal(sourcedPlaceExamples.length,6);
  assert.equal(new Set(sourcedPlaceExamples.map(place=>place.id)).size,6);
  assert.equal(new Set(sourcedPlaceExamples.map(place=>place.sourceUrl)).size,6);
  for(const place of sourcedPlaceExamples){
    assert.equal(place.reviewStatus,'source-confirmed-only');
    assert.equal(place.checkedOn,'2026-11-12');
    assert.match(place.sourceUrl,/^https:\/\/[a-z0-9.-]+\/$/);
    assert.ok(place.name.length>5);
    assert.ok(place.lgaId);
    assert.ok(!('latitude' in place));
    assert.ok(!('longitude' in place));
    assert.ok(!('phone' in place));
  }
});

test('unfiltered Explore shows sources without inventing approved directory entries',()=>{
  assert.equal(findSourcedExamples('').length,6);
  assert.equal(findSourcedExamples('',{category:'Hotels'}).length,1);
  assert.deepEqual(findSourcedExamples('',{lgaId:'ido-osi'}).map(p=>p.id),['fethi-ido-ekiti']);
  assert.deepEqual(findSourcedExamples('',{category:'Offices'}),[]);
  assert.deepEqual(findSourcedExamples('',{category:'Schools',lgaId:'ado-ekiti'}).map(p=>p.id),
    ['eksu-ado-ekiti','fpa-ado-ekiti']);
});

test('ordinary Ekiti service queries match category plus named place, not unrelated towns',()=>{
  assert.deepEqual(findSourcedExamples('hotels in Ikogosi').map(p=>p.id),['ikogosi-warm-springs']);
  assert.deepEqual(findSourcedExamples('hospital in Ido Ekiti').map(p=>p.id),['fethi-ido-ekiti']);
  assert.deepEqual(findSourcedExamples('hospital in Ikogosi'),[]);
  assert.deepEqual(findSourcedExamples('schools in Ado Ekiti').map(p=>p.id),
    ['eksu-ado-ekiti','fpa-ado-ekiti']);
  assert.deepEqual(findSourcedExamples('FUOYE school').map(p=>p.id),['fuoye-oye-ekiti']);
  assert.deepEqual(findSourcedExamples('EKSUTH').map(p=>p.id),['eksuth-ado-ekiti']);
  assert.deepEqual(findSourcedExamples('universities in Ado-Ekiti').map(p=>p.id),['eksu-ado-ekiti']);
});

test('unrelated, overly general and sensitive queries never produce sample results',()=>{
  for(const q of ['Ekiti','Nigeria','plumber in Ado','my report about Ikogosi hotel',
    'emergency hospital','Contact citizen@example.org about schools',
    '+234 803 123 4567 hotel','x'.repeat(101)]){
    assert.deepEqual(findSourcedExamples(q),[],q);
  }
});
