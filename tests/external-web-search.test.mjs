import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/server/worker.ts';
import {
  parseExternalQuery,ExternalQueryError,fetchEkitiWebResults,
  fetchEkitiWikipediaResults,ekitiResultRelevance,
} from '../src/server/external-web-search.ts';

const goodHeaders={'Content-Type':'application/json'};
const mock=(payload)=>new Response(JSON.stringify(payload),{status:200,headers:goodHeaders});

test('external queries strictly bound length, public topic, fields and sensitive patterns',()=>{
  assert.equal(parseExternalQuery(new URLSearchParams('q=%20Hotels%20in%20Ikogosi%20')),
    'Hotels in Ikogosi');
  for(const url of [
    '', 'q=', 'q=a', 'q=hotels&q=markets', 'q=Ekiti&limit=2',
    'q='+('x'.repeat(91)), 'q=I%20want%20to%20report%20a%20crime',
    'q=Send%20my%20report%20about%20an%20incident',
    'q=official%40personal.example', 'q=%2B2348031234567',
    'q=Ekiti%00test',
  ]) assert.throws(()=>parseExternalQuery(new URLSearchParams(url)),
    ExternalQueryError,url);
});

test('Brave query scoped to Ekiti, constrained count, safe links and token not returned',async()=>{
  let captured;
  const fake=async(url,options)=>{
    captured={url,options};
    return mock({web:{results:[
      {title:'Ekiti public announcement',description:'<b>Ekiti</b> update',
        url:'https://example.org/ekiti'},
      {title:'Malicious link',description:'no',url:'javascript:alert(1)'},
      {title:'Ekiti public announcement',description:'duplicate',
        url:'https://example.org/ekiti'},
      {title:'Public service',description:'Ekiti',url:'https://service.example.org/info'},
    ]}});
  };
  const results=await fetchEkitiWebResults('education policy','example-test-secret',fake);
  assert.equal(new URL(captured.url).origin,'https://api.search.brave.com');
  assert.equal(new URL(captured.url).searchParams.get('q'),'Ekiti State Nigeria education policy');
  assert.equal(new URL(captured.url).searchParams.get('count'),'16');
  assert.equal(captured.options.headers['X-Subscription-Token'],'example-test-secret');
  assert.equal(results.results.length,2);
  assert.equal(results.results[0].description,'Ekiti update');
  assert.equal(results.verifiedByEkitiCivic,false);
  assert.equal(JSON.stringify(results).includes('example-test-secret'),false);
});

test('no-key Wikimedia search returns source-attributed Wikipedia links',async()=>{
  let requested;
  const fake=async(url,options)=>{
    requested={url,options};
    return mock({pages:[{
      key:'Ekiti_State',title:'Ekiti State',description:'State of Nigeria',
      excerpt:'A state <span class="searchmatch">in Nigeria</span>',
    }]});
  };
  const r=await fetchEkitiWikipediaResults('Ekiti State',fake);
  assert.equal(new URL(requested.url).hostname,'en.wikipedia.org');
  assert.equal(new URL(requested.url).pathname,'/w/rest.php/v1/search/page');
  assert.equal(r.provider,'Wikipedia');
  assert.equal(r.results[0].url,'https://en.wikipedia.org/wiki/Ekiti_State');
  assert.equal(r.results[0].domain,'en.wikipedia.org');
  assert.equal(r.verifiedByEkitiCivic,false);
  assert.match(requested.options.headers['Api-User-Agent'],/EkitiCivic/);
});

test('web route is GET only, origin checked, rate limited and feature gated',async()=>{
  const base='https://ekiti.example/api/web-search?q=Ekiti';
  const allowed={LOCATION_LIMIT:{limit:async()=>({success:true})}};
  assert.equal((await worker.fetch(new Request(base,{method:'POST'}),allowed)).status,405);
  assert.equal((await worker.fetch(new Request(base,{headers:{Origin:'https://malicious.example'}}),allowed)).status,403);
  assert.equal((await worker.fetch(new Request(base),allowed)).status,503);
  assert.equal((await worker.fetch(new Request(base.replace('Ekiti','a')),allowed)).status,400);
  const rateLimited={LOCATION_LIMIT:{limit:async()=>({success:false})}};
  assert.equal((await worker.fetch(new Request(base),rateLimited)).status,429);
});

test('external source API fetches only after enabled public request, without PostGIS',async()=>{
  const original=globalThis.fetch;
  let calls=0;
  try {
    globalThis.fetch=async()=>{calls++;return mock({pages:[{
      key:'Ekiti_State',title:'Ekiti State',description:'Nigerian state',
    }]});};
    const env={
      EXTERNAL_WEB_SEARCH_ENABLED:'true',
      LOCATION_LIMIT:{limit:async()=>({success:true})},
    };
    const response=await worker.fetch(
      new Request('https://ekiti.example/api/web-search?q=Ekiti'),env);
    assert.equal(response.status,200);
    const result=await response.json();
    assert.equal(result.provider,'Wikipedia');
    assert.equal(result.results.length,1);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
    assert.equal(calls,1);
  } finally {globalThis.fetch=original;}
});


test('Ekiti-specific web relevance rejects unrelated results even from an Ekiti-scoped query',async()=>{
  const captured=await fetchEkitiWebResults('jobs','mock-key',async()=>mock({
    web:{results:[
      {title:'Jobs in Lagos',description:'Jobs across Lagos and Abuja',
        url:'https://jobs.example.org/lagos'},
      {title:'Ekiti State employment notice',description:'New opportunities in Ado-Ekiti',
        url:'https://www.ekitistate.gov.ng/employment'},
      {title:'Ikogosi resort guide',description:'Tourism in Ikogosi, Ekiti State',
        url:'https://news.example.org/ikogosi-tourism'},
      {title:'World politics',description:'National and international coverage',
        url:'https://news.example.org/global'},
    ]},
  }));
  assert.equal(captured.results.length,2);
  assert.deepEqual(captured.results.map(value=>value.title),
    ['Ekiti State employment notice','Ikogosi resort guide']);
  assert.ok(ekitiResultRelevance(captured.results[0])>ekitiResultRelevance(captured.results[1]));
  assert.equal(ekitiResultRelevance({
    title:'Results for jobs',description:'Jobs in Lagos',
    url:'https://example.org/jobs',domain:'example.org',
  }),0);
});
test('Wikipedia fallback also excludes pages with no Ekiti evidence',async()=>{
  const result=await fetchEkitiWikipediaResults('public health',async()=>mock({
    pages:[
      {title:'Ekiti State',key:'Ekiti_State',description:'State of Nigeria'},
      {title:'London',key:'London',description:'Capital of England'},
    ],
  }));
  assert.equal(result.results.length,1);
  assert.equal(result.results[0].title,'Ekiti State');
});
