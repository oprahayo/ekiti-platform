#!/usr/bin/env node
// Public, read-only release audit. No cookies, location, private case data or DB credentials.
import assert from 'node:assert/strict';
import {appendFile} from 'node:fs/promises';

const origin=process.env.EKITI_STAGING_ORIGIN||
  'https://ekiti-platform-staging.inekitikete.workers.dev';
const expectedCommit=process.env.GITHUB_SHA||'';
const probes=[
  ['/api/areas','geography',body=>Array.isArray(body)&&body.filter(x=>x.kind==='lga').length===16],
  ['/api/search?q=Hotels+near+Ikogosi','search',
    body=>body?.reviewedOnly===true&&Array.isArray(body.places)&&Array.isArray(body.knowledge)],
  ['/api/places?limit=3','places',
    body=>body?.reviewedOnly===true&&Array.isArray(body.items)],
  ['/api/knowledge?q=Ekiti&limit=3','knowledge',
    body=>body?.reviewedOnly===true&&Array.isArray(body.items)],
];
assert.equal(new URL(origin).protocol,'https:','Use a public HTTPS staging origin');
const details=[];
for(const [path,label,validate] of probes){
  let code='network-error', valid=false;
  try{
    const response=await fetch(new URL(path,origin),{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Accept:'application/json','Cache-Control':'no-cache'},
    });
    code=String(response.status);
    if(response.status===200){
      const result=await response.json();
      valid=validate(result)===true;
    }
  }catch{/* No private error details escape into CI or public commit status. */}
  details.push({label,code,valid});
  console.log((valid?'PASS ':'FAIL ')+label+': HTTP '+code+
    (code==='200'&&!valid?' (unexpected public response shape)':''));
}
let manifest='missing-or-invalid';
try{
  const response=await fetch(new URL('/staging-build.json',origin),{
    signal:AbortSignal.timeout(12000),redirect:'error',
    headers:{Accept:'application/json','Cache-Control':'no-cache'},
  });
  if(response.status===200){
    const body=await response.json();
    if(body?.target==='citizen'&&
      body?.branch==='integration/staging-citizen-admin-sprints-03-12'&&
      /^[a-f0-9]{40}$/.test(body?.commit||''))
      manifest=body.commit;
  }
}catch{/* Invalid or unreachable manifest. */}
const stale=manifest!==expectedCommit;
console.log('Release manifest: '+(manifest==='missing-or-invalid'?'missing/invalid':
  stale?'deployed commit differs from integration tip':'matches integration tip'));
const failures=details.filter(x=>!x.valid);
const state=failures.length||stale?'failure':'success';
let reason=failures.length?
  'Public API failure: '+failures.map(x=>x.label+' '+x.code).join(', '):
  stale?'Staging deployment does not match integration tip':'Public search and release manifest OK';
if(reason.length>138)reason=reason.slice(0,138);
const summary=[
  '### Credential-free Ekiti staging audit',
  '',
  '| Public API | HTTP | Shape |',
  '|---|---:|---|',
  ...details.map(x=>'| '+x.label+' | '+x.code+' | '+(x.valid?'valid':'failed')+' |'),
  '',
  'Release SHA match: '+(stale?'no':'yes'),
  '',
  'This audit is read-only. It does not deploy, install SQL, or approve any listing.',
  '',
].join('\n');
if(process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
if(process.env.GITHUB_OUTPUT)
  await appendFile(process.env.GITHUB_OUTPUT,'state='+state+'\ndescription='+reason+'\n');
if(state!=='success'){
  console.error(reason);
  process.exitCode=1;
}
