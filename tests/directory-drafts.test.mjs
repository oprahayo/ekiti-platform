import test from 'node:test';
import assert from 'node:assert/strict';
import {validateListingInput,readListingDrafts,saveListingDraft,removeListingDraft}
  from '../src/app/directory-drafts.ts';

const input={name:' Ikere electrical services ',category:'Electricians',
  lgaId:'ikere',description:'Certified residential wiring and repair service.'};
function storage(){
  const data=new Map();
  return {
    getItem:k=>data.get(k)??null,
    setItem:(k,v)=>data.set(k,v),
    removeItem:k=>data.delete(k),
    data,
  };
}
test('listing input is normalized, bounded and never silently accepts malformed geography',()=>{
  assert.equal(validateListingInput(input).name,'Ikere electrical services');
  for(const invalid of [
    {...input,name:'X'},
    {...input,lgaId:'../../anywhere'},
    {...input,lgaId:''},
    {...input,description:'few words'},
    {...input,category:'invalid\nheader'},
    {...input,description:'x'.repeat(1001)},
  ]) assert.throws(()=>validateListingInput(invalid));
});
test('drafts are browser-tab-only, reopenable and removable without public API calls',()=>{
  const store=storage();
  assert.deepEqual(readListingDrafts(store),[]);
  const one=saveListingDraft(input,store);
  assert.equal(one.lgaId,'ikere');
  assert.equal(readListingDrafts(store).length,1);
  assert.equal(readListingDrafts(store)[0].id,one.id);
  assert.equal(removeListingDraft(one.id,store),true);
  assert.deepEqual(readListingDrafts(store),[]);
});
test('invalid storage, oversized lists and corrupted rows fail closed',()=>{
  const store=storage();
  store.setItem('ekiti-service-listing-drafts-tab-v1','invalid-json');
  assert.deepEqual(readListingDrafts(store),[]);
  for(let n=0;n<25;n++)saveListingDraft({...input,name:'Workshop number '+n},store);
  assert.equal(readListingDrafts(store).length,20);
  assert.equal(removeListingDraft('not-a-uuid',store),false);
});
