// Read-only verification of the independent FICTIONAL admin demo Worker.
// No authentication credentials, private URLs or case payloads are sent.
import assert from 'node:assert/strict';

const origin=new URL(process.argv[2]||'');
assert.equal(origin.protocol,'https:','Only HTTPS staging origins are accepted');
assert.equal(origin.href,origin.origin+'/','Supply the origin only');
const resp=await fetch(origin,{redirect:'error',signal:AbortSignal.timeout(15000)});
assert.equal(resp.status,200,'Admin demo root must respond successfully');
assert.match(resp.headers.get('content-type')||'',/text\/html/i);
const html=await resp.text();
assert.match(html,/<div id="root"><\/div>/,'Admin React app root is missing');
const js=html.match(/<script[^>]+src="([^"]+\.js)"/i)?.[1];
assert.ok(js,'Admin Vite module must be present');
const assetUrl=new URL(js,origin);
assert.equal(assetUrl.origin,origin.origin,'Module asset must be same-origin');
const asset=await fetch(assetUrl,{redirect:'error',signal:AbortSignal.timeout(15000)});
assert.equal(asset.status,200,'Admin frontend module unavailable');
assert.match(asset.headers.get('content-type')||'',/javascript/i);
const script=await asset.text();
assert.ok(script.length>100,'Admin module is empty');
assert.ok(!script.includes('sb_secret_'),'Secret keys must never ship in static demo');
console.log('Static, fictional-only admin demo assets passed at '+origin.origin);
