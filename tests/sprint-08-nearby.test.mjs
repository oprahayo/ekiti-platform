import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/server/worker.ts';
import {parseNearbySearch,searchVerifiedNearby,NearbyQueryError} from '../src/server/nearby-places.ts';
import {requestNearbyPlaces,validateNearbyResponse,NearbyDirectoryError}
  from '../src/app/nearby-directory.ts';

const input={latitude:7.625,longitude:5.245,confirmed:true,
  category:'Hotels',lga:'ado-ekiti',q:'guest house',radiusKm:10,limit:12};
const one={id:'12345678-9abc-4def-8aaa-123456789abc',
  name:'CI reviewed example',category:'Hotels',lga_id:'ado-ekiti',
  address_text:'Test address',publisher:'CI publisher',
  source_url:'https://example.org/source',distance_km:1.4};
const two={...one,id:'12345678-9abc-4def-8aaa-123456789abd',
  name:'Second reviewed example',distance_km:3.9};

test('nearby search strictly validates consent, coordinates, filters, radius and request size',()=>{
  assert.deepEqual(parseNearbySearch(JSON.stringify(input)),{
    latitude:7.625,longitude:5.245,confirmed:true,
    category:'Hotels',lga:'ado-ekiti',query:'guest house',radiusKm:10,limit:12,
  });
  assert.deepEqual(parseNearbySearch(JSON.stringify({latitude:7,longitude:5,confirmed:true})),{
    latitude:7,longitude:5,confirmed:true,
    category:null,lga:null,query:null,radiusKm:25,limit:20,
  });
  const invalid=[
    {...input,confirmed:false},{...input,latitude:NaN},{...input,latitude:91},
    {...input,longitude:-181},{...input,radiusKm:0},{...input,radiusKm:51},
    {...input,radiusKm:10.1},{...input,category:'UnreviewedTrade'},
    {...input,lga:'../private'},{...input,q:'x'.repeat(101)},
    {...input,q:'\u0000secret'},{...input,limit:21},{...input,limit:1.1},
    {...input,reportSecret:'forbidden'},null,[],{},
  ];
  for(const value of invalid)
    assert.throws(()=>parseNearbySearch(JSON.stringify(value)),NearbyQueryError,JSON.stringify(value).slice(0,50));
  assert.throws(()=>parseNearbySearch('{invalid'),NearbyQueryError);
  assert.throws(()=>parseNearbySearch(JSON.stringify({...input,q:'w'.repeat(650)})),NearbyQueryError);
});

test('reviewed search is a parameterized SQL call with DB-wide ranking before LIMIT',async()=>{
  const seen=[];
  const fake={query:async(sql,values)=>{
    seen.push({sql,values});
    return {rows:[one,two]};
  }};
  const results=await searchVerifiedNearby(fake,parseNearbySearch(JSON.stringify(input)));
  assert.deepEqual(results,[one,two]);
  assert.equal(seen.length,1);
  assert.equal(seen[0].sql,'SELECT * FROM civic.public_places_nearby($1,$2,$3,$4,$5,$6,$7)');
  assert.deepEqual(seen[0].values,[7.625,5.245,'Hotels','ado-ekiti','guest house',10,12]);
  assert.equal(seen[0].sql.includes('guest house'),false);
});

test('nearby Worker route is 404 until both independent review gates are explicitly enabled',async()=>{
  const request=()=>new Request('https://ekiti.example/api/places/nearby',{
    method:'POST',headers:{'Content-Type':'application/json',Origin:'https://ekiti.example'},
    body:JSON.stringify(input),
  });
  const off=await worker.fetch(request(),{});
  assert.equal(off.status,404);
  assert.deepEqual(await off.json(),{error:'Unknown route'});
  const env={NEARBY_DIRECTORY_ENABLED:'true',NEARBY_DIRECTORY_REVIEWED:'true',
    LOCATION_LIMIT:{limit:async()=>({success:true})}};
  assert.equal((await worker.fetch(request(),env)).status,503,'no DB binding means no results');
  assert.equal((await worker.fetch(new Request('https://ekiti.example/api/places/nearby',{
    method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},
    body:JSON.stringify(input),
  }),env)).status,403);
  assert.equal((await worker.fetch(new Request('https://ekiti.example/api/places/nearby',{
    method:'GET',headers:{Origin:'https://ekiti.example'},
  }),env)).status,405);
  assert.equal((await worker.fetch(new Request('https://ekiti.example/api/places/nearby',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input),
  }),env)).status,403,'no Origin header is rejected');
  assert.equal((await worker.fetch(new Request('https://ekiti.example/api/places/nearby',{
    method:'POST',headers:{'Content-Type':'application/json',Origin:'https://ekiti.example'},
    body:JSON.stringify({...input,latitude:999}),
  }),env)).status,400);
  assert.equal((await worker.fetch(new Request('https://ekiti.example/api/places/nearby?lat=7',{
    method:'POST',headers:{Origin:'https://ekiti.example'},
  }),env)).status,404,'no coordinate/query in URLs');
});

test('client only accepts sorted reviewed records with trustworthy approximate distances',()=>{
  const valid={items:[one,two],reviewedOnly:true,order:'distance',status:'ready',radiusKm:10};
  assert.deepEqual(validateNearbyResponse(valid,10),valid);
  const invalid=[
    {...valid,reviewedOnly:false},
    {...valid,items:[two,one]},
    {...valid,items:[one,one]},
    {...valid,items:[{...one,distance_km:11}]},
    {...valid,items:[{...one,distance_km:NaN}]},
    {...valid,items:[{...one,lga_id:'unverified'}]},
    {...valid,items:[{...one,source_url:'javascript:alert(1)'}]},
    {...valid,items:[{...one,id:'raw-private-id'}]},
    {...valid,status:'outside_ekiti'},
    {...valid,order:'name'},
  ];
  for(const result of invalid)
    assert.throws(()=>validateNearbyResponse(result,10),NearbyDirectoryError);
  assert.equal(validateNearbyResponse({...valid,items:[]},10).items.length,0);
});

test('nearby transport requests GPS only upon explicit call, sends no URL coordinates and never stores a raw point',async()=>{
  let gpsCalls=0;const requests=[];
  const provider={getCurrentPosition(success){
    gpsCalls++;success({coords:{latitude:7.625,longitude:5.245}});
  }};
  const fetcher=async(url,init)=>{
    requests.push({url,init});
    return Response.json({items:[one],reviewedOnly:true,order:'distance',status:'ready',radiusKm:10});
  };
  assert.equal(gpsCalls,0);
  const results=await requestNearbyPlaces({
    category:'Hotels',lga:'ado-ekiti',query:'guest house',radiusKm:10,
  },provider,true,fetcher);
  assert.equal(gpsCalls,1);
  assert.equal(results.items.length,1);
  assert.equal(requests[0].url,'/api/places/nearby');
  assert.equal(requests[0].init.method,'POST');
  assert.equal(requests[0].init.cache,'no-store');
  assert.equal(requests[0].init.referrerPolicy,'no-referrer');
  assert.deepEqual(JSON.parse(requests[0].init.body),input);
  assert.equal(requests[0].url.includes('7.625'),false);
  await assert.rejects(requestNearbyPlaces({category:null,lga:null,query:null,radiusKm:25},
    {getCurrentPosition(success,error){error({code:1});}},true,fetcher),
    error=>error instanceof NearbyDirectoryError&&error.reason==='denied');
  assert.equal(requests.length,1,'denied permission never sends a coordinate request');
});
