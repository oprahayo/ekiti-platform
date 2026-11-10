import './style.css';
import type { Resolution, CandidateInput } from '../geo/types.ts';
import type { openMap } from './map.ts';

interface Area {
  id: string;
  name: string;
  kind: 'lga' | 'ward' | 'settlement';
  parentId: string;
}
type Result = Resolution & Pick<CandidateInput, 'stateBoundaryStatus' | 'stateOnBoundary'>;
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
let areas: Area[] = [];
let result: Result | null = null;
let autoLga = false;
let version = 0;
let map: ReturnType<typeof openMap> | undefined;
let pending: AbortController | undefined;
const latitude = el<HTMLInputElement>('lat');
const longitude = el<HTMLInputElement>('lon');
const place = el<HTMLInputElement>('place');
const pointStatus = el('point-status');

function searchable(label: string, id: string, placeholder: string, onChange: () => void) {
  const heading = document.createElement('label');
  heading.htmlFor = id;
  heading.textContent = label;
  const search = document.createElement('input');
  search.type = 'search';
  search.placeholder = 'Filter names…';
  search.setAttribute('aria-label', 'Filter ' + label);
  const select = document.createElement('select');
  select.id = id;
  if (id === 'ward') select.setAttribute('aria-describedby', 'ward-help');
  const row = document.createElement('div');
  row.className = 'filter-row';
  row.append(search, select);
  el('fields').append(heading, row);
  let options: Area[] = [];
  function render(value: string) {
    const term = search.value.trim().toLocaleLowerCase();
    const visible = options.filter(
      (a) => a.id === value || a.name.toLocaleLowerCase().includes(term),
    );
    select.replaceChildren(
      new Option(term && !visible.length ? 'No matching names' : placeholder, ''),
      ...visible.map((a) => new Option(a.name, a.id)),
    );
    select.value = value;
  }
  search.oninput = () => render(select.value);
  select.onchange = onChange;
  return {
    get value() {
      return select.value;
    },
    set(rows: Area[], value = '') {
      options = rows;
      search.value = '';
      search.disabled = select.disabled = !rows.length;
      render(value);
    },
  };
}
const lga = searchable('Local government area', 'lga', 'Choose an LGA', () => {
  autoLga = false;
  updateChildren();
  summary();
});
const ward = searchable('Electoral ward (optional)', 'ward', 'Choose a ward', summary);
function updateChildren() {
  const wards = areas.filter((a) => a.kind === 'ward' && a.parentId === lga.value);
  ward.set(wards);
  el('ward-help').textContent = !lga.value
    ? 'Choose an LGA to see its wards.'
    : wards.length
      ? 'Choose a ward only if you know it.'
      : 'No verified ward names are available for this LGA.';
  const options = areas.filter((a) => a.kind === 'settlement' && a.parentId === lga.value);
  el('settlements').replaceChildren(...options.map((a) => new Option(a.name)));
  el('place-hint').textContent = options.length
    ? 'Choose a listed settlement or describe the place yourself.'
    : 'No verified settlement list is available here. You can enter your own description.';
}

function summary() {
  const selected = areas.find((a) => a.id === lga.value);
  el('summary-lga').textContent = selected
    ? selected.name + (autoLga ? ' · boundary match' : ' · manual')
    : 'None selected';
  el('summary-ward').textContent = areas.find((a) => a.id === ward.value)?.name || 'Unspecified';
  el('summary-place').textContent = place.value.trim() || 'Unspecified';
  const evidence = el('evidence');
  if (!result) {
    evidence.textContent = 'No incident position confirmed.';
    return;
  }
  const match = result.lga.match;
  let message = 'No verified LGA covers this point. You can select an area manually.';
  if (result.lga.status === 'outside_scope')
    message = 'This point falls outside the verified Ekiti state boundary.';
  else if (result.lga.status === 'ambiguous')
    message =
      'This point overlaps multiple LGAs: ' +
      result.lga.candidates.map((a) => a.name).join(', ') +
      '. Check the position or choose manually.';
  else if (match) {
    message = 'Boundary lookup: ' + match.name + '.';
    if (result.stateOnBoundary || match.onBoundary)
      message += ' The point lies on a boundary. Check the position.';
    if (selected && match.id !== selected.id)
      message += ' Your manual LGA differs from this match.';
  }
  if (result.stateBoundaryStatus === 'unknown') message += ' State coverage is uncertain.';
  evidence.textContent = message + ' Electoral ward selection is manual.';
}

function matchedLgaId() {
  const match = result?.lga.match;
  if (
    !match ||
    match.onBoundary ||
    result?.stateBoundaryStatus !== 'inside' ||
    result.stateOnBoundary
  )
    return '';
  return areas.some((a) => a.kind === 'lga' && a.id === match.id) ? match.id : '';
}

async function directory() {
  el('retry').hidden = true;
  try {
    const response = await fetch('/api/areas');
    if (!response.ok) throw Error();
    areas = await response.json();
    const lgas = areas.filter((a) => a.kind === 'lga');
    const id = matchedLgaId();
    autoLga = Boolean(id);
    lga.set(lgas, id);
    updateChildren();
    summary();
    el('directory-status').textContent = lgas.length ? '' : 'No verified areas are available.';
  } catch {
    el('directory-status').textContent =
      'The area directory is unavailable. You can still describe a place.';
    el('retry').hidden = false;
  }
}
el('retry').onclick = directory;
lga.set([]);
updateChildren();
void directory();
place.oninput = summary;

function invalidate() {
  version++;
  pending?.abort();
  result = null;
  if (autoLga) {
    autoLga = false;
    lga.set(areas.filter((a) => a.kind === 'lga'));
    updateChildren();
  }
  map?.clear();
  pointStatus.textContent = '';
  el('clear').hidden = !(latitude.value || longitude.value);
  summary();
}
function setPoint(lat: number, lon: number) {
  latitude.value = String(lat);
  longitude.value = String(lon);
  invalidate();
  map?.pin(lat, lon);
  pointStatus.textContent =
    'Position selected. Confirm only if this is where the incident happened.';
}
latitude.oninput = longitude.oninput = invalidate;
el('clear').onclick = () => {
  latitude.value = longitude.value = '';
  invalidate();
};
el('gps').onclick = () => {
  const current = ++version;
  if (!navigator.geolocation) {
    pointStatus.textContent = 'GPS is unavailable. Enter coordinates or select an area.';
    return;
  }
  pointStatus.textContent = 'Waiting for device location…';
  navigator.geolocation.getCurrentPosition(
    (p) => {
      if (current !== version) return;
      setPoint(p.coords.latitude, p.coords.longitude);
      pointStatus.textContent =
        'Device position found (accuracy about ' +
        Math.round(p.coords.accuracy) +
        ' m). Confirm only if the incident happened here.';
    },
    () => {
      if (current === version)
        pointStatus.textContent =
          'Device location unavailable. You can enter coordinates or select an area.';
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
  );
};

el('coords').onsubmit = async (event) => {
  event.preventDefault();
  const lat = latitude.valueAsNumber,
    lon = longitude.valueAsNumber;
  // Rechecking an unchanged point preserves the citizen's manual ward.
  pending?.abort();
  const current = ++version;
  map?.pin(lat, lon);
  pending = new AbortController();
  pointStatus.textContent = 'Checking verified boundaries…';
  try {
    const response = await fetch('/api/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lon, confirmed: true }),
      signal: pending.signal,
    });
    if (!response.ok) throw Error(String(response.status));
    const lookup: Result = await response.json();
    if (current !== version) return;
    result = lookup;
    const id = matchedLgaId();
    if ((!lga.value || autoLga) && id !== lga.value) {
      lga.set(
        areas.filter((a) => a.kind === 'lga'),
        id,
      );
      autoLga = Boolean(id);
      updateChildren();
    }
    summary();
    pointStatus.textContent = 'Position checked. The result appears under Your selection.';
  } catch (error) {
    if (current === version)
      pointStatus.textContent =
        error instanceof Error && error.message === '429'
          ? 'Too many checks. Please wait a minute.'
          : 'Boundary lookup unavailable. Retry or select the area manually.';
  }
};
const mapButton = el<HTMLButtonElement>('open-map');
const mapBox = el('map-box');
mapButton.onclick = async () => {
  const opening = mapBox.hidden;
  mapBox.hidden = !opening;
  mapButton.setAttribute('aria-expanded', String(opening));
  mapButton.textContent = opening ? 'Hide Ekiti map' : 'Open Ekiti map';
  if (!opening) return;
  const unavailable = () => {
    pointStatus.textContent = 'Map unavailable. Enter coordinates or use the area directory.';
  };
  try {
    mapButton.disabled = true;
    if (!map) map = (await import('./map.ts')).openMap(setPoint, unavailable);
    map.resize();
    if (latitude.value && longitude.value && latitude.validity.valid && longitude.validity.valid)
      map.pin(latitude.valueAsNumber, longitude.valueAsNumber);
  } catch {
    unavailable();
    mapBox.hidden = true;
    mapButton.textContent = 'Retry Ekiti map';
    mapButton.setAttribute('aria-expanded', 'false');
  } finally {
    mapButton.disabled = false;
  }
};
