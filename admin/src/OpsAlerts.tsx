import * as React from 'react';
import type {AdminCase} from './case-model.ts';
import {caseQueue} from './case-model.ts';

export interface OpsAlert{
 id:string;caseId:string;title:string;area:string;
 severity:'attention'|'priority';reason:string;
}
export function deriveDemoAlerts(cases:readonly AdminCase[]):OpsAlert[]{
 return cases.filter(item=>caseQueue(item)!=='resolved'&&
   (item.priority==='high'||caseQueue(item)==='escalated'))
   .map(item=>({
     id:'alert-'+item.id,caseId:item.id,title:item.title,area:item.lga,
     severity:item.priority==='high'?'priority':'attention',
     reason:item.priority==='high'?'Marked high priority in sample data':
       'Escalated for internal sample review',
   }))
   .sort((a,b)=>Number(b.severity==='priority')-Number(a.severity==='priority'));
}

/** Original, locally synthesized two-tone chime; never autoplay, persists no
 * device preference and never represents emergency dispatch or a real alert. */
export async function playPreviewChime():Promise<boolean>{
 if(typeof window==='undefined')return false;
 const AudioContextClass=window.AudioContext;
 if(!AudioContextClass)return false;
 let context:AudioContext|undefined;
 try{
   context=new AudioContextClass();
   if(context.state!=='running')await context.resume();
   const now=context.currentTime;
   const tones=[{frequency:660,start:0},{frequency:880,start:0.16}];
   for(const tone of tones){
     const osc=context.createOscillator();
     const gain=context.createGain();
     osc.type='sine';
     osc.frequency.value=tone.frequency;
     gain.gain.setValueAtTime(0.0001,now+tone.start);
     gain.gain.exponentialRampToValueAtTime(0.09,now+tone.start+0.02);
     gain.gain.exponentialRampToValueAtTime(0.0001,now+tone.start+0.15);
     osc.connect(gain);gain.connect(context.destination);
     osc.start(now+tone.start);osc.stop(now+tone.start+0.16);
   }
   // Short original chime, with no continuous polling or background audio.
   await new Promise<void>(resolve=>window.setTimeout(resolve,420));
   return true;
 }catch{return false;}
 finally{if(context)void context.close().catch(()=>{});}
}
export function OpsAlerts({cases,onOpenCase}:{
 cases:readonly AdminCase[];onOpenCase:(id:string)=>void;
}){
 const alerts=React.useMemo(()=>deriveDemoAlerts(cases),[cases]);
 const [sounds,setSounds]=React.useState(false);
 const [error,setError]=React.useState('');
 const [readIds,setReadIds]=React.useState<readonly string[]>([]);
 const unread=alerts.filter(alert=>!readIds.includes(alert.id));
 const preview=async()=>{
   if(!sounds)return;
   const played=await playPreviewChime();
   if(!played)setError('Sound unavailable on this device. Visual notifications remain available.');
   else setError('');
 };
 return <section className="ops-alerts" aria-label="Sample alert inbox">
   <div className="ops-alerts-head">
     <div><span className="ops-eyebrow">NOTIFICATION CENTRE</span>
       <h2>Needs attention <span className="ops-alert-count">{unread.length}</span></h2>
       <p>Tailored to the fictional queue · never real-time emergency monitoring</p></div>
     <label className="ops-sound-toggle" htmlFor="ops-sound">
       <input id="ops-sound" type="checkbox" checked={sounds}
         onChange={e=>setSounds(e.target.checked)}/>
       <span>Sound {sounds?'on':'off'}</span>
     </label>
   </div>
   <div className="ops-alert-controls">
     <button type="button" onClick={()=>void preview()} disabled={!sounds}>
       Test chime
     </button>
     <button type="button" onClick={()=>setReadIds(alerts.map(a=>a.id))}
       disabled={unread.length===0}>Mark sample alerts read</button>
   </div>
   {error&&<p className="ops-sound-error" role="status">{error}</p>}
   {alerts.length===0?<p className="ops-alert-empty">No sample cases need attention.</p>:
     <ol className="ops-alert-items">{alerts.map(alert=><li key={alert.id}
       className={readIds.includes(alert.id)?'read':''}>
       <span className={'ops-alert-symbol '+alert.severity} aria-hidden="true"/>
       <div><strong>{alert.title}</strong>
         <small>{alert.area} · {alert.reason}</small></div>
       <button type="button" onClick={()=>{
         setReadIds(prev=>[...new Set([...prev,alert.id])]);
         onOpenCase(alert.caseId);
       }}>View case</button>
     </li>)}</ol>}
   <p className="ops-alert-disclosure">Alerts derive only from local illustrative cases.
     No push subscription, background notifications, SMS, dispatch or alarm is enabled.
     A chime plays only after you enable sound and press Test chime.</p>
 </section>;
}
