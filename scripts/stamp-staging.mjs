// Identifies the deployed staging commit without adding a UI badge or secrets.
// Must be run after Vite builds and before the Wrangler asset upload.
import {execFileSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';

const target=process.argv[2];
if(target!=='citizen'&&target!=='admin-demo')
  throw Error('Usage: node scripts/stamp-staging.mjs citizen|admin-demo');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(!/^[a-f0-9]{40}$/.test(sha))
  throw Error('Cannot verify git commit');
const branch=execFileSync('git',['symbolic-ref','--short','HEAD'],{encoding:'utf8'}).trim();
if(branch!=='integration/staging-citizen-admin-sprints-03-12')
  throw Error('Refusing to stamp an unexpected branch');
const dest=resolve(target==='citizen'?'dist':'dist-admin');
mkdirSync(dest,{recursive:true});
writeFileSync(resolve(dest,'staging-build.json'),
  JSON.stringify({
    release:'citizen-admin-sprints-03-12',
    branch,commit:sha,target,
  },null,2)+'\n');
console.log('Stamped '+target+' staging commit '+sha);
