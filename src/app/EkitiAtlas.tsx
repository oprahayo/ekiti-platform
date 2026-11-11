import * as React from 'react';
import {Link} from 'react-router';
import {lgas} from './fixtures.ts';
import {parseReviewedMapPins,type PublicDirectoryPin} from './map-public-data.ts';

const MapLocation=React.lazy(()=>import('./MapLocation.tsx'));
type Layer='directory'|'reports';
const areaNames=new Map(lgas.map(lga=>[lga.id,lga.name]));
export default function EkitiAtlas(){
  const [layer,setLayer]=React.useState<Layer>('directory');
  const [lga,setLga]=React.useState('');
  const [query,setQuery]=React.useState('');
  const [loading,setLoading]=React.useState(false);
  const [searched,setSearched]=React.useState(false);
  const [error,setError]=React.useState('');
  const [pins,setPins]=React.useState<readonly PublicDirectoryPin[]>([]);
  const requestRef=React.useRef<AbortController|null>(null);
  React.useEffect(()=>()=>requestRef.current?.abort(),[]);
  async function load(){
    requestRef.current?.abort();
    const controller=new AbortController();
    requestRef.current=controller;
    setLoading(true);setSearched(false);setError('');setPins([]);
    try{
      const params=new URLSearchParams({limit:'20'});
      if(lga)params.set('lga',lga);
      if(query.trim())params.set('q',query.trim().slice(0,80));
      const response=await fetch('/api/places?'+params.toString(),{
        signal:controller.signal,credentials:'same-origin',
      });
      if(!response.ok)throw Error('Unavailable');
      const body:unknown=await response.json();
      const reviewed=parseReviewedMapPins(body,areaNames);
      if(!controller.signal.aborted){
        setPins(reviewed);setSearched(true);
      }
    }catch{
      if(!controller.signal.aborted){
        setError('Reviewed places are not available for this search. Try another LGA or return to Explore.');
      }
    }finally{if(!controller.signal.aborted)setLoading(false);}
  }
  function switchLayer(next:Layer){
    requestRef.current?.abort();setLayer(next);setPins([]);
    setSearched(false);setError('');setLoading(false);
  }
  return <main className="page ekiti-atlas-page" id="main">
    <header className="atlas-intro">
      <p className="eyebrow">EKITI GEOGRAPHY</p>
      <h1>Explore Ekiti on the map</h1>
      <p>Browse the state's 16 LGA boundaries and source-reviewed services.
        Public incident locations are protected until they have been reviewed for safe publication.</p>
    </header>
    <div className="atlas-switch" role="group" aria-label="Map layer">
      <button type="button" aria-pressed={layer==='directory'} onClick={()=>switchLayer('directory')}>
        Business & services</button>
      <button type="button" aria-pressed={layer==='reports'} onClick={()=>switchLayer('reports')}>
        Public reports</button>
    </div>
    {layer==='directory'?<section className="atlas-search" aria-label="Reviewed map search">
      <form onSubmit={event=>{event.preventDefault();void load();}}>
        <label htmlFor="atlas-search">Find a business or service
          <input id="atlas-search" type="search" maxLength={80}
            placeholder="Clinic, hotel, repair shop…" value={query}
            onChange={event=>setQuery(event.target.value)}/>
        </label>
        <label htmlFor="atlas-lga">Local government area
          <select id="atlas-lga" value={lga} onChange={event=>setLga(event.target.value)}>
            <option value="">Across Ekiti</option>
            {lgas.map(area=><option key={area.id} value={area.id}>{area.name}</option>)}
          </select>
        </label>
        <button type="submit" disabled={loading}>
          {loading?'Checking…':'Show reviewed places'}
        </button>
      </form>
      {error&&<p className="atlas-status" role="status">{error}</p>}
      {searched&&<p className="atlas-status" role="status">
        {pins.length?pins.length+' reviewed place'+(pins.length===1?'':'s')+
          ' with coordinates on this map page.':'No reviewed businesses with verified coordinates match this search.'}
      </p>}
    </section>:<section className="atlas-public-note" aria-label="Privacy of public reports">
      <h2>Privacy before publication</h2>
      <p>No report locations are published here yet. Residents' exact incident
        points, home addresses, photos and identifying details are never placed
        on the public map by default. Future pins need explicit publication approval,
        redaction and suitably approximate geography.</p>
      <Link to="/report">Prepare a private report</Link>
    </section>}
    <React.Suspense fallback={<p role="status">Loading Ekiti LGA map…</p>}>
      <MapLocation mode={layer==='reports'?'public':'directory'}
        pins={layer==='directory'?pins:[]}/>
    </React.Suspense>
    <div className="atlas-links">
      <Link to="/explore">Browse all categories</Link>
      <Link to="/report">Report an issue</Link>
    </div>
    <p className="atlas-footnote">Independent civic platform; not a government emergency dispatch
      service. If danger is immediate, contact appropriate local emergency services directly.
      The map is for reference, not proof that an office received any report.</p>
  </main>;
}
