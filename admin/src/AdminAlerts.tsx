import * as React from 'react';
import type {AdminCase} from './case-model.ts';
import {deriveDemoAlerts,playDemoChime,type DemoAlertLevel} from './alert-model.ts';

interface Props {
  cases:readonly AdminCase[];
  soundOn:boolean;setSoundOn:(next:boolean)=>void;
  volume:number;setVolume:(next:number)=>void;
  browserOn:boolean;setBrowserOn:(next:boolean)=>void;
  onOpenCase:(caseId:string)=>void;onClose:()=>void;
}
export default function AdminAlerts({
  cases,soundOn,setSoundOn,volume,setVolume,
  browserOn,setBrowserOn,onOpenCase,onClose,
}:Props){
  const alerts=React.useMemo(()=>deriveDemoAlerts(cases),[cases]);
  const [level,setLevel]=React.useState<'all'|DemoAlertLevel>('all');
  const [lga,setLga]=React.useState('');
  const [message,setMessage]=React.useState('');
  const lgOptions=React.useMemo(()=>
    [...new Set(alerts.map(alert=>alert.lga))].sort(),[alerts]);
  const visible=alerts.filter(alert=>(level==='all'||alert.level===level)&&
    (!lga||alert.lga===lga));
  async function allowBrowser(){
    // Ask only after a direct click. No hidden permission prompt at mount.
    if(!('Notification' in window)){
      setMessage('This browser does not support desktop notifications. In-app alerts still work.');
      return;
    }
    try{
      if(browserOn){setBrowserOn(false);setMessage('Browser alerts off.');return;}
      const permission=window.Notification.permission==='granted'
        ?'granted':await window.Notification.requestPermission();
      setBrowserOn(permission==='granted');
      setMessage(permission==='granted'
        ?'Enabled for sample actions in this open tab only. No background push service exists.'
        :'Permission unavailable or denied. No browser notification will be sent.');
    }catch{
      setBrowserOn(false);
      setMessage('Browser notification support is unavailable on this device.');
    }
  }
  return <section className="alerts-popover" aria-label="Demo alerts and notification settings">
    <header className="alerts-header">
      <div><small>OPERATIONS / DEMONSTRATION</small>
        <h2>Alerts <span>{alerts.length}</span></h2></div>
      <button type="button" className="alerts-close" onClick={onClose} aria-label="Close alerts">×</button>
    </header>
    <p className="alerts-disclosure">These are <strong>fictional platform alerts</strong>.
      No live incident, urgent dispatch, SMS, government notice or push subscription is connected.</p>
    <div className="alerts-settings">
      <label className="alerts-toggle" htmlFor="alerts-sound">
        <span><strong>Sound alerts</strong><small>Off by default · this tab only</small></span>
        <input id="alerts-sound" type="checkbox" checked={soundOn}
          onChange={e=>setSoundOn(e.target.checked)} />
      </label>
      <div className="alerts-sound-controls">
        <label htmlFor="alerts-volume">Volume <strong>{volume}%</strong></label>
        <input id="alerts-volume" type="range" min="0" max="100" step="5"
          value={volume} onChange={e=>setVolume(Number(e.target.value))}
          aria-label="Demo alert chime volume"/>
        <button type="button" onClick={()=>void playDemoChime(volume,'attention')}>
          Preview two-tone alert
        </button>
      </div>
      <button className="alerts-browser-permission" type="button" onClick={()=>void allowBrowser()}>
        {browserOn?'Disable desktop alerts':'Enable desktop alerts'}
      </button>
      {message&&<p role="status" className="alerts-feedback">{message}</p>}
    </div>
    <div className="alerts-filter-row">
      <label>Priority
        <select value={level} onChange={e=>setLevel(e.target.value as typeof level)}>
          <option value="all">All levels</option>
          <option value="attention">Review priority</option>
          <option value="update">Follow-up</option>
          <option value="info">Other activity</option>
        </select>
      </label>
      <label>Local government
        <select value={lga} onChange={e=>setLga(e.target.value)}>
          <option value="">All sample areas</option>
          {lgOptions.map(x=><option key={x} value={x}>{x}</option>)}
        </select>
      </label>
    </div>
    <div className="alerts-list" role="region" aria-label="Filtered sample alerts">
      {visible.length===0?<p className="alerts-empty" role="status">No sample alerts match the filters.</p>
        :<ul>{visible.map(item=><li key={item.id}>
          <button type="button" onClick={()=>onOpenCase(item.caseId)}>
            <span className={'alert-indicator alert-'+item.level} aria-hidden="true"/>
            <span className="alert-content">
              <strong>{item.title}</strong>
              <small>{item.summary}</small>
              <em>{item.lga} · Demo record</em>
            </span>
            <span aria-hidden="true">›</span>
          </button>
        </li>)}</ul>}
    </div>
  </section>;
}
