import * as React from 'react';
import {Link,useNavigate} from 'react-router';
import {useApp} from './state.tsx';
import {detectIntent} from './intents.ts';

const examples=[
  'Electricians in Ikere',
  'Hotels near Ikogosi',
  'What is the Ekiti State budget?',
] as const;

/** A single search surface; individual civic products live in the header menu. */
export default function WelcomeHome(){
  const {language,deviceLocation,requestDeviceLocation,dismissDeviceLocation,
    setExploreQuery,setPendingReportText}=useApp();
  const [search,setSearch]=React.useState('');
  const [error,setError]=React.useState('');
  const navigate=useNavigate();
  const find=(event:React.FormEvent)=>{
    event.preventDefault();
    const value=search.trim().replace(/\s+/g,' ');
    if(value.length<2 || value.length>100){
      setError('Enter 2–100 characters to search Ekiti.');return;
    }
    setError('');
    const intent=detectIntent(value);
    // Explicit private report text must not enter a public search URL or API.
    if(intent.kind==='report'){
      setPendingReportText(value.length>=20?value:'');
      navigate('/report');return;
    }
    if(intent.kind==='track'){navigate('/track');return;}
    setExploreQuery(value);
    navigate('/search?'+new URLSearchParams({q:value}).toString());
  };
  return <main id="main" className="page welcome-gateway search-engine-landing">
    <div className="welcome-primary">
      <section className="welcome-heading" aria-labelledby="welcome-title">
        <h1 id="welcome-title">{language==='yo'?'Káàbọ̀ sí Ekiti Civic':'Welcome to Ekiti Civic'}</h1>
        <p className="welcome-subtitle">{language==='yo'
          ?'Ẹnu ọ̀nà rẹ sí ìmọ̀, iṣẹ́ àti ìròyìn Ìpínlẹ̀ Èkìtì.'
          :'Your mobile gateway to Ekiti State.'}</p>
      </section>
      <form className="gateway-search-form" role="search" onSubmit={find}>
        <label htmlFor="ekiti-home-search" className="visually-hidden">Search Ekiti State</label>
        <div className="gateway-search-field">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none"
            stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>
          </svg>
          <input id="ekiti-home-search" type="search" maxLength={100} autoComplete="off"
            enterKeyHint="search" value={search}
            onChange={event=>{setSearch(event.target.value);setError('');}}
            placeholder={language==='yo'?'Wá ibi, iṣẹ́ tàbí ìmọ̀ ní Èkìtì…'
              :'Search anything about Ekiti…'} />
          <button className="gateway-inline-submit" type="submit"
            aria-label="Submit search" disabled={!search.trim()}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="m4 12h16m-7-7 7 7-7 7"/>
            </svg>
          </button>
        </div>
        {error&&<p className="gateway-search-validation" role="alert">{error}</p>}
        <div className="gateway-search-actions">
          <button type="submit" disabled={!search.trim()}>Search Ekiti</button>
        </div>
        <p className="gateway-search-note">
          Ask a question, find a professional, discover a town or search reviewed public information.
        </p>
      </form>
      <nav className="gateway-quick-links" aria-label="Suggested searches">
        <span>Try:</span>
        {examples.map(item=><Link key={item}
          to={'/search?'+new URLSearchParams({q:item}).toString()}>{item}</Link>)}
      </nav>
      <p className="gateway-civic-links">
        <Link to="/report">Civic report</Link>
        <span aria-hidden="true">·</span>
        <Link to="/explore?map=1">Ekiti map</Link>
        <span aria-hidden="true">·</span>
        <Link to="/listings/new">List a business</Link>
      </p>
    </div>
    <details className="gateway-location-option">
      <summary>Use my location for a relevant Ekiti area</summary>
      <p>Optional. Allow location only when you want nearby information.
        An incident can be reported even if you are outside Ekiti or decline GPS.</p>
      {deviceLocation.status!=='dismissed'&&<p role="status">{deviceLocation.message}</p>}
      <div className="welcome-location-actions">
        {deviceLocation.status!=='dismissed'&&<>
          <button type="button" disabled={deviceLocation.status==='loading'}
            onClick={()=>void requestDeviceLocation()}>
            {deviceLocation.status==='loading'?'Checking…':'Use my location'}
          </button>
          <button type="button" onClick={dismissDeviceLocation}>Not now</button>
        </>}
        <Link to="/explore">Choose an area instead</Link>
      </div>
    </details>
    <footer className="welcome-footer">
      <p>Search uses reviewed public sources. inEkiti Official operates independently
        of Ekiti State Government. Government report delivery and live submissions
        are not enabled yet.</p>
    </footer>
  </main>;
}
