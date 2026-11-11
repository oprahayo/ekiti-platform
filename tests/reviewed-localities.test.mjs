import test from 'node:test';
import assert from 'node:assert/strict';
import {inferEkitiLocality,normaliseEkitiText,reviewedLocalities} from '../src/geo/reviewed-localities.ts';
import {planPublicSearch} from '../src/server/unified-search.ts';

test('reviewed gazetteer provides source attribution and covers all sixteen LGAs',()=>{
  const ids=new Set(reviewedLocalities.filter(a=>a.kind==='lga').map(x=>x.lgaId));
  assert.equal(ids.size,16);
  assert.ok(reviewedLocalities.every(x=>
    x.source.startsWith('https://www.ekitistate.gov.ng/') &&
    x.aliases.length>0 && x.lgaId.length>0));
});
test('a named town suggests the correct Ekiti LGA, never exact GPS',()=>{
  const cases=[
    ['Broken bridge at Iludun Ekiti, please inspect urgently','ilejemeje','Iludun-Ekiti'],
    ['Serious flooding in Eda Oniyo community today','ilejemeje','Eda-Oniyo-Ekiti'],
    ['I saw damaged tourist access road near Ikogosi','ekiti-west','Ikogosi-Ekiti'],
    ['We need urgent repairs in Adebayo, Ado Ekiti','ado-ekiti','Adebayo, Ado-Ekiti'],
    ['I need schools in Ikere','ikere','Ikere'],
  ];
  for(const [text,lga,name] of cases){
    const match=inferEkitiLocality(text);
    assert.equal(match.status,'candidate',text);
    if(match.status==='candidate'){
      assert.equal(match.place.lgaId,lga);
      assert.equal(match.place.name,name);
    }
  }
});
test('do not turn a person called Adebayo into a fake location',()=>{
  assert.equal(inferEkitiLocality('Adebayo reported the broken road near the house').status,'unresolved');
  assert.equal(inferEkitiLocality('Governor Adebayo is speaking').status,'unresolved');
  assert.equal(inferEkitiLocality('Repair needed near Adebayo').status,'candidate');
});
test('cross-LGA place mentions are ambiguous and never arbitrarily assigned',()=>{
  const out=inferEkitiLocality('The damaged bus travels from Eda Oniyo to Ikogosi');
  assert.deepEqual(out,{status:'ambiguous',lgaIds:['ekiti-west','ilejemeje']});
  assert.equal(inferEkitiLocality('A bridge close to a different village').status,'unresolved');
  assert.equal(normaliseEkitiText('  Eda–Oniyo  Èkìtì  '),'eda oniyo ekiti');
});
test('search plan understands verified places and coarse types without invented distance',()=>{
  assert.deepEqual(planPublicSearch({query:'Find hotels in Ikogosi',limit:8}),{
    directory:{category:'Hotels',lga:'ekiti-west',query:'Ikogosi Ekiti',limit:8},
    knowledge:{query:'Find hotels in Ikogosi',limit:8},
    localityHint:{
      name:'Ikogosi-Ekiti',lgaId:'ekiti-west',lgaName:'Ekiti West',
      source:'https://www.ekitistate.gov.ng/about-ekiti/tourism',
      confidence:'reviewed-place-name',
    },scope:'specific-place',
  });
  const electrician=planPublicSearch({query:'Find electricians in Iludun Ekiti',limit:10});
  assert.equal(electrician.directory.lga,'ilejemeje');
  assert.equal(electrician.directory.category,null);
  assert.equal(electrician.directory.query,'electricians');
  assert.equal(planPublicSearch({query:'Ikogosi to Eda Oniyo road',limit:5}).scope,'ambiguous');
  assert.equal(planPublicSearch({query:'Ekiti budget 2026',limit:10}).localityHint,null);
});
