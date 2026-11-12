import * as React from 'react';
import { Link } from 'react-router';
import { demoPlaces, lgas } from './fixtures.ts';
import { DirectoryIcon, categoryForGroup, directoryCategories } from './DirectoryCategories.tsx';
import { useApp } from './state.tsx';
import NearbyDirectorySearch from './NearbyDirectorySearch.tsx';
import {findSourcedExamples} from './sourced-examples.ts';
import SourcedPlaceExamples from './SourcedPlaceExamples.tsx';
import './explore-map-first.css';

const EkitiDirectoryMap = React.lazy(() => import('./EkitiDirectoryMap.tsx'));


interface ReviewedPlace {
  id: string;
  name: string;
  category: string;
  lga_id: string;
  description: string;
  address_text: string;
  contact_phone: string | null;
  website_url: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  owner_claim_state: string;
  source_url: string;
  publisher: string;
  reviewed_at: string;
}
type LoadState = 'idle' | 'loading' | 'ready' | 'unavailable' | 'unclassified';

export default function ExploreDirectory() {
  const {
    exploreService, setExploreService, exploreCategory, setExploreCategory,
    exploreQuery, setExploreQuery, exploreLga, setExploreLga,
    deviceLocation, requestDeviceLocation, selectManualArea,
  } = useApp();
  const [places, setPlaces] = React.useState<ReviewedPlace[]>([]);
  const [loadState, setLoadState] = React.useState<LoadState>('idle');


  const activeCategory = React.useMemo(() =>
    exploreService
      ? directoryCategories.find(category => category.id === exploreService)
      : categoryForGroup(exploreCategory),
  [exploreService, exploreCategory]);
  const query = exploreQuery.trim().toLocaleLowerCase();
  const browseOnly = !activeCategory && !query && !exploreLga;
  const visibleCategories = React.useMemo(() => {
    if (activeCategory) return [activeCategory];
    if (!query) return directoryCategories;
    return directoryCategories.filter(category =>
      (category.label + ' ' + category.keywords).toLocaleLowerCase().includes(query));
  }, [activeCategory, query]);

  // Read-only, reviewed listings: pending imports, claims, photos and unreviewed
  // geocoordinates remain inaccessible through the database's public functions.
  React.useEffect(() => {
    if (browseOnly) {
      setPlaces([]);
      setLoadState('idle');
      return;
    }
    if (activeCategory && !activeCategory.group) {
      setPlaces([]);
      setLoadState('unclassified');
      return;
    }
    const params = new URLSearchParams();
    if (activeCategory?.group) params.set('category', activeCategory.group);
    if (exploreLga) params.set('lga', exploreLga);
    if (query) params.set('q', query);
    params.set('limit', '20');

    const controller = new AbortController();
    setPlaces([]);
    setLoadState('loading');
    fetch('/api/places?' + params.toString(), { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Directory is not yet active');
        return response.json() as Promise<{ items?: ReviewedPlace[]; reviewedOnly?: boolean }>;
      })
      .then(data => {
        if (!data.reviewedOnly || !Array.isArray(data.items)) throw new Error('Unverified response');
        setPlaces(data.items);
        setLoadState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setPlaces([]);
          setLoadState('unavailable');
        }
      });
    return () => controller.abort();
  }, [activeCategory, browseOnly, exploreLga, query]);

  const preview = React.useMemo(() => demoPlaces.filter(place => {
    if (activeCategory && (!activeCategory.group || place.category !== activeCategory.group)) return false;
    if (exploreLga && place.lgaId !== exploreLga) return false;
    if (!query) return true;
    const group = directoryCategories.find(category => category.group === place.category);
    const haystack = [place.name, place.description, place.category, group?.label, group?.keywords]
      .filter(Boolean).join(' ').toLocaleLowerCase();
    return haystack.includes(query);
  }), [activeCategory, exploreLga, query]);

  const visibleSourcedExamples = activeCategory && !activeCategory.group
    ? []
    : findSourcedExamples(query, {category:activeCategory?.group||null,lgaId:exploreLga||null});

  const selectCategory = (id: typeof directoryCategories[number]['id']) => {
    const category = directoryCategories.find(item => item.id === id)!;
    setExploreService(id);
    setExploreCategory(category.group || 'All');
    setExploreQuery('');
  };
  const allCategories = () => {
    setExploreService(null);
    setExploreCategory('All');
    setExploreQuery('');
  };
  const clearFilters = () => {
    allCategories();
    selectManualArea('');
  };

  return <main className="page explore-page directory-page directory-map-first-page" id="main">
    <section className="directory-hero" aria-label="Browse Ekiti">
      <header className="directory-header">
        <h1>Explore Ekiti</h1>
        <p>Find places and services on the map, then choose what you need.</p>
      </header>
      <div className="directory-search-row">
        <div className="directory-search">
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"
            fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>
          </svg>
          <label htmlFor="place-search" className="visually-hidden">Search services and places</label>
          <input id="place-search" type="search" autoComplete="off" value={exploreQuery}
            placeholder="Hotels, services, places…"
            onChange={event => {
              setExploreQuery(event.target.value);
              setExploreService(null);
              setExploreCategory('All');
            }} />
        </div>
        <button type="button" className="directory-nearby" disabled={deviceLocation.status === 'loading'}
          onClick={() => void requestDeviceLocation()}>
          <span aria-hidden="true">⌖</span>
          <span>{deviceLocation.status === 'loading' ? 'Checking' : 'Near me'}</span>
        </button>
      </div>
      {deviceLocation.status !== 'prompt' && <p className={'directory-location-summary directory-location-' + deviceLocation.status} role="status">
        {deviceLocation.message}
      </p>}
    </section>
    <div className="directory-map-first-stage" aria-label="Ekiti map and directory categories">
      <React.Suspense fallback={<div className="directory-map-loading" role="status">Opening Ekiti map…</div>}>
        <EkitiDirectoryMap places={loadState==='ready'?places:[]}
          selectedLga={exploreLga} onSelectLga={selectManualArea}/>
      </React.Suspense>
      <div className="directory-map-sheet">
        <p className="directory-map-sheet-intro">
          Choose a category to see reviewed places across Ekiti. The map stays in view.
        </p>
    {activeCategory && <button type="button" className="directory-back" onClick={allCategories}>
      <span aria-hidden="true">←</span> Browse all categories
    </button>}

    <section aria-label="Directory categories" className="directory-categories">
      {!activeCategory && <div className="directory-section-title">
        <h2>Explore services</h2><span>{visibleCategories.length} categories</span>
      </div>}
      {visibleCategories.length > 0 ? <div className={'directory-grid' + (activeCategory ? ' directory-grid-selected' : '')}>
        {visibleCategories.map(category => <button type="button"
          key={category.id} className="directory-category-tile"
          aria-pressed={activeCategory?.id === category.id}
          aria-label={category.label}
          onClick={() => {
            if (activeCategory?.id === category.id) allCategories();
            else selectCategory(category.id);
          }}>
          <DirectoryIcon name={category.id} />
          <span>{category.label}</span>
        </button>)}
      </div> : <p className="directory-not-found" role="status">
        No matching category. Try another service name or browse the full list.
      </p>}
    </section>

        <div className="directory-map-tools">
      <details className="directory-manual-area">
        <summary>Browse another area (optional)</summary>
        <div className="directory-area">
          <label htmlFor="explore-lga">Choose an LGA</label>
          <select id="explore-lga" value={exploreLga}
            onChange={event => selectManualArea(event.target.value)}>
            <option value="">All of Ekiti</option>
            {lgas.map(lga => <option key={lga.id} value={lga.id}>{lga.name}</option>)}
          </select>
        </div>
      </details>
      <NearbyDirectorySearch
        category={activeCategory?.group??null}
        lga={exploreLga||null}
        query={query||null}
        unsupported={Boolean(activeCategory&&!activeCategory.group)}/>
                    <details className="directory-nearby-explanation">
            <summary>Location and distance information</summary>
            <p>“Near me” filters by verified LGA, not distance. Use the separate verified nearby search for straight-line ranking.</p>
            <p>Location is optional; you can browse Ekiti without granting GPS access.</p>
          </details>
        </div>
      </div>
    </div>

    {!browseOnly && <section id="directory-results" className="directory-results" aria-label="Directory search results">
      <div className="directory-results-head">
        <h2>{activeCategory?.label || 'Search results'}</h2>
        <span>{exploreLga ? lgas.find(item => item.id === exploreLga)?.name : 'Across Ekiti'}</span>
      </div>
      <p className="directory-data-note">Listings appear only after source review. No unverified business is presented as a confirmed recommendation.</p>
      {loadState === 'loading' && <p role="status" className="note">Checking reviewed directory entries…</p>}
      {loadState === 'unavailable' && <p role="status" className="note">
        Reviewed directory search is not available on this deployment yet.
      </p>}
      {loadState === 'unclassified' && <p role="status" className="note">
        This service category is ready for browsing. Its live listings will be connected as the directory expands.
      </p>}
      {places.length > 0 && <div className="directory-verified-list">
        <h3>Reviewed directory entries</h3>
        <ul className="plain-list">
          {places.map(place => <li key={place.id}>
            <Link className="place-row" to={'/places/' + place.id}>
              <span className="directory-place-dot" aria-hidden="true"/>
              <span>
                <strong>{place.name}</strong>
                <small>{place.category} · {lgas.find(lga => lga.id === place.lga_id)?.name || 'Ekiti'} · Source: {place.publisher}</small>
              </span>
              <span aria-hidden="true">›</span>
            </Link>
          </li>)}
        </ul>
      </div>}
      {places.length === 0 && preview.length > 0 &&
        <div className="directory-preview">
          <h3>Sample layout preview <span>Not verified</span></h3>
          <ul className="plain-list">
            {preview.map(place => <li key={place.id}>
              <Link className="place-row" to={'/places/' + place.id}>
                <span className="directory-place-dot" aria-hidden="true"/>
                <span>
                  <strong>{place.name}</strong>
                  <small>Illustrative only · {lgas.find(lga => lga.id === place.lgaId)?.name} · No verified location</small>
                </span>
                <span aria-hidden="true">›</span>
              </Link>
            </li>)}
          </ul>
        </div>}
      {places.length === 0 && preview.length === 0 && loadState !== 'loading' &&
        <div className="empty-state" role="status">
          <h3>Nothing verified here yet</h3>
          <p>No reviewed business entries match these filters. This does not mean the service is unavailable in Ekiti.</p>
          <button type="button" className="text-link" onClick={clearFilters}>Clear filters</button>
        </div>}
    </section>}

    <SourcedPlaceExamples items={visibleSourcedExamples} context="explore"/>

    <div className="directory-secondary">
      <h2>Can’t find what you need?</h2>
      <Link to="/search" className="text-link">
        Search all of Ekiti
      </Link>
      <p className="directory-footer">Own a business? <a href="/listings/new">Prepare a listing</a> for future verification and moderation. Nothing is published automatically.</p>
      <p className="directory-independence">Independent civic project · Not a government service</p>
    </div>
  </main>;
}
