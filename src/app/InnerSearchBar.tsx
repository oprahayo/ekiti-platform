import * as React from 'react';
import {useNavigate} from 'react-router';
import {detectIntent} from './intents.ts';
import {useApp} from './state.tsx';
import {CivicProductIcon} from './CivicProductIcon.tsx';

/** Reusable public search on inner pages; private incident text never enters URLs. */
export default function InnerSearchBar() {
  const [query,setQuery]=React.useState('');
  const {setPendingReportText}=useApp();
  const navigate=useNavigate();
  const submit=(event:React.FormEvent)=>{
    event.preventDefault();
    const value=query.trim().replace(/\s+/gu,' ');
    if(value.length<2||value.length>100)return;
    const intent=detectIntent(value);
    if(intent.kind==='report'){
      setPendingReportText(value.length>=20?value:'');
      navigate('/report');return;
    }
    if(intent.kind==='track'){navigate('/track');return;}
    navigate('/search?'+new URLSearchParams({q:value}));
  };
  return <form className="inner-universal-search" role="search" onSubmit={submit}>
    <label className="visually-hidden" htmlFor="inner-ekiti-search">Search across Ekiti</label>
    <CivicProductIcon name="search" size={19}/>
    <input type="search" id="inner-ekiti-search" autoComplete="off"
      maxLength={100} value={query}
      onChange={event=>setQuery(event.target.value)}
      placeholder="Search Ekiti…" enterKeyHint="search"/>
    <button type="submit" disabled={query.trim().length<2} aria-label="Search from this page">
      Search
    </button>
  </form>;
}
