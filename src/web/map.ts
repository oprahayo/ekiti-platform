import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import boundaries from '../../data/grid3/lga.json?url';

export function openMap(onPoint: (lat: number, lon: number) => void, onError: () => void) {
  maplibregl.setWorkerUrl(new URL(workerUrl, location.href).href);
  const map = new maplibregl.Map({
    container: 'map',
    bounds: [
      [4.8, 7.24],
      [5.85, 8.15],
    ],
    fitBoundsOptions: { padding: 18 },
    attributionControl: false,
    style: {
      version: 8,
      sources: { lgas: { type: 'geojson', data: boundaries } },
      layers: [
        { id: 'background', type: 'background', paint: { 'background-color': '#eff2e9' } },
        { id: 'areas', type: 'fill', source: 'lgas', paint: { 'fill-color': '#b9d0ab' } },
        {
          id: 'borders',
          type: 'line',
          source: 'lgas',
          paint: { 'line-color': '#456955', 'line-width': 1.5 },
        },
        {
          id: 'names',
          type: 'symbol',
          source: 'lgas',
          layout: { 'text-field': ['get', 'lganame'], 'text-size': 12 },
          paint: { 'text-color': '#223e30', 'text-halo-color': '#edf2e6', 'text-halo-width': 1 },
        },
      ],
    },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
  const marker = new maplibregl.Marker({ color: '#a14620' });
  map.on('click', ({ lngLat }) => onPoint(lngLat.lat, lngLat.lng));
  map.on('error', onError);
  return {
    pin(lat: number, lon: number) {
      marker.setLngLat([lon, lat]).addTo(map);
    },
    clear() {
      marker.remove();
    },
    resize() {
      map.resize();
    },
  };
}
