import * as React from 'react';
import type {SourcedPlaceExample} from './sourced-examples.ts';
import './sourced-place-examples.css';

interface Props {
  items: readonly SourcedPlaceExample[];
  context: 'explore' | 'search';
}

/**
 * Shows source-confirmed candidates separately from the reviewed PostGIS index.
 * These are real, linked institutions, but NOT platform-verified directory rows.
 */
export default function SourcedPlaceExamples({items,context}:Props) {
  if(items.length===0)return null;
  return <section className={'sourced-place-examples sourced-place-examples-'+context}
    aria-label="Source-confirmed Ekiti places">
    <h2>Places with public source links</h2>
    <p className="sourced-place-examples-disclosure">
      Source-confirmed examples, not approved Ekiti Civic directory entries.
      Current services, exact positions and business ownership have not been independently verified.
      Check each linked website before visiting.
    </p>
    <ul className="sourced-place-examples-list">
      {items.map(place=><li key={place.id} className="sourced-place-example">
        <article>
          <p className="sourced-place-example-domain">
            {new URL(place.sourceUrl).hostname} · Public source example
          </p>
          <h3><a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">
            {place.name}
          </a></h3>
          <p className="sourced-place-example-meta">{place.category} · {place.locality} · {place.lgaName} LGA</p>
          <p className="sourced-place-example-description">{place.description}</p>
          <p className="sourced-place-example-source">
            <a href={place.sourceUrl} target="_blank" rel="noopener noreferrer">
              Original source: {place.sourceLabel}
            </a>
            <span> · Website checked {place.checkedOn}</span>
          </p>
        </article>
      </li>)}
    </ul>
  </section>;
}
