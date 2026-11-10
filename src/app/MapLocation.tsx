import * as React from 'react';

export default function MapLocation({
  onPoint,
}: {
  onPoint: (lat: number, lon: number) => void;
}) {
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    let cancelled = false;
    let map: { clear: () => void; resize: () => void; destroy: () => void } | undefined;
    import('../web/map.ts').then(({ openMap }) => {
      if (cancelled) return;
      map = openMap(onPoint, () => {
        if (!cancelled) setError('The map is unavailable. You can still choose a local government area.');
      });
      map.resize();
    }).catch(() => {
      if (!cancelled) setError('The map could not load. Try the area selector instead.');
    });
    return () => { cancelled = true; map?.destroy(); };
  }, [onPoint]);
  return (
    <div className="map-region">
      <div id="map" aria-label="Map of Ekiti local government boundaries" />
      <p className="note" role={error ? 'alert' : undefined}>
        {error || 'Tap to choose an incident point. Coordinates are not checked until you confirm.'}
      </p>
      <p className="metadata">LGA boundaries © eHealth Africa and Proxy Logics / GRID3 (2020), CC BY 4.0.</p>
    </div>
  );
}
