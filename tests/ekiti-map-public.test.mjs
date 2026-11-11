import test from 'node:test';
import assert from 'node:assert/strict';
import {parseReviewedMapPins} from '../src/app/map-public-data.ts';

const areas=new Map([['ado-ekiti','Ado-Ekiti'],['ikere','Ikere']]);
const item={
  id:'12345678-1234-4234-8234-123456789012',
  name:'Verified example entry',category:'Health',lga_id:'ado-ekiti',
  publisher:'Independent source',reviewed_at:'2026-11-10T12:00:00Z',
  latitude:7.62,longitude:5.22,
};

test('Ekiti map pins require reviewed public source, valid UUID, reviewed LGA and finite location',()=>{
  assert.deepEqual(parseReviewedMapPins({reviewedOnly:true,items:[item]},areas),[{
    id:item.id,name:item.name,category:item.category,lga:'Ado-Ekiti',
    latitude:item.latitude,longitude:item.longitude,
  }]);
  for(const bad of [
    {...item,latitude:null},{...item,longitude:null},
    {...item,latitude:Infinity},{...item,latitude:0},
    {...item,longitude:180},{...item,lga_id:'unknown'},
    {...item,reviewed_at:null},{...item,publisher:''},
    {...item,id:'demo-health-1'},
    {...item,name:'<script>alert(1)</script>'},
  ]){
    const points=parseReviewedMapPins({reviewedOnly:true,items:[bad]},areas);
    // Names are rendered by textContent; markup is never parsed as HTML.
    if(bad.name!==item.name)assert.equal(points[0]?.name,bad.name);
    else assert.deepEqual(points,[],String(bad.id));
  }
  for(const payload of [
    null,{},[],{items:[item]}, {reviewedOnly:false,items:[item]},
    {reviewedOnly:true,items:Array.from({length:26},()=>item)},
  ])assert.throws(()=>parseReviewedMapPins(payload,areas));
});
test('one duplicate pin reference is never rendered twice',()=>{
  const result=parseReviewedMapPins({reviewedOnly:true,items:[item,item]},areas);
  assert.equal(result.length,1);
});
