import * as React from 'react';
import type {ExternalWebResultSet} from '../server/external-web-search.ts';
import {CivicProductIcon} from './CivicProductIcon.tsx';

function safeLink(value:string):string|null {
  try {const u=new URL(value);return u.protocol==='https:'?u.href:null;}
  catch{return null;}
}
export default function ExternalWebResults({query}:{query:string}) {
  const [state,setState]=React.useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
  const [data,setData]=React.useState<ExternalWebResultSet|null>(null);
  const abort=React.useRef<AbortController|null>(null);
  React.useEffect(()=>{
    abort.current?.abort();
    abort.current=null;
    setData(null);setState('idle');
    return()=>abort.current?.abort();
  },[query]);

  const search=()=>{
    abort.current?.abort();
    const controller=new AbortController();
    abort.current=controller;
    setState('loading');setData(null);
    void fetch('/api/web-search?'+new URLSearchParams({q:query}),{
      headers:{Accept:'application/json'},signal:controller.signal,
    }).then(async response=>{
      if(!response.ok)throw new Error('Provider unavailable');
      return response.json() as Promise<ExternalWebResultSet>;
    }).then(value=>{
      if(controller.signal.aborted)return;
      if(value.query!==query||value.verifiedByEkitiCivic!==false||
        !Array.isArray(value.results)||value.provider!=='Brave Search')
        throw new Error('Unexpected provider response');
      setData(value);setState('ready');
    }).catch(()=>{
      if(!controller.signal.aborted){setData(null);setState('unavailable');}
    });
  };
  const publicQuery=/\bekiti\b/i.test(query)?query:'Ekiti State Nigeria '+query;
  const google='https://www.google.com/search?'+new URLSearchParams({q:publicQuery});
  const brave='https://search.brave.com/search?'+new URLSearchParams({q:publicQuery});

  return <section className="search-web-section" aria-labelledby="wider-web-title">
    <div className="search-web-heading">
      <span className="search-web-symbol"><CivicProductIcon name="web" size={20}/></span>
      <div><h2 id="wider-web-title">Explore the wider web</h2>
        <p>News, public websites and other platforms mentioning Ekiti.</p>
      </div>
    </div>
    <p className="search-web-privacy">Search terms are shared with an external provider only when you choose to search.
      Do not enter private reports, names, phone numbers or confidential details here.</p>
    {state==='idle' && <button type="button" className="search-web-action" onClick={search}>
      Find public web sources
    </button>}
    {state==='loading' && <p role="status" className="search-results-muted">Looking for relevant web sources…</p>}
    {state==='unavailable' && <p role="status" className="search-results-muted">
      In-page external discovery is not currently configured or is temporarily unavailable.
      You can still choose an external search engine below.
    </p>}
    {state==='ready' && data && <>
      <p className="search-web-attribution">Web results via {data.provider}. External pages are not independently verified by Ekiti Civic.</p>
      {data.results.length===0
        ? <p className="search-results-muted">No matching external pages were returned for this public search.</p>
        : <div className="search-web-list">{data.results.map(item=>
            <article key={item.url} className="search-web-result">
              <p className="search-web-domain">{item.domain}</p>
              <h3><a href={safeLink(item.url)||'#'} target="_blank" rel="noopener noreferrer">{item.title}</a></h3>
              {item.description&&<p className="search-web-description">{item.description}</p>}
              <small>External web page · Verify important claims at the source</small>
            </article>)}</div>}
      <button className="search-web-action search-web-refresh" type="button" onClick={search}>Refresh web results</button>
    </>}
    <nav className="search-web-alternatives" aria-label="Other web search engines">
      <span>Continue outside Ekiti Civic:</span>
      <a href={google} target="_blank" rel="noopener noreferrer">Google Search</a>
      <a href={brave} target="_blank" rel="noopener noreferrer">Brave Search</a>
    </nav>
  </section>;
}
