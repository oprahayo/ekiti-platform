import test from 'node:test';
import assert from 'node:assert/strict';
import { createStaffAuthClient, StaffRequestError } from '../admin/src/staff-auth.ts';

const userId='12345678-1234-4123-8123-123456789012';
const factorId='22345678-1234-4234-8234-123456789012';
const challengeId='32345678-1234-4234-8234-123456789012';
const caseId='42345678-1234-4234-8234-123456789012';
const eventId='52345678-1234-4234-8234-123456789012';
const refId='62345678-1234-4234-8234-123456789012';
const auth='https://issuer.example.test/auth/v1';
const admin='https://admin.example.test';
const key='sb_publishable_abcdef0123456789';
const config={authUrl:auth,publishableKey:key,adminOrigin:admin};
const jwt=(aal)=>['e30',Buffer.from(JSON.stringify({aal,sub:userId})).toString('base64url'),'signature'].join('.');
const aal1=jwt('aal1'),aal2=jwt('aal2');
const caseRow={
  id:caseId,publicReference:refId,kind:'Issue',lgaId:'ado-ekiti',
  currentState:'intake_accepted',revision:1,
  receivedAt:'2026-11-10T00:00:00Z',updatedAt:'2026-11-10T00:00:00Z',
};
const me={
  identity:{assurance:'aal2',expiresAt:Math.floor(Date.now()/1000)+900},
  membership:{role:'case_manager',allowedLgaIds:['ado-ekiti'],verifiedOfficeId:null},
};
function mock(overrides={}) {
  const calls=[];
  const fetcher=async (url, options)=>{
    calls.push({url,options});
    const path=new URL(url).pathname;
    const routes={
      '/auth/v1/token':{access_token:aal1},
      '/auth/v1/user':{factors:[{id:factorId,status:'verified',factor_type:'totp'}]},
      ['/auth/v1/factors/'+factorId+'/challenge']:{id:challengeId},
      ['/auth/v1/factors/'+factorId+'/verify']:{access_token:aal2},
      '/admin/api/me':me,
      '/admin/api/cases':{items:[{...caseRow,rawNarrative:'do not return'}]},
      ['/admin/api/cases/'+caseId+'/events']:{caseId,events:[
        {id:eventId,kind:'intake_accepted',actorKind:'system',createdAt:caseRow.receivedAt,detail:'Private platform receipt'}
      ]},
      '/auth/v1/logout':{},
      ...overrides,
    };
    if (!(path in routes)) throw new Error('Unknown request: '+url);
    const value=routes[path];
    if (value instanceof Response) return value;
    return Response.json(value);
  };
  return {calls,fetcher,client:createStaffAuthClient(config,fetcher)};
}
test('disabled or untrusted identity provider configuration fails closed',()=>{
  for (const bad of [
    {...config,authUrl:'http://issuer.example.test/auth/v1'},
    {...config,authUrl:'https://issuer.example.test/attacker'},
    {...config,authUrl:'https://issuer.example.test/auth/v1?other=true'},
    {...config,adminOrigin:'http://admin.example.test'},
    {...config,publishableKey:''},
  ]) assert.throws(()=>createStaffAuthClient(bad),StaffRequestError);
});
test('staff login requires enrolled verified TOTP and returns AAL2 without persisting tokens',async()=>{
  const {client,calls}=mock();
  const first=await client.signIn('staff@example.test','example-password');
  assert.equal(first.kind,'mfa');
  assert.equal(first.factorId,factorId);
  assert.equal(first.challengeId,challengeId);
  const token=await client.verifyMfa(first,'123456');
  assert.equal(token,aal2);
  const identity=await client.me(token);
  assert.equal(identity.role,'case_manager');
  assert.deepEqual(identity.allowedLgaIds,['ado-ekiti']);
  const rows=await client.listCases(token);
  assert.equal(rows.length,1);
  assert.equal(rows[0].id,caseId);
  assert.equal(rows[0].rawNarrative,undefined);
  const timeline=await client.events(token,caseId);
  assert.equal(timeline.length,1);
  await client.signOut(token);
  assert.equal(calls[0].url,auth+'/token?grant_type=password');
  assert.equal(calls[0].options.credentials,'omit');
  assert.equal(calls[0].options.cache,'no-store');
  assert.equal(calls[0].options.redirect,'error');
  assert.equal(calls[0].options.referrerPolicy,'no-referrer');
  assert.equal(calls[0].options.headers.apikey,key);
  assert.equal(calls[4].url,admin+'/admin/api/me');
  assert.equal(calls[4].options.headers.Authorization,'Bearer '+aal2);
  for (const call of calls) {
    assert.ok(!new URL(call.url).search.includes(aal1));
    assert.ok(!new URL(call.url).search.includes(aal2));
  }
});
test('unverified or ambiguous MFA enrollment cannot continue',async()=>{
  const noFactor=mock({'/auth/v1/user':{factors:[]}});
  await assert.rejects(noFactor.client.signIn('staff@example.test','pw'),
    error=>error instanceof StaffRequestError && error.status===403);
  assert.equal(noFactor.calls.length,2);
  const twoFactors=mock({'/auth/v1/user':{factors:[
    {id:factorId,status:'verified',factor_type:'totp'},
    {id:challengeId,status:'verified',factor_type:'totp'},
  ]}});
  await assert.rejects(twoFactors.client.signIn('staff@example.test','pw'),StaffRequestError);
  const weak=mock({['/auth/v1/factors/'+factorId+'/verify']:{access_token:aal1}});
  const first=await weak.client.signIn('staff@example.test','pw');
  await assert.rejects(weak.client.verifyMfa(first,'123456'),
    error=>error instanceof StaffRequestError && error.status===401);
});
test('invalid code, unapproved membership and malicious API responses fail closed',async()=>{
  const {client}=mock({'/admin/api/me':Response.json({error:'forbidden'}, {status:403})});
  await assert.rejects(client.me(aal2),
    error=>error instanceof StaffRequestError && error.status===403);
  const x=mock();
  const first=await x.client.signIn('staff@example.test','pw');
  await assert.rejects(x.client.verifyMfa(first,'12ab'),StaffRequestError);
  const contaminated=mock({'/admin/api/cases':{items:[{...caseRow,lgaId:'../../admin'}]}});
  await assert.rejects(contaminated.client.listCases(aal2),StaffRequestError);
  const unknownRole=mock({'/admin/api/me':{
    ...me,membership:{...me.membership,role:'government_superuser'},
  }});
  await assert.rejects(unknownRole.client.me(aal2),StaffRequestError);
});

test('Sprint 13 client sends bounded filters, verifies platform-only payload and proposes without office claims',async()=>{
  const reviewId='92345678-1234-4234-8234-123456789012';
  const result=mock({
    '/admin/api/intake':{items:[{...caseRow,evidenceAccess:'blocked_pending_safeguarding',
      description:'MUST BE REMOVED'}],paginationAvailable:false,
      scope:'independent_platform_only'},
    ['/admin/api/intake/'+caseId+'/proposals']:{
      result:'queued',proposalId:reviewId,reviewOnly:true,
      officeNotified:false,caseChanged:false,
    },
  });
  const rows=await result.client.listIntake(aal2,{
    lgaId:'ado-ekiti',kind:'Issue',state:'intake_accepted',
  });
  assert.equal(rows.length,1);
  assert.equal(rows[0].description,undefined);
  assert.equal(rows[0].evidenceAccess,'blocked_pending_safeguarding');
  const q=result.calls[0];
  assert.equal(q.url,admin+'/admin/api/intake?limit=20&lga=ado-ekiti&kind=Issue&state=intake_accepted');
  const proposal=await result.client.proposeIntake(aal2,caseId,'safeguarding_review',null,1);
  assert.deepEqual(proposal,{result:'queued',proposalId:reviewId,reviewOnly:true,
    officeNotified:false,caseChanged:false});
  const call=result.calls[1];
  assert.equal(call.options.method,'POST');
  assert.equal(call.options.cache,'no-store');
  assert.equal(call.options.credentials,'omit');
  assert.deepEqual(JSON.parse(call.options.body),
    {kind:'safeguarding_review',targetLgaId:null,expectedRevision:1});
  assert.ok(!call.url.includes(aal2));
  for(const filters of [
    {lgaId:'../ikere',kind:null,state:null},
    {lgaId:null,kind:'Emergency',state:null},
    {lgaId:null,kind:null,state:'government_received'},
  ])await assert.rejects(result.client.listIntake(aal2,filters),StaffRequestError);
  await assert.rejects(result.client.proposeIntake(
    aal2,caseId,'assignment_review','',1),StaffRequestError);
  await assert.rejects(result.client.proposeIntake(
    aal2,caseId,'safeguarding_review','ikere',1),StaffRequestError);
  const compromised=mock({
    '/admin/api/intake':{items:[{...caseRow,evidenceAccess:'published'}],
      paginationAvailable:false,scope:'independent_platform_only'},
  });
  await assert.rejects(compromised.client.listIntake(aal2,{
    lgaId:null,kind:null,state:null,
  }),StaffRequestError);
});
