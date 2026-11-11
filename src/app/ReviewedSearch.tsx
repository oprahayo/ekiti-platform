import * as React from 'react';
import {Link, useNavigate, useSearchParams} from 'react-router';
import {useApp} from './state.tsx';
import {detectIntent} from './intents.ts';
import type {AskResult} from '../server/ask-knowledge.ts';
import './reviewed-search.css';
const ExternalWebResults=React.lazy(()=>import('./ExternalWebResults.tsx'));

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
  localityHint?: {name:string;lgaId:string;lgaName:string;source:string;confidence:'reviewed-place-name'} | null;
  locationScope?: 'specific-place'|'lga'|'none'|'ambiguous';
}
type SearchState = 'idle' | 'loading' | 'ready' | 'unavailable';
const questionPattern=/^(who|what|why|where|when|how|which|is|are|can|does|do|tell me|explain)\b/i;
export function isPublicQuestion(value:string):boolean {
  return questionPattern.test(value.trim()) && detectIntent(value).kind!=='report' &&
    detectIntent(value).kind!=='track';
}

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
  const [tab,setTab]=React.useState<'all'|'places'|'knowledge'|'web'>('all');
  const [state,setState] = React.useState<SearchState>('idle');
  const [data,setData] = React.useState<SearchResponse|null>(null);
  const [error,setError] = React.useState('');
  const [answer,setAnswer] = React.useState<AskResult|null>(null);
  const [answerState,setAnswerState]=React.useState<'idle'|'loading'|'ready'|'unavailable'>('idle');
  const {language,setPendingReportText}=useApp();
  const navigate = useNavigate();

  React.useEffect(()=>{setDraft(query);setTab('all');},[query]);
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

  React.useEffect(()=>{
    setAnswer(null);
    if(query.length<2||query.length>100||!isPublicQuestion(query)){
      setAnswerState('idle');return;
    }
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),9000);
    setAnswerState('loading');
    void fetch('/api/ask',{
      method:'POST',signal:controller.signal,cache:'no-store',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({question:query,language}),
    }).then(async response=>{
      if(!response.ok)throw new Error('No answer available');
      return response.json() as Promise<AskResult>;
    }).then(value=>{
      if(controller.signal.aborted)return;
      if(typeof value.answer!=='string'||!Array.isArray(value.sources))
        throw new Error('Untrusted answer payload');
      setAnswer(value);setAnswerState('ready');
    }).catch(()=>{
      if(!controller.signal.aborted)setAnswerState('unavailable');
    }).finally(()=>clearTimeout(timer));
    return()=>{clearTimeout(timer);controller.abort();};
  },[query,language]);

  const submit=(event:React.FormEvent)=>{
    event.preventDefault();
    const value=draft.trim();
    if(value.length < 2 || value.length > 100) {
      setError('Enter at least two characters to search Ekiti.');
      return;
    }
    setError('');
    const intent=detectIntent(value);
    if(intent.kind==='report'){
      setPendingReportText(value.length>=20?value:'');
      navigate('/report');return;
    }
    if(intent.kind==='track'){navigate('/track');return;}
    navigate('/search?'+new URLSearchParams({q:value,web:'1'}).toString());
  };

  return <main className="page search-results-page" id="main">
    <div className="search-results-intro">
      <h1>Search Ekiti</h1>
      <p>Reviewed Ekiti Civic information first, then Ekiti-relevant public websites with original references.</p>
    </div>
    <form className="search-results-form" role="search" onSubmit={submit}>
      <label className="visually-hidden" htmlFor="ekiti-unified-search">Search Ekiti</label>
      <input id="ekiti-unified-search" type="search" maxLength={100} autoComplete="off"
        value={draft} onChange={event=>setDraft(event.target.value)}
        placeholder="Search places, services or public information" />
      <button type="submit">Search</button>
    </form>
    {error && <p role="alert" className="search-results-error">{error}</p>}
    <nav className="search-category-tabs" role="tablist" aria-label="Search result categories">
      {([
        ['all','All results'],['places','Places & services'],
        ['knowledge','Ekiti information'],['web','Wider web'],
      ] as const).map(([value,label])=><button type="button" role="tab"
        key={value} aria-selected={tab===value}
        onClick={()=>setTab(value)}>{label}</button>)}
    </nav>
    <nav className="search-results-shortcuts" aria-label="Explore more">
      <Link to="/explore">Browse categories</Link>
      <Link to="/listings/new">Suggest a business</Link>
      <Link to="/report">Report an issue</Link>
    </nav>

    {tab==='web'&&query.length>=2&&query.length<=90&&
      <React.Suspense fallback={<p role="status">Loading web tools…</p>}>
        <ExternalWebResults query={query}/>
      </React.Suspense>}
    {tab!=='web'&&state==='idle' && <p className="search-results-muted" role="status">
      Enter a place, service, business or civic topic to begin.
    </p>}
    {tab!=='web'&&state==='loading' && <p className="search-results-muted" role="status">Searching reviewed Ekiti records…</p>}
    {tab!=='web'&&state==='unavailable' && <p className="search-results-muted" role="alert">
      Verified search is temporarily unavailable. No sample listings are substituted.
    </p>}

    {(tab==='all'||tab==='knowledge')&&isPublicQuestion(query) && <section className="search-answer" aria-labelledby="source-answer-title">
      <h2 id="source-answer-title">Answer from Ekiti sources</h2>
      {answerState==='loading' && <p role="status">Checking available sources…</p>}
      {answerState==='unavailable' && <p role="status">An answer is unavailable. You can still browse the search results below.</p>}
      {answerState==='ready' && answer && <>
        <p className="search-answer-text" lang={answer.language}>{answer.answer}</p>
        <p className="search-answer-meta">{answer.confidence==='source-backed'?'Source-backed summary':'Limited source coverage'} · Checked {answer.checkedAt.slice(0,10)}</p>
        {answer.sources.length>0 && <div className="search-answer-sources">
          <strong>Sources</strong>
          <ul>{answer.sources.map(source=><li key={source.url}>
            {safeSource(source.url)?<a href={safeSource(source.url)!} target="_blank"
              rel="noopener noreferrer">{source.title}</a>:source.title}
          </li>)}</ul>
        </div>}
        {answer.limitation&&<p className="search-answer-limitation">{answer.limitation}</p>}
      </>}
    </section>}
    {tab!=='web'&&state==='ready' && data && <div className="search-results-content">
      <p className="search-results-count" role="status">
        {data.places.length + data.knowledge.length + (data.localityHint?1:0)} reviewed result{data.places.length+data.knowledge.length+(data.localityHint?1:0)===1?'':'s'} shown for “{data.query}”
      </p>
      {(tab==='all'||tab==='places')&&data.localityHint && <section className="search-results-section" aria-labelledby="search-locality">
        <h2 id="search-locality">Recognized place</h2>
        <article className="search-result search-locality-result">
          <h3>{data.localityHint.name}</h3>
          <p>Likely local government area: {data.localityHint.lgaName}.</p>
          <p className="search-result-meta">Based on a reviewed public place-name source; not GPS verification or a promise of nearby results.</p>
          {safeSource(data.localityHint.source) && <p className="search-result-source">
            <a href={safeSource(data.localityHint.source)!} rel="noopener noreferrer" target="_blank">View location source</a>
          </p>}
        </article>
      </section>}
      {(tab==='all'||tab==='places')&&data.locationScope==='ambiguous' && <p className="search-results-muted">
        This query mentions places in different LGAs. A single location was not assumed.
      </p>}
      {data.places.length===0 && data.knowledge.length===0 && !data.localityHint && <p className="search-results-muted">
        No reviewed result matches yet. The directory is growing; this does not mean the service or place does not exist.
        Try a simpler name, or <Link to="/explore">browse Ekiti categories</Link>.
      </p>}
      {(tab==='all'||tab==='places')&&data.places.length>0 && <section className="search-results-section" aria-labelledby="search-places">
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
      {(tab==='all'||tab==='knowledge')&&data.knowledge.length>0 && <section className="search-results-section" aria-labelledby="search-knowledge">
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
    {tab==='all'&&query.length>=2&&query.length<=90&&
      <React.Suspense fallback={<p role="status">Loading web tools…</p>}>
        <ExternalWebResults query={query} autoRead={params.get('web')==='1'}/>
      </React.Suspense>}
    <p className="search-results-disclosure">
      In-platform results use reviewed public records. Wider-web links are external and not independently verified.
      Private reports and pending listings are excluded. inEkiti Official is independent of Ekiti State Government.
    </p>
  </main>;
}
