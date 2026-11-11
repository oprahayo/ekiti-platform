import * as React from 'react';
import type {ReviewedMapPin} from '../web/map.ts';

const NO_PINS:readonly ReviewedMapPin[]=[];
interface Props {
  onPoint?:(lat:number,lon:number)=>void;
  pins?:readonly ReviewedMapPin[];
  mode?:'incident'|'directory'|'public';
}
export default function MapLocation({onPoint,pins=NO_PINS,mode='incident'}:Props){
  const container=React.useRef<HTMLDivElement|null>(null);
  const onPointRef=React.useRef(onPoint);
  onPointRef.current=onPoint;
  const [error,setError]=React.useState('');
  React.useEffect(()=>{
    let cancelled=false;
    let controller:{resize:()=>void;destroy:()=>void}|null=null;
    const node=container.current;
    if(!node)return;
    setError('');
    import('../web/map.ts').then(({createEkitiMap})=>{
      if(cancelled)return;
      controller=createEkitiMap({
        container:node,
        onPoint:onPointRef.current
          ?(lat,lon)=>onPointRef.current?.(lat,lon):undefined,
        onError:()=>{if(!cancelled)setError('The map could not render. Use the LGA selector instead.');},
        pins,
      });
      controller.resize();
    }).catch(()=>{if(!cancelled)setError('Map unavailable. The ordinary area selector still works.');});
    return()=>{cancelled=true;controller?.destroy();};
  },[pins,Boolean(onPoint)]);
  return <div className={'map-region ekiti-map-'+mode}>
    <div ref={container} id="map" className="ekiti-map-canvas"
      aria-label={mode==='incident'
        ?'Ekiti LGA map. Choose an incident location only if you wish.'
        :'Ekiti LGA boundary map with reviewed directory entries'} />
    {error&&<p className="note" role="alert">{error}</p>}
    {!error&&<p className="note">
      {mode==='incident'
        ?'Optional: tap the map to choose an incident point, then explicitly check it. Selecting a point does not send a report or dispatch emergency services.'
        :mode==='directory'
          ?pins.length
            ?'Only reviewed business locations with validated coordinates are pinned. Tap a pin to view its directory record.'
            :'LGA boundaries are shown. No geocoded, reviewed businesses match this view yet.'
          :'Public incident pins are intentionally absent until each report is reviewed, redacted and separately approved for publication.'}
    </p>}
    <p className="metadata">Ekiti LGA boundaries © eHealth Africa / Proxy Logics / GRID3 (2020), CC BY 4.0.
      Boundary lines are geographic references, not an emergency response service.</p>
  </div>;
}
