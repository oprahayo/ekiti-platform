import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  buildSettlementReview,validatedLgaIndex,
  pointInRing,pointInPolygon,pointInGeometry,
  SOURCE_ITEM_ID,
} from '../scripts/grid3-settlement-core.mjs';

const boundaries=JSON.parse(readFileSync(new URL('../data/grid3/lga.json',import.meta.url),'utf8'));
const lgas=validatedLgaIndex(boundaries);

function interiorPoint(feature){
  const rings=feature.geometry.type==='Polygon'
    ? feature.geometry.coordinates : feature.geometry.coordinates[0];
  const ring=rings[0];
  const xs=ring.map(v=>v[0]),ys=ring.map(v=>v[1]);
  const xmin=Math.min(...xs),xmax=Math.max(...xs);
  const ymin=Math.min(...ys),ymax=Math.max(...ys);
  for(let yi=1;yi<100;yi++){
    const y=ymin+(ymax-ymin)*yi/100;
    for(let xi=1;xi<100;xi++){
      const x=xmin+(xmax-xmin)*xi/100;
      if(pointInGeometry([x,y],feature.geometry)==='inside' &&
        lgas.filter(l=>pointInGeometry([x,y],l.geometry)==='inside').length===1)
        return [x,y];
    }
  }
  throw new Error('No unambiguous interior point for '+feature.name);
}
const fixture=(lga,id,overrides={})=>({
  type:'Feature',
  geometry:{type:'Point',coordinates:interiorPoint(lga)},
  properties:{
    FID:id,statename:'Ekiti',lganame:lga.name,
    set_name:'Fixture settlement '+id,set_altnam:'Alias '+id+';Alias '+id,
    set_id:'SET'+id,editor:'do not copy editor',
    ...overrides,
  },
});

test('the 16 pinned LGA polygons have unique canonical names and strictly typed geometry',()=>{
  assert.equal(lgas.length,16);
  assert.equal(new Set(lgas.map(x=>x.id)).size,16);
  assert.equal(new Set(lgas.map(x=>x.name)).size,16);
});

test('point-in-polygon handles holes, orientation and border ambiguity',()=>{
  const outer=[[0,0],[10,0],[10,10],[0,10],[0,0]];
  const hole=[[3,3],[7,3],[7,7],[3,7],[3,3]];
  assert.equal(pointInRing([1,1],outer),'inside');
  assert.equal(pointInRing([10,5],outer),'border');
  assert.equal(pointInRing([11,5],outer),'outside');
  assert.equal(pointInPolygon([5,5],[outer,hole]),'outside');
  assert.equal(pointInPolygon([3,4],[outer,hole]),'border');
  assert.equal(pointInPolygon([2,2],[outer,hole]),'inside');
  assert.equal(pointInGeometry([2,2],{type:'MultiPolygon',coordinates:[[outer,hole]]}),'inside');
});

test('synthetic points within each true Ekiti polygon are classified by geometry',()=>{
  const source={type:'FeatureCollection',features:lgas.map((l,i)=>fixture(l,i+100))};
  const {candidates,quarantine,audit}=buildSettlementReview(source,boundaries);
  assert.equal(quarantine.length,0);
  assert.equal(candidates.features.length,16);
  assert.equal(audit.coveredLgas,16);
  assert.equal(audit.candidateCount,16);
  assert.equal(audit.license,'CC BY 4.0');
  for(const result of candidates.features){
    assert.equal(result.properties.sourceItemId,SOURCE_ITEM_ID);
    assert.equal(result.properties.reviewStatus,'pending-human-review');
    assert.ok(!('editor' in result.properties));
    assert.ok(!('phone' in result.properties));
    assert.ok(!('verified' in result.properties));
    assert.equal(result.properties.aliases.length,1);
    assert.equal(result.geometry.type,'Point');
    assert.equal(lgas.filter(l=>pointInGeometry(result.geometry.coordinates,l.geometry)==='inside').length,1);
  }
});

test('quarantine wrong metadata LGA, outside geometry, border and bad source state',()=>{
  const lga=lgas.find(l=>l.id==='ado-ekiti');
  const different=lgas.find(l=>l.id==='moba');
  assert.ok(lga && different);
  const point=interiorPoint(lga);
  const border=lga.geometry.coordinates[0][0];
  const result=buildSettlementReview({
    type:'FeatureCollection',features:[
      fixture(lga,1,{lganame:different.name}),
      fixture(lga,2,{statename:'Lagos'}),
      {...fixture(lga,3),geometry:{type:'Point',coordinates:[6.5,8.7]}},
      {...fixture(lga,4),geometry:{type:'Point',coordinates:border}},
      fixture(lga,5),
    ],
  },boundaries);
  assert.equal(result.candidates.features.length,1);
  assert.deepEqual(new Set(result.quarantine.map(q=>q.reason)),new Set([
    'source-lga-disagrees-with-polygon','source-state-not-ekiti',
    'invalid-or-out-of-range-point','boundary-requires-review',
  ]));
  assert.deepEqual(result.candidates.features[0].geometry.coordinates,point);
});

test('duplicate source ids and same-name-in-LGA do not silently publish either conflict',()=>{
  const lga=lgas.find(l=>l.id==='ado-ekiti');
  const result=buildSettlementReview({type:'FeatureCollection',features:[
    fixture(lga,20,{set_name:'Iludun'}),
    fixture(lga,21,{set_name:'Iludun'}),
    fixture(lga,20,{set_name:'Another name'}),
    fixture(lga,23,{set_name:'Valid different place'}),
  ]},boundaries);
  assert.equal(result.audit.duplicateNameGroups,1);
  assert.equal(result.candidates.features.length,1);
  assert.equal(result.candidates.features[0].properties.sourceObjectId,'23');
  assert.equal(result.audit.quarantinedCount,3);
  assert.deepEqual(result.quarantine.map(x=>x.reason).sort(),
    ['duplicate-source-object-id','same-name-in-lga-requires-review','same-name-in-lga-requires-review'].sort());
});

test('bad or incomplete geography inputs must fail rather than guessing names',()=>{
  assert.throws(()=>validatedLgaIndex({type:'FeatureCollection',features:[]}),/16/);
  assert.throws(()=>buildSettlementReview({type:'FeatureCollection',features:[]},null),/16/);
  assert.throws(()=>buildSettlementReview({},boundaries),/FeatureCollection/);
  assert.throws(()=>pointInGeometry([1,1],{type:'Point',coordinates:[1,1]}),/Polygon/);
});
