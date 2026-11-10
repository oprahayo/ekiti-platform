import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileCandidates, validateCoordinates } from '../src/geo/resolve.ts';

const lga = { id:'lga-1', name:'Example LGA', sourceId:'validated-source-v1' };
const ward = { id:'ward-1', name:'Example Ward', parentId:'lga-1', sourceId:'validated-source-v1' };

test('correct hierarchical matches are consistent', () => {
  const result = reconcileCandidates({stateBoundaryStatus:'inside',lgas:[lga],wards:[ward]});
  assert.equal(result.lga.status, 'matched');
  assert.equal(result.ward.status, 'matched');
  assert.equal(result.consistency, 'consistent');
  assert.equal(result.requiresConfirmation, false);
});

test('known LGA but missing ward retains partial resolution', () => {
  const result = reconcileCandidates({stateBoundaryStatus:'inside',lgas:[lga],wards:[]});
  assert.equal(result.lga.match?.id, 'lga-1');
  assert.equal(result.ward.status, 'unmapped');
  assert.equal(result.consistency, 'unverified');
  assert.equal(result.requiresConfirmation, true);
});

test('boundary overlap is ambiguous, not guessed', () => {
  const result = reconcileCandidates({stateBoundaryStatus:'inside',lgas:[lga,{...lga,id:'lga-2'}],wards:[]});
  assert.equal(result.lga.status, 'ambiguous');
  assert.equal(result.lga.match, null);
});

test('parent mismatch must be surfaced', () => {
  const result = reconcileCandidates({stateBoundaryStatus:'inside',lgas:[lga],wards:[{...ward,parentId:'other-lga'}]});
  assert.equal(result.consistency,'conflict');
  assert.equal(result.requiresConfirmation,true);
});

test('outside scope cannot be presented as a match', () => {
  const result = reconcileCandidates({stateBoundaryStatus:'outside',lgas:[lga],wards:[ward]});
  assert.equal(result.lga.status,'outside_scope');
  assert.equal(result.ward.match,null);
});

test('invalid coordinates are refused', () => {
  assert.throws(()=>validateCoordinates(Number.NaN,5),RangeError);
  assert.throws(()=>validateCoordinates(92,5),RangeError);
  assert.throws(()=>validateCoordinates(5,181),RangeError);
  assert.doesNotThrow(()=>validateCoordinates(7.6,5.2));
});
