import * as React from 'react';
import {Link} from 'react-router';
import {lgas} from './fixtures.ts';
import {requestNearbyPlaces,NearbyDirectoryError,type NearbyResponse,type ReviewedGroup} from './nearby-directory.ts';

interface Props {
  category:ReviewedGroup|null;
  lga:string|null;
  query:string|null;
}
type State={status:'idle'|'checking'|'denied'|'unavailable';data:NearbyResponse|null};

/** Explicit action only. No mount-time GPS prompt or requests. */
export default function NearbyDirectorySearch({category,lga,query}:Props){
  const [radiusKm,setRadiusKm]=React.useState(25);
  const [state,setState]=React.useState<State>({status:'idle',data:null});
  const generation=React.useRef(0);
  const controller=React.useRef<AbortController|null>(null);
  React.useEffect(()=>{
    generation.current++;
    controller.current?.abort();
    controller.current=null;
    setState({status:'idle',data:null});
    return ()=>{generation.current++;controller.current?.abort();controller.current=null;};
  },[category,lga,query,radiusKm]);
  async function check(){
    const n=++generation.current;
    controller.current?.abort();
    const abort=new AbortController();
    controller.current=abort;
    setState({status:'checking',data:null});
    try {
      const data=await requestNearbyPlaces({category,lga,query,radiusKm},
        navigator.geolocation,window.isSecureContext,fetch,abort.signal);
      if(n!==generation.current||abort.signal.aborted)return;
      setState({status:'idle',data});
    }catch(error){
      if(n!==generation.current||abort.signal.aborted)return;
      setState({status:error instanceof NearbyDirectoryError&&error.reason==='denied'?
        'denied':'unavailable',data:null});
    }
  }
  return <section className="directory-nearest" aria-label="Verified nearby directory">
    <div className="directory-nearest-controls">
      <button type="button" disabled={state.status==='checking'}
        onClick={()=>void check()} className="quiet-action">
        {state.status==='checking'?'Checking reviewed places…':'Find verified places near me'}
      </button>
      <label htmlFor="nearby-radius">Within
        <select id="nearby-radius" value={radiusKm}
          onChange={event=>setRadiusKm(Number(event.target.value))}>
          <option value={5}>5 km</option>
          <option value={10}>10 km</option>
          <option value={25}>25 km</option>
          <option value={50}>50 km</option>
        </select>
      </label>
    </div>
    <p className="directory-nearest-disclosure">
      Optional GPS permission is requested only when you press Find.
      Distances are approximate straight-line distances from your current position,
      not walking or driving time. Only reviewed, geocoded listings can appear.
      No coordinates are saved with your profile or report.
    </p>
    {state.status==='checking'&&<p role="status">Checking the verified Ekiti directory…</p>}
    {state.status==='denied'&&<p role="status">Location access was declined.
      You can still search categories and choose an LGA manually.</p>}
    {state.status==='unavailable'&&<p role="status">Verified distance search is not available here.
      Continue browsing by category or LGA; no nearby distance claims are shown.</p>}
    {state.data?.status==='outside_ekiti'&&<p role="status">
      Your device appears outside Ekiti State. Nearby rankings are unavailable,
      but you can browse Ekiti services by category or select an LGA.</p>}
    {state.data?.status==='uncertain_coverage'&&<p role="status">
      The location cannot be matched confidently to a verified Ekiti LGA.
      No nearby results are being ranked. Choose an LGA manually instead.</p>}
    {state.data?.status==='ready'&&<div className="directory-nearest-results">
      <h2>Reviewed places nearby</h2>
      <p className="directory-nearest-disclosure">
        Sorted by verified straight-line distance within {radiusKm} km.
        Listings may be incomplete; no opening hours, travel times or live availability are inferred.
      </p>
      {state.data.items.length? <ul className="plain-list">
        {state.data.items.map(place=><li key={place.id}>
          <div className="directory-nearest-row">
            <Link to={'/places/'+place.id} className="directory-nearest-title">{place.name}</Link>
            <strong className="directory-nearest-distance">
              ~{place.distance_km.toFixed(1)} km
            </strong>
            <small>{place.category} · {lgas.find(area=>area.id===place.lga_id)?.name}
              {place.address_text?' · '+place.address_text:''}</small>
            <small>Reviewed source: <a href={place.source_url}
              target="_blank" rel="noreferrer noopener">{place.publisher}</a></small>
          </div>
        </li>)}
      </ul>:<p role="status">No reviewed listings with verified coordinates found within {radiusKm} km.
        This does not mean nearby services do not exist.</p>}
    </div>}
  </section>;
}
