import * as React from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import boundariesUrl from '../../data/grid3/lga.json?url';
import {lgas} from '../data/areas.ts';

export interface PublicReviewedMapPlace{
  id:string;name:string;category:string;lga_id:string;
  latitude:number|null;longitude:number|null;reviewed_at:string;
}

function safeReviewedPlace(p:PublicReviewedMapPlace):boolean{
  return typeof p.id==='string'&&typeof p.name==='string'&&
    p.name.length>0&&p.name.length<=160&&
    typeof p.latitude==='number'&&Number.isFinite(p.latitude)&&
    typeof p.longitude==='number'&&Number.isFinite(p.longitude)&&
    p.latitude>=7.15&&p.latitude<=8.25&&p.longitude>=4.7&&p.longitude<=5.95&&
    lgas.some(l=>l.id===p.lga_id)&&
    typeof p.reviewed_at==='string'&&Number.isFinite(Date.parse(p.reviewed_at));
}
export function reviewedMapGeoJson(places:readonly PublicReviewedMapPlace[]){
  return {
    type:'FeatureCollection' as const,
    features:places.filter(safeReviewedPlace).slice(0,100).map(place=>({
      type:'Feature' as const,
      geometry:{type:'Point' as const,
        coordinates:[place.longitude as number,place.latitude as number]},
      properties:{id:place.id,name:place.name,category:place.category},
    })),
  };
}

/** Only source-reviewed, public geocodes get pins. Guest map never asks for
 * device location; no private reports, raw GPS or preview listings are loaded. */
export default function EkitiDirectoryMap({places,onSelectLga}:{
 places:readonly PublicReviewedMapPlace[];onSelectLga:(id:string)=>void;
}){
 const element=React.useRef<HTMLDivElement|null>(null);
 const map=React.useRef<maplibregl.Map|null>(null);
 const onSelect=React.useRef(onSelectLga);
 onSelect.current=onSelectLga;
 const [failed,setFailed]=React.useState(false);
 const [loaded,setLoaded]=React.useState(false);
 const plotted=React.useMemo(()=>reviewedMapGeoJson(places),[places]);
 React.useEffect(()=>{
   if(!element.current)return;
   try{
     maplibregl.setWorkerUrl(new URL(workerUrl,location.href).href);
     const instance=new maplibregl.Map({
       container:element.current,
       bounds:[[4.78,7.21],[5.9,8.2]],
       fitBoundsOptions:{padding:24},attributionControl:false,
       style:{version:8,sources:{
         lgas:{type:'geojson',data:boundariesUrl},
         reviewedPlaces:{type:'geojson',data:reviewedMapGeoJson([])},
       },layers:[
         {id:'paper',type:'background',paint:{'background-color':'#f5f8f5'}},
         {id:'ekiti-region',type:'fill',source:'lgas',
           paint:{'fill-color':'#dbe9df','fill-opacity':0.9}},
         {id:'ekiti-border',type:'line',source:'lgas',
           paint:{'line-color':'#8eaf9b','line-width':1.2}},
         {id:'ekiti-label',type:'symbol',source:'lgas',
           layout:{'text-field':['get','lganame'],'text-size':11},
           paint:{'text-color':'#264c3b','text-halo-color':'#f5f8f5',
             'text-halo-width':1}},
         {id:'reviewed-points',type:'circle',source:'reviewedPlaces',
           paint:{'circle-radius':7,'circle-color':'#186c59',
             'circle-stroke-width':2,'circle-stroke-color':'#fff'}},
       ]},
     });
     map.current=instance;
     instance.addControl(new maplibregl.NavigationControl({showCompass:false}));
     instance.on('load',()=>setLoaded(true));
     instance.on('error',()=>setFailed(true));
     instance.on('click','ekiti-region',event=>{
       const label=String(event.features?.[0]?.properties?.lganame||'').toLowerCase()
         .replace(/[^a-z0-9]/g,'');
       const match=lgas.find(a=>a.name.toLowerCase().replace(/[^a-z0-9]/g,'')===label);
       if(match)onSelect.current(match.id);
     });
     instance.on('click','reviewed-points',event=>{
       const coordinates=(event.features?.[0]?.geometry as {coordinates?:number[]})?.coordinates;
       const name=String(event.features?.[0]?.properties?.name||'Reviewed entry');
       if(!coordinates||coordinates.length!==2)return;
       new maplibregl.Popup({maxWidth:'240px'}).setLngLat(
         [coordinates[0]!,coordinates[1]!]).setText(name).addTo(instance);
     });
     return()=>{map.current=null;instance.remove();};
   }catch{setFailed(true);}
 },[]);
 React.useEffect(()=>{
   if(!loaded||!map.current)return;
   const source=map.current.getSource('reviewedPlaces') as maplibregl.GeoJSONSource|undefined;
   if(source)source.setData(plotted as GeoJSON.FeatureCollection);
 },[loaded,plotted]);
 return <section className="directory-review-map" aria-label="Reviewed Ekiti directory map">
   <div className="directory-review-map-header">
     <h2>Explore Ekiti on the map</h2>
     <p>16 local government boundaries · {plotted.features.length} independently reviewed places pinned</p>
   </div>
   <div ref={element} className="directory-review-map-canvas" role="img"
     aria-label="Interactive Ekiti local government boundaries and verified directory pins"/>
   {failed&&<p role="alert">The map is unavailable. You can still browse by LGA above.</p>}
   {plotted.features.length===0&&<p role="status">
     No reviewed business coordinates are available for these filters.
     Sample directory entries are never pinned as real locations.
   </p>}
   <p className="directory-geo-clarification">Select an LGA on the map to filter the directory.
     Only reviewed directory coordinates appear as markers. The map does not show
     private incident points or emergency reports. Boundary source: GRID3 /
     eHealth Africa and Proxy Logics (2020), CC BY 4.0.
     No third-party tile requests or GPS permission are required.</p>
 </section>;
}
