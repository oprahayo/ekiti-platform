import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUnifiedSearch,UnifiedSearchError,searchReviewedEkiti} from '../src/server/unified-search.ts';
import worker from '../src/server/worker.ts';

test('unified public search has one short normalized query and bounded result count', () => {
  assert.deepEqual(parseUnifiedSearch(new URLSearchParams('q=%20Hotels%20%20in%20Ekiti%20&limit=5')),
    {query:'Hotels in Ekiti',limit:5});
  assert.deepEqual(parseUnifiedSearch(new URLSearchParams('q=Iludun%20Ekiti')),
    {query:'Iludun Ekiti',limit:10});
  for(const input of [
    '', 'q=', 'q=a', 'q=ab&q=cd', 'q=Ekiti&private=1',
    'q=Ekiti&limit=0', 'q=Ekiti&limit=21', 'q=Ekiti&limit=1&limit=2',
    'q=Ekiti&limit=%2B1', 'q='+('x'.repeat(101)), 'q=ab%00cd',
  ]) assert.throws(()=>parseUnifiedSearch(new URLSearchParams(input)),UnifiedSearchError,input);
});

test('public search queries only approved existing directory and knowledge reader functions', async ()=>{
  const calls=[];
  const places=[{id:'place1',name:'Reviewed source fixture'}];
  const knowledge=[{id:'fact1',title:'Approved source fixture'}];
  const db={
    query:async(statement,values)=>{
      calls.push({statement,values});
      if(statement.includes('civic.public_places('))return {rows:places};
      if(statement.includes('civic.public_knowledge('))return {rows:knowledge};
      throw new Error('Forbidden query');
    },
  };
  const response=await searchReviewedEkiti(db,{query:'Ekiti',limit:7});
  assert.deepEqual(response,{query:'Ekiti',reviewedOnly:true,places,knowledge,localityHint:null,locationScope:'none'});
  assert.equal(calls.length,2);
  assert.deepEqual(calls[0].values,[null,null,'Ekiti',7]);
  assert.deepEqual(calls[1].values,['Ekiti',7]);
  assert.ok(calls.every(call=>/^SELECT \* FROM civic\.public_(places|knowledge)\(/u.test(call.statement)));
});

test('public search endpoint rejects malformed/cross-origin/method misuse before DB access',async()=>{
  const env={LOCATION_LIMIT:{limit:async()=>({success:true})}};
  for(const url of [
    'https://ekiti.example/api/search',
    'https://ekiti.example/api/search?q=x',
    'https://ekiti.example/api/search?q=Ekiti&q=More',
    'https://ekiti.example/api/search?q=Ekiti&limit=200',
  ]){
    const response=await worker.fetch(new Request(url),env);
    assert.equal(response.status,400,url);
  }
  const method=await worker.fetch(new Request('https://ekiti.example/api/search?q=Ekiti',{method:'POST'}),env);
  assert.equal(method.status,405);
  const denied=await worker.fetch(new Request('https://ekiti.example/api/search?q=Ekiti',{
    headers:{Origin:'https://attacker.example'},
  }),env);
  assert.equal(denied.status,403);
  const unreachable=await worker.fetch(new Request('https://ekiti.example/api/search?q=Ekiti'),env);
  assert.equal(unreachable.status,503);
  assert.equal(unreachable.headers.get('Cache-Control'),'no-store');
});
