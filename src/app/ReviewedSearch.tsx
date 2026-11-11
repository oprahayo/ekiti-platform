import * as React from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router';
import './reviewed-search.css';

interface Place {
  id: string;
  name: string;
  category: string;
  lga_id: string;
  description: string;
  address_text: string;
  source_url: string;
  publisher: string;
  reviewed_at: string;
}
interface Knowledge {
  id: string;
  title: string;
  summary_en: string;
  subject: string;
  framing: string;
  source_url: string;
  publisher: string;
  published_on: string | null;
}
interface SearchResponse {
  query: string;
  reviewedOnly: true;
  places: Place[];
  knowledge: Knowledge[];
}
type SearchState = 'idle' | 'loading' | 'ready' | 'unavailable';

function safeSource(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {return null;}
}

export default function ReviewedSearch() {
  const [params] = useSearchParams();
  const query = (params.get('q') || '').trim();
  const [draft,setDraft] = React.useState(query);
  const [state,setState] = React.useState<SearchState>('idle');
  const [data,setData] = React.useState<SearchResponse|null>(null);
  const [error,setError] = React.useState('');
  const navigate = useNavigate();

  React.useEffect(()=>setDraft(query),[query]);
  React.useEffect(()=>{
    if(query.length < 2 || query.length > 100) {
      setData(null);
      setState('idle');
      return;
    }
    const abort = new AbortController();
    setData(null);
    setState('loading');
    void fetch('/api/search?'+new URLSearchParams({q:query}).toString(), {
      signal:abort.signal,headers:{Accept:'application/json'},
    }).then(async response=>{
      if(!response.ok)throw new Error('Public search is unavailable');
      return response.json() as Promise<Partial<SearchResponse>>;
    }).then(result=>{
      if(!result.reviewedOnly || !Array.isArray(result.places) ||
         !Array.isArray(result.knowledge) || result.query !== query)
        throw new Error('Unexpected search response');
      if(abort.signal.aborted)return;
      setData(result as SearchResponse);
      setState('ready');
    }).catch(()=>{
      if(abort.signal.aborted)return;
      setData(null);
      setState('unavailable');
    });
    return ()=>abort.abort();
  },[query]);

  const submit=(event:React.FormEvent)=>{
    event.preventDefault();
    const value=draft.trim();
    if(value.length < 2 || value.length > 100) {
      setError('Enter at least two characters to search Ekiti.');
      return;
    }
    setError('');
    navigate('/search?'+new URLSearchParams({q:value}).toString());
  };

  return <main className="page search-results-page" id="main">
    <div className="search-results-intro">
      <h1>Search Ekiti</h1>
      <p>Find reviewed businesses, services, places and sourced public information.</p>
    </div>
    <form className="search-results-form" role="search" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="ekiti-unified-search">Search Ekiti</label>
      <input id="ekiti-unified-search" type="search" maxLength={100} autoComplete="off"
        value={draft} onChange={event=>setDraft(event.target.value)}
        placeholder="Search places, services or public information" />
      <button type="submit">Search</button>
    </form>
    {error && <p role="alert" className="search-results-error">{error}</p>}
    <nav className="search-results-shortcuts" aria-label="Explore more">
      <Link to="/explore">Browse categories</Link>
      <Link to="/listings/new">Suggest a business</Link>
      <Link to="/report">Report an issue</Link>
    </nav>

    {state==='idle' && <p className="search-results-muted" role="status">
      Enter a place, service, business or civic topic to begin.
    </p>}
    {state==='loading' && <p className="search-results-muted" role="status">Searching reviewed Ekiti records…</p>}
    {state==='unavailable' && <p className="search-results-muted" role="alert">
      Verified search is temporarily unavailable. No sample listings are substituted.
    </p>}
    {state==='ready' && data && <div className="search-results-content">
      <p className="search-results-count" role="status">
        {data.places.length + data.knowledge.length} reviewed result{data.places.length+data.knowledge.length===1?'':'s'} shown for “{data.query}”
      </p>
      {data.places.length===0 && data.knowledge.length===0 && <p className="search-results-muted">
        No reviewed result matches yet. The directory is growing; this does not mean the service or place does not exist.
        Try a simpler name, or <Link to="/explore">browse Ekiti categories</Link>.
      </p>}
      {data.places.length>0 && <section className="search-results-section" aria-labelledby="search-places">
        <h2 id="search-places">Businesses, services and places</h2>
        <div className="search-results-list">{data.places.map(item=>
          <article className="search-result" key={'place-'+item.id}>
            <h3><Link to={'/places/'+item.id}>{item.name}</Link></h3>
            <p className="search-result-meta">{item.category} · {item.address_text || item.lga_id}</p>
            {item.description && <p>{item.description}</p>}
            <p className="search-result-source">
              {safeSource(item.source_url)
                ? <a href={safeSource(item.source_url)!} target="_blank" rel="noopener noreferrer">
                  Source: {item.publisher}</a>
                : 'Source reference unavailable'}
            </p>
          </article>)}</div>
      </section>}
      {data.knowledge.length>0 && <section className="search-results-section" aria-labelledby="search-knowledge">
        <h2 id="search-knowledge">Ekiti knowledge and public information</h2>
        <div className="search-results-list">{data.knowledge.map(item=>
          <article className="search-result" key={'knowledge-'+item.id}>
            <h3>{safeSource(item.source_url)
              ? <a href={safeSource(item.source_url)!} target="_blank" rel="noopener noreferrer">{item.title}</a>
              : item.title}</h3>
            <p className="search-result-meta">{item.subject} · {item.publisher}</p>
            <p>{item.summary_en}</p>
            {item.framing === 'allegation' || item.framing === 'opinion'
              ? <p className="search-result-source">Source claim or opinion; not independently verified by inEkiti Official.</p>
              : <p className="search-result-source">Reviewed public source · not a government endorsement</p>}
          </article>)}</div>
      </section>}
    </div>}
    <p className="search-results-disclosure">
      Only approved public records are searchable. Private reports and pending business submissions are excluded.
      inEkiti Official operates independently of Ekiti State Government.
    </p>
  </main>;
}
