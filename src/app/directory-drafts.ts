/** Only browser-tab drafts; this is never a server receipt or a published listing. */
export interface ListingDraft {
  id: string;
  name: string;
  category: string;
  lgaId: string;
  description: string;
  savedAt: string;
}
export type ListingInput = Pick<ListingDraft,'name'|'category'|'lgaId'|'description'>;
const KEY='ekiti-service-listing-drafts-tab-v1';
const idPattern=/^[a-f0-9-]{36}$/i;
const clean=(value:string)=>value.trim().replace(/\s+/g,' ');
const hasControl=(value:string)=>/[\u0000-\u001f\u007f]/u.test(value);

export function validateListingInput(value: ListingInput): ListingInput {
  // Reject embedded control characters before trimming/collapsing whitespace.
  if(hasControl(value.name)||hasControl(value.category)||hasControl(value.lgaId)||
     hasControl(value.description))throw new Error('Remove control characters from the listing.');
  const fields={
    name:clean(value.name),
    category:clean(value.category),
    lgaId:clean(value.lgaId),
    description:value.description.trim(),
  };
  if(fields.name.length<3||fields.name.length>110||hasControl(fields.name)||
    fields.category.length<3||fields.category.length>80||hasControl(fields.category)||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(fields.lgaId)||
    fields.description.length<15||fields.description.length>1000||
    hasControl(fields.description))throw new Error('Check the business name, category, LGA and description.');
  return fields;
}
export interface TabStorage{getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem(key:string):void}
function tabStore():TabStorage|null{
  try{return typeof sessionStorage==='undefined'?null:sessionStorage;}catch{return null;}
}
function validDraft(value:unknown):value is ListingDraft{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Partial<ListingDraft>;
  if(typeof v.id!=='string'||!idPattern.test(v.id)||typeof v.savedAt!=='string'||
     !Number.isFinite(Date.parse(v.savedAt)))return false;
  try{validateListingInput({name:v.name||'',category:v.category||'',
     lgaId:v.lgaId||'',description:v.description||''});return true;}catch{return false;}
}
export function readListingDrafts(store=tabStore()):ListingDraft[]{
  try{
    const value=store?.getItem(KEY);
    if(!value)return [];
    const parsed:unknown=JSON.parse(value);
    if(!Array.isArray(parsed))return [];
    return parsed.filter(validDraft).slice(0,20);
  }catch{return [];}
}
export function saveListingDraft(input:ListingInput,store=tabStore()):ListingDraft{
  const parsed=validateListingInput(input);
  const draft:ListingDraft={...parsed,id:crypto.randomUUID(),savedAt:new Date().toISOString()};
  if(!store)throw new Error('Tab storage is unavailable. Keep a copy of your draft.');
  try{store.setItem(KEY,JSON.stringify([draft,...readListingDrafts(store)].slice(0,20)));}
  catch{throw new Error('Could not save this draft in your browser tab.');}
  return draft;
}
export function removeListingDraft(id:string,store=tabStore()):boolean{
  if(!idPattern.test(id)||!store)return false;
  try{store.setItem(KEY,JSON.stringify(readListingDrafts(store).filter(d=>d.id!==id)));return true;}
  catch{return false;}
}
