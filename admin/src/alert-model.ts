import type {AdminCase} from './case-model.ts';
import {caseQueue} from './case-model.ts';

export type DemoAlertLevel='attention'|'update'|'info';
export interface DemoAlert {
  id:string;caseId:string;title:string;summary:string;lga:string;
  level:DemoAlertLevel;occurredAt:string;
}
/**
 * Derive in-memory alerts from fictional cases only. Never infer distress,
 * office dispatch or official response from an internal priority flag.
 */
export function deriveDemoAlerts(cases:readonly AdminCase[]):DemoAlert[]{
  return cases.flatMap(item=>{
    if(!item.id.startsWith('DEMO-')||!item.events.length)return [];
    const queue=caseQueue(item);
    if(queue==='resolved')return [];
    const last=item.events[item.events.length-1]!;
    const level:DemoAlertLevel=item.priority==='high'||queue==='escalated'
      ?'attention':queue==='awaiting'?'update':'info';
    return [{
      id:item.id+':'+last.id,caseId:item.id,
      title:item.priority==='high'?'Priority review (sample)'
        :queue==='awaiting'?'Information needed (sample)'
          :queue==='escalated'?'Internal escalation (sample)':'Case activity (sample)',
      summary:item.title,lga:item.lga,level,occurredAt:last.at,
    }];
  }).sort((a,b)=>b.occurredAt.localeCompare(a.occurredAt)).slice(0,30);
}

/** Original two-tone synthesized preview, no files, third-party samples or playback before a gesture. */
export async function playDemoChime(volume:number,kind:'attention'|'update'='update'){
  if(typeof window==='undefined'||!Number.isFinite(volume)||volume<=0)return false;
  const browser=window as Window & {webkitAudioContext?:typeof AudioContext};
  const Audio=browser.AudioContext||browser.webkitAudioContext;
  if(!Audio)return false;
  let context:AudioContext|undefined;
  try{
    context=new Audio();
    if(context.state==='suspended')await context.resume();
    const now=context.currentTime;
    const tones=kind==='attention'?[660,880,660]:[659,784];
    for(let i=0;i<tones.length;i++){
      const start=now+i*0.16;
      const oscillator=context.createOscillator();
      const gain=context.createGain();
      oscillator.type='sine';
      oscillator.frequency.value=tones[i]!;
      gain.gain.setValueAtTime(0,start);
      gain.gain.linearRampToValueAtTime(Math.min(.09,.09*volume/100),start+.018);
      gain.gain.exponentialRampToValueAtTime(.001,start+.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start+.13);
    }
    setTimeout(()=>{void context?.close().catch(()=>{});},tones.length*160+220);
    return true;
  }catch{
    await context?.close().catch(()=>{});
    return false;
  }
}
