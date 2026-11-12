import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createAdminService } from '../src/server/admin-service.ts';

const origin='https://admin.example.test';
const issuer='https://auth.example.test/auth/v1';
const subject='12345678-1234-4123-8123-123456789012';
const caseId='32345678-1234-4234-8234-123456789012';
const now=Math.floor(Date.now()/1000);
const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
let keys,jwk;
async function token(overrides={}) {
  if (!keys) {
    keys=await webcrypto.subtle.generateKey(
      {name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
    jwk=await webcrypto.subtle.exportKey('jwk',keys.publicKey);
    jwk.alg='ES256';jwk.use='sig';jwk.kid='private-test-key';
  }
  const h=enc({alg:'ES256',kid:'private-test-key',typ:'JWT'});
  const p=enc({iss:issuer,aud:'authenticated',sub:subject,role:'authenticated',
    aal:'aal2',iat:now-30,exp:now+900,nbf:now-30,...overrides});
  const content=h+'.'+p;
  const sig=await webcrypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},
    keys.privateKey,new TextEncoder().encode(content));
  return content+'.'+Buffer.from(sig).toString('base64url');
}
function env() {
  return {
    ADMIN_API_ENABLED:'yes',ADMIN_ORIGIN:origin,ADMIN_ISSUER:issuer,
    ADMIN_AUDIENCE:'authenticated',
    ADMIN_PRIVATE_HYPERDRIVE:{connectionString:'private:ci:mock'},
    ADMIN_PREAUTH_LIMIT:{calls:[],async limit(input){this.calls.push(input);return {success:true}}},
    ADMIN_STAFF_LIMIT:{calls:[],async limit(input){this.calls.push(input);return {success:true}}},
  };
}
function dependencies() {
  const output={open:0,close:0,jwks:[]};
  return {
    output,
    fetchJwks: async (url,options) => {
      output.jwks.push({url,options});
      return Response.json({keys:[jwk]});
    },
    openDatabase: async connectionString => {
      assert.equal(connectionString,'private:ci:mock');
      output.open++;
      return {
        client:{
          async query(sql,params) {
            if (sql.includes('admin_rpc_membership')) {
              assert.equal(params[0],subject);
              return {rowCount:1,rows:[{
                user_id:subject,role:'case_manager',active:true,
                allowed_lga_ids:['ado-ekiti'],verified_office_id:null,expires_at:null,
              }]};
            }
            if (sql.includes('admin_rpc_cases')) return {rowCount:1,rows:[{
              id:caseId,public_reference:'42345678-1234-4234-8234-123456789012',
              kind:'Issue',lga_id:'ado-ekiti',current_state:'under_review',
              revision:'1',received_at:'2026-11-10T00:00:00Z',
              updated_at:'2026-11-10T08:00:00Z',
              description:'secret not in API',
            }]};
            if (sql.includes('admin_rpc_audit_read')) return {rowCount:1,rows:[{}]};
            throw new Error('Unexpected SQL: '+sql);
          },
        },
        async close(){output.close++},
      };
    },
  };
}
test('disabled, incomplete or untrusted configuration never contacts DB or JWKS', async () => {
  const d=dependencies();
  const input=new Request(origin+'/admin/api/me');
  const disabled=createAdminService({...env(),ADMIN_API_ENABLED:'no'},d);
  assert.equal((await disabled(input)).status,404);
  const missing=createAdminService({...env(),ADMIN_PRIVATE_HYPERDRIVE:undefined},d);
  assert.equal((await missing(input)).status,404);
  const insecure=createAdminService({...env(),ADMIN_ISSUER:'http://auth.example.test/auth/v1'},d);
  assert.equal((await insecure(input)).status,404);
  const wrongAudience=createAdminService({...env(),ADMIN_AUDIENCE:'other'},d);
  assert.equal((await wrongAudience(input)).status,404);
  assert.equal(d.output.open,0);
  assert.equal(d.output.jwks.length,0);
});
test('preauth rate limit blocks requests before JWT fetch or DB connection', async () => {
  const d=dependencies(),e=env();
  e.ADMIN_PREAUTH_LIMIT.limit=async () => ({success:false});
  const service=createAdminService(e,d);
  const response=await service(new Request(origin+'/admin/api/me',{headers:{
    Authorization:'Bearer invalid', 'CF-Connecting-IP':'203.0.113.7',
  }}));
  assert.equal(response.status,429);
  assert.equal(d.output.open,0);
  assert.equal(d.output.jwks.length,0);
});
test('invalid and missing MFA tokens never open the private database', async () => {
  const d=dependencies(),service=createAdminService(env(),d);
  assert.equal((await service(new Request(origin+'/admin/api/me'))).status,401);
  const weak=await token({aal:'aal1'});
  const response=await service(new Request(origin+'/admin/api/me',{headers:{
    Authorization:'Bearer '+weak,
  }}));
  assert.equal(response.status,401);
  assert.equal(d.output.open,0);
  assert.equal(d.output.jwks.length,1);
  assert.equal(d.output.jwks[0].url,issuer+'/.well-known/jwks.json');
  assert.equal(d.output.jwks[0].options.redirect,'error');
  assert.equal(d.output.jwks[0].options.cache,'no-store');
});
test('verified staff reads only scoped data and closes server-only DB connection', async () => {
  const d=dependencies(),e=env(),service=createAdminService(e,d);
  const jwt=await token();
  const headers={Authorization:'Bearer '+jwt};
  const me=await service(new Request(origin+'/admin/api/me',{headers}));
  assert.equal(me.status,200);
  assert.equal((await me.json()).membership.role,'case_manager');
  const list=await service(new Request(origin+'/admin/api/cases?limit=2',{headers}));
  assert.equal(list.status,200);
  const response=await list.json();
  assert.equal(response.items.length,1);
  assert.equal(response.items[0].id,caseId);
  assert.equal(response.items[0].description,undefined);
  assert.equal(d.output.open,2);
  assert.equal(d.output.close,2);
  assert.equal(e.ADMIN_STAFF_LIMIT.calls.length,2);
});
test('cross-origin routes and unavailable key issuer fail without database access', async () => {
  const d=dependencies(),service=createAdminService(env(),d);
  const jwt=await token();
  assert.equal((await service(new Request('https://evil.example.test/admin/api/me',{
    headers:{Authorization:'Bearer '+jwt},
  }))).status,404);
  d.fetchJwks=async () => new Response('<html>gateway error</html>',{
    status:200,headers:{'Content-Type':'text/html'},
  });
  const fail=createAdminService(env(),d);
  const res=await fail(new Request(origin+'/admin/api/me',{headers:{
    Authorization:'Bearer '+jwt,
  }}));
  assert.equal(res.status,401);
  assert.equal(d.output.open,0);
});
