import * as React from 'react';
import {lgas} from './fixtures.ts';
const MapLocation=React.lazy(()=>import('./MapLocation.tsx'));
import {acquireDevicePosition,assessIncidentCoverage,parseManualPoint,
  resolveVerifiedPoint,PositionError,type IncidentCoverage} from './verified-location.ts';

interface IncidentLocationPickerProps {
  disabled:boolean;
  language:'en'|'yo';
  onApply:(lgaId:string,wardName:string|null)=>void;
}

/**
 * Optional incident-POINT lookup. Deliberately not derived from Explore's
 * device location. This component is mounted only on the incident location
 * step and drops typed coordinates as soon as that step unmounts.
 */
export default function IncidentLocationPicker({
  disabled,language,onApply,
}:IncidentLocationPickerProps){
  const [mode,setMode]=React.useState<'none'|'device'|'coordinates'|'map'>('none');
  const [mapPoint,setMapPoint]=React.useState<{latitude:number;longitude:number}|null>(null);
  const [latitude,setLatitude]=React.useState('');
  const [longitude,setLongitude]=React.useState('');
  const [status,setStatus]=React.useState<'idle'|'checking'|'denied'|'unavailable'|'invalid'>('idle');
  const [coverage,setCoverage]=React.useState<IncidentCoverage|null>(null);
  const [applied,setApplied]=React.useState(false);
  const generation=React.useRef(0);
  const alive=React.useRef(true);
  React.useEffect(()=>{
    alive.current=true;
    return ()=>{alive.current=false;generation.current++;};
  },[]);
  React.useEffect(()=>{
    if(disabled) {
      generation.current++;
      setMode('none');setLatitude('');setLongitude('');setMapPoint(null);
      setCoverage(null);setStatus('idle');setApplied(false);
    }
  },[disabled]);
  function switchMode(next:'none'|'device'|'coordinates'|'map'){
    generation.current++;
    setMode(next);setLatitude('');setLongitude('');setMapPoint(null);
    setCoverage(null);setStatus('idle');setApplied(false);
  }
  async function check(point:{latitude:number;longitude:number}){
    const id=++generation.current;
    setStatus('checking');setCoverage(null);setApplied(false);
    try{
      const result=await resolveVerifiedPoint(point,fetch);
      if(id!==generation.current||!alive.current)return;
      setCoverage(assessIncidentCoverage(result,lgas.map(item=>item.id)));
      setStatus('idle');
    }catch{
      if(id!==generation.current||!alive.current)return;
      setStatus('unavailable');setCoverage(null);
    }
  }
  async function fromDevice(){
    const id=++generation.current;
    setStatus('checking');setCoverage(null);setApplied(false);
    try{
      const point=await acquireDevicePosition(navigator.geolocation,window.isSecureContext);
      if(id!==generation.current||!alive.current)return;
      // Only now, after an explicit "I am at the incident" click, is the
      // coordinate sent to the restricted boundary resolver.
      await check(point);
    }catch(error){
      if(id!==generation.current||!alive.current)return;
      setStatus(error instanceof PositionError&&error.reason==='denied'?'denied':'unavailable');
      setCoverage(null);
    }
  }
  function fromCoordinates(){
    const point=parseManualPoint(latitude,longitude);
    if(!point){setStatus('invalid');setCoverage(null);return;}
    void check(point);
  }
  const t=language==='yo';
  return <fieldset className="guided-incident-point">
    <legend>{t?'Yíyan ibi tí ìṣẹ̀lẹ̀ ti ṣẹlẹ̀ (aṣàyàn)':'Check the incident point (optional)'}</legend>
    <p className="guided-hint">
      {t?'Yan ibi tí ìṣẹ̀lẹ̀ náà ti ṣẹlẹ̀, kì í ṣe ibi tí o wà báyìí láìsí ìdánilójú.':
        'The incident location may be different from where you are now. You can simply choose an LGA above.'}
    </p>
    {disabled?<p className="guided-urgent-advice" role="status">
      For sensitive or retaliation-related drafts, exact location checks are disabled. Choose an LGA manually and avoid private addresses.
    </p>:<>
      <div className="guided-location-options" role="group" aria-label="Incident point method">
        <button type="button" aria-pressed={mode==='device'}
          onClick={()=>switchMode(mode==='device'?'none':'device')}>
          {t?'Mo wà níbi ìṣẹ̀lẹ̀ náà':'I am at the incident'}
        </button>
        <button type="button" aria-pressed={mode==='map'}
          onClick={()=>switchMode(mode==='map'?'none':'map')}>
          {t?'Yan ibi lori maapu Ekiti':'Choose on Ekiti map'}
        </button>
        <button type="button" aria-pressed={mode==='coordinates'}
          onClick={()=>switchMode(mode==='coordinates'?'none':'coordinates')}>
          {t?'Ṣàyẹ̀wò àwọn kóódínéètì':'Check known coordinates'}
        </button>
      </div>
      {mode==='device'&&<div className="guided-point-panel">
        <p className="guided-hint">Use this only if you are physically at the incident scene.
          Your browser will request permission; your position will not be reused from Explore.</p>
        <button type="button" className="quiet-action" disabled={status==='checking'}
          onClick={()=>void fromDevice()}>Check this incident position</button>
      </div>}
      {mode==='map'&&<div className="guided-point-panel">
        <p className="guided-hint">This GRID3 Ekiti boundary map makes no third-party tile request.
          Tap only where the incident took place. Your selected point stays in memory
          until you press Check; it is never automatically added to a report.</p>
        <React.Suspense fallback={<p role="status">Loading Ekiti boundary map…</p>}>
          <MapLocation mode="incident" onPoint={(latitude,longitude)=>{
            generation.current++;
            setMapPoint({latitude,longitude});setCoverage(null);
            setStatus('idle');setApplied(false);
          }}/>
        </React.Suspense>
        {mapPoint&&<div className="guided-point-actions">
          <p role="status">Map point selected locally. No report was sent.</p>
          <button type="button" className="quiet-action" disabled={status==='checking'}
            onClick={()=>void check(mapPoint)}>Check this incident point</button>
        </div>}
      </div>}
      {mode==='coordinates'&&<div className="guided-point-panel">
        <p className="guided-hint">Enter coordinates of the incident, not your home. Up to six decimal places.
          They are used for a boundary check only, not saved with your draft.</p>
        <div className="guided-coordinate-fields">
          <label htmlFor="incident-latitude">Latitude
            <input id="incident-latitude" value={latitude} maxLength={16}
              inputMode="decimal" autoComplete="off" placeholder="e.g. 7.62"
              onChange={event=>{generation.current++;setLatitude(event.target.value);setCoverage(null);setStatus('idle');setApplied(false);}}/>
          </label>
          <label htmlFor="incident-longitude">Longitude
            <input id="incident-longitude" value={longitude} maxLength={16}
              inputMode="decimal" autoComplete="off" placeholder="e.g. 5.22"
              onChange={event=>{generation.current++;setLongitude(event.target.value);setCoverage(null);setStatus('idle');setApplied(false);}}/>
          </label>
        </div>
        <button type="button" className="quiet-action" disabled={status==='checking'}
          onClick={fromCoordinates}>Check incident coordinates</button>
      </div>}
      {mode!=='none'&&<p className="guided-hint">
        This sends coordinates to the first-party verified Ekiti boundary checker only when you press Check.
        The position is not kept in browser storage, attached to the saved report, or published.
        Location lookup is not an official incident report.
      </p>}
      {status==='checking'&&<p role="status">Checking verified Ekiti boundaries…</p>}
      {status==='invalid'&&<p className="guided-error" role="alert">
        Enter valid latitude (−90 to 90) and longitude (−180 to 180), up to six decimal places.
      </p>}
      {status==='denied'&&<p role="status">
        Location permission was denied. You can still choose an Ekiti LGA manually.
      </p>}
      {status==='unavailable'&&<p role="status">
        Location lookup is unavailable. Continue by choosing an Ekiti LGA manually.
      </p>}
      {coverage?.status==='suggested'&&<div className="guided-point-result" role="status">
        <strong>Verified boundary suggests {coverage.lgaName}</strong>
        <p>{coverage.wardName?'Matched ward: '+coverage.wardName+'. ':''}
          Boundary matches are suggestions, not proof of where an incident occurred.
          Confirm the LGA yourself before continuing.</p>
        <button type="button" onClick={()=>{
          onApply(coverage.lgaId,coverage.wardName??null);setApplied(true);
        }}>Use suggested LGA</button>
        {applied&&<p role="status">Suggestion selected. You may still change the LGA above.</p>}
      </div>}
      {coverage?.status==='outside'&&<p className="guided-point-result" role="status">
        This point appears outside Ekiti State. If the incident occurred in Ekiti, choose its actual LGA manually.
        We cannot classify an outside-Ekiti point as a verified Ekiti location.
      </p>}
      {coverage?.status==='ambiguous'&&<p className="guided-point-result" role="status">
        The point is on an uncertain LGA boundary.
        {coverage.candidates.length?' Possible areas: '+coverage.candidates.map(x=>x.name).join(', ')+'.':''}
        Choose and confirm the appropriate LGA using the dropdown above; none has been selected automatically.
      </p>}
      {coverage?.status==='unmapped'&&<p className="guided-point-result" role="status">
        No uniquely verified Ekiti LGA could be matched. Choose an area manually.
      </p>}
      {coverage?.status==='conflict'&&<p className="guided-point-result" role="status">
        LGA and ward evidence disagree. No area was chosen from the coordinates.
        Check the incident area manually.
      </p>}
    </>}
  </fieldset>;
}
