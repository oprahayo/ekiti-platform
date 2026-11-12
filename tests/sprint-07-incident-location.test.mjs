import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireDevicePosition,assessIncidentCoverage,parseManualPoint,
  resolveVerifiedPoint,PositionError,
} from '../src/app/verified-location.ts';

const ids=['ado-ekiti','ikere','ikole'];
const ado={id:'ado-ekiti',name:'Ado-Ekiti'};
const ikere={id:'ikere',name:'Ikere'};
const ward={id:'ward-01',name:'Example Ward',parentId:'ado-ekiti'};
const matched={
  stateBoundaryStatus:'inside',lga:{status:'matched',match:ado},
  ward:{status:'matched',match:ward},
  consistency:'consistent',requiresConfirmation:false,
};

test('incident position is obtained only through an explicit function invocation',async()=>{
  let requested=0;
  const provider={getCurrentPosition(success,error,opts){
    requested++;
    assert.equal(opts.enableHighAccuracy,true);
    assert.equal(opts.maximumAge,0);
    success({coords:{latitude:7.62,longitude:5.22}});
  }};
  assert.equal(requested,0,'no permission prompt merely by importing module');
  const point=await acquireDevicePosition(provider,true);
  assert.deepEqual(point,{latitude:7.62,longitude:5.22});
  assert.equal(requested,1);
  await assert.rejects(acquireDevicePosition(provider,false),
    error=>error instanceof PositionError&&error.reason==='unavailable');
  assert.equal(requested,1,'insecure context never prompts browser');
});

test('denied or missing GPS never prevents manual incident location',async()=>{
  await assert.rejects(acquireDevicePosition(undefined,true),
    error=>error instanceof PositionError&&error.reason==='unavailable');
  const rejected={getCurrentPosition(success,error){error({code:1});}};
  await assert.rejects(acquireDevicePosition(rejected,true),
    error=>error instanceof PositionError&&error.reason==='denied');
  const timeout={getCurrentPosition(success,error){error({code:3});}};
  await assert.rejects(acquireDevicePosition(timeout,true),
    error=>error instanceof PositionError&&error.reason==='unavailable');
});

test('verified resolver passes coordinates only in first-party no-store POST body, never in URL',async()=>{
  const calls=[];
  const send=async (url,init)=>{
    calls.push({url,init});
    return Response.json(matched);
  };
  const result=await resolveVerifiedPoint({latitude:7.625,longitude:5.225},send);
  assert.equal(result.lga.match.id,'ado-ekiti');
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/api/resolve');
  assert.equal(calls[0].init.method,'POST');
  assert.equal(calls[0].init.cache,'no-store');
  assert.equal(calls[0].init.referrerPolicy,'no-referrer');
  assert.equal(calls[0].init.credentials,'same-origin');
  assert.deepEqual(JSON.parse(calls[0].init.body),{
    latitude:7.625,longitude:5.225,confirmed:true,
  });
  await assert.rejects(resolveVerifiedPoint({latitude:91,longitude:0},send),RangeError);
  assert.equal(calls.length,1,'invalid coordinates never cause a network request');
  await assert.rejects(resolveVerifiedPoint({latitude:7,longitude:5},
    async()=>new Response('unavailable',{status:503})),
    error=>error instanceof PositionError&&error.reason==='unavailable');
});

test('matched verified LGA requires human confirmation even with ward consistency',()=>{
  const result=assessIncidentCoverage(matched,ids);
  assert.deepEqual(result,{status:'suggested',lgaId:'ado-ekiti',lgaName:'Ado-Ekiti',
    wardName:'Example Ward',requiresConfirmation:true});
  const withoutWard=assessIncidentCoverage({...matched,ward:{status:'unmapped',match:null},
    consistency:'unverified',requiresConfirmation:true},ids);
  assert.equal(withoutWard.status,'suggested');
  assert.equal(Object.hasOwn(withoutWard,'wardName'),false);
  const onBoundary=assessIncidentCoverage({...matched,stateOnBoundary:true},ids);
  assert.equal(onBoundary.status,'suggested');
  assert.equal(Object.hasOwn(onBoundary,'wardName'),false);
  const wrongParent=assessIncidentCoverage({...matched,ward:{status:'matched',
    match:{...ward,parentId:'ikere'}},consistency:'conflict'},ids);
  assert.deepEqual(wrongParent,{status:'conflict',candidates:[]});
});

test('outside, unknown, multiple, stale or unverified LGA never autofill a report',()=>{
  assert.deepEqual(assessIncidentCoverage({...matched,stateBoundaryStatus:'outside'},ids),
    {status:'outside',candidates:[]});
  assert.deepEqual(assessIncidentCoverage({...matched,stateBoundaryStatus:'unknown'},ids),
    {status:'unmapped',candidates:[]});
  assert.deepEqual(assessIncidentCoverage({...matched,lga:{status:'matched',
    match:{id:'unknown',name:'Unverified'}}},ids),{status:'unmapped',candidates:[]});
  const ambiguous=assessIncidentCoverage({...matched,lga:{status:'ambiguous',
    match:null,candidates:[ado,ikere,ado,{id:'rogue-id',name:'Rogue'}]}},ids);
  assert.deepEqual(ambiguous,{status:'ambiguous',
    candidates:[ado,ikere]});
  const noWard=assessIncidentCoverage({...matched,ward:{status:'matched',
    match:{...ward,parentId:'ado-ekiti',onBoundary:true}}},ids);
  assert.equal(Object.hasOwn(noWard,'wardName'),false);
});

test('manual coordinates strictly enforce format, physical range and privacy-friendly precision',()=>{
  assert.deepEqual(parseManualPoint(' 7.62345 ',' 5.23456 '),{latitude:7.62345,longitude:5.23456});
  assert.deepEqual(parseManualPoint('-90','180'),{latitude:-90,longitude:180});
  for(const [lat,lon] of [
    ['','5'],['7',''],['91','5'],['-91','5'],['7','181'],['7','-181'],
    ['7.1234567','5'],['7e2','5'],['NaN','5'],['Infinity','5'],
    ['7,2','5'],['7.','5'],['0x10','5'],['123.4','5'],
  ]) assert.equal(parseManualPoint(lat,lon),null,lat+';'+lon);
});
