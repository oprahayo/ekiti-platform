import * as React from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import boundariesUrl from '../../data/grid3/lga.json?url';
import type {AdminCase} from './case-model.ts';

const areas=[
 'Ado-Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure',
 'Gbonyin','Ido-Osi','Ijero','Ikere','Ikole','Ilejemeje',
 'Irepodun/Ifelodun','Ise/Orun','Moba','Oye',
] as const;
const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
export function isEkitiLga(value:string):boolean{
 return areas.some(name=>norm(name)===norm(value));
}
export function demoAreaCounts(cases:readonly AdminCase[]):Record<string,number>{
 return Object.fromEntries(areas.map(name=>[name,
   cases.filter(record=>norm(record.lga)===norm(name)).length]));
}
export function caseArea(name:string):string|null{
 return areas.find(area=>norm(area)===norm(name))??null;
}

/** The polygons are authoritative GRID3 geography, but NO report positions
 * are plotted. The color summarizes fictional counts at LGA level only. */
export default function EkitiOpsMap({cases,onSelectArea}:{
 cases:readonly AdminCase[];onSelectArea:(area:string)=>void;
}){
 const container=React.useRef<HTMLDivElement|null>(null);
 const mapRef=React.useRef<maplibregl.Map|null>(null);
 const [ready,setReady]=React.useState(false);
 const [failed,setFailed]=React.useState(false);
 const counts=React.useMemo(()=>demoAreaCounts(cases),[cases]);
 const total=cases.length;
 const selected=React.useRef(onSelectArea);
 selected.current=onSelectArea;
 React.useEffect(()=>{
   if(!container.current)return;
   try{
     maplibregl.setWorkerUrl(new URL(workerUrl,location.href).href);
     const map=new maplibregl.Map({
       container:container.current,
       bounds:[[4.79,7.23],[5.87,8.2]],
       fitBoundsOptions:{padding:25},
       attributionControl:false,
       interactive:true,
       style:{
         version:8,
         sources:{lgas:{type:'geojson',data:boundariesUrl}},
         layers:[
           {id:'map-paper',type:'background',paint:{'background-color':'#56616f'}},
           {id:'ekiti-areas',type:'fill',source:'lgas',
             paint:{'fill-color':'#718090','fill-opacity':0.95}},
           {id:'ekiti-edges',type:'line',source:'lgas',
             paint:{'line-color':'#d1dbe4','line-width':1.25}},
           {id:'ekiti-names',type:'symbol',source:'lgas',
             layout:{'text-field':['get','lganame'],'text-size':11,
               'text-allow-overlap':false},
             paint:{'text-color':'#ffffff','text-halo-color':'#3e4b59',
               'text-halo-width':1.5}},
         ],
       },
     });
     mapRef.current=map;
     map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
     map.on('load',()=>setReady(true));
     map.on('error',()=>setFailed(true));
     map.on('click','ekiti-areas',(event)=>{
       const name=String(event.features?.[0]?.properties?.lganame||'');
       const reviewed=caseArea(name);
       if(reviewed)selected.current(reviewed);
     });
     map.on('mouseenter','ekiti-areas',()=>{map.getCanvas().style.cursor='pointer';});
     map.on('mouseleave','ekiti-areas',()=>{map.getCanvas().style.cursor='';});
     return()=>{mapRef.current=null;map.remove();};
   }catch{setFailed(true);}
 },[]);
 React.useEffect(()=>{
   const map=mapRef.current;
   if(!map||!ready)return;
   const expression:unknown[]=['match',['get','lganame']];
   for(const area of areas){
     expression.push(area,counts[area]===0?'#718090':
       counts[area]>1?'#006d35':'#48a37c');
   }
   expression.push('#718090');
   map.setPaintProperty('ekiti-areas','fill-color',expression as maplibregl.ExpressionSpecification);
 },[counts,ready]);
 return <section className="ekiti-ops-map" aria-label="Ekiti LGA map and sample report counts">
   <div className="ops-map-heading">
     <div><span className="ops-eyebrow">LOCAL GOVERNMENT VIEW</span>
       <h2>Ekiti, at a glance</h2>
       <p>Verified LGA boundaries · {total} fictional platform cases</p></div>
     <span className="ops-map-demo">DEMO DATA</span>
   </div>
   <div ref={container} className="ekiti-map-canvas" role="img"
     aria-label="Interactive Ekiti State LGA choropleth based on fictional counts; use the buttons below for keyboard access" />
   {failed&&<p role="alert">The interactive map is unavailable. Use the LGA list below.</p>}
   <div className="ops-map-legend"><span><i className="ops-legend-none"/>No sample cases</span>
     <span><i className="ops-legend-one"/>One</span>
     <span><i className="ops-legend-many"/>Two or more</span></div>
   <div className="ops-map-areas" aria-label="Select an Ekiti local government area">
     {areas.map(area=><button key={area} type="button" onClick={()=>onSelectArea(area)}
       aria-label={'Show sample cases in '+area}>
       <span>{area}</span><strong>{counts[area]}</strong>
     </button>)}
   </div>
   <p className="ops-map-source">Boundaries: GRID3 / eHealth Africa and Proxy Logics (2020), CC BY 4.0.
     Shading indicates fictional LGA case counts only. Not incident coordinates, danger zones,
     verified emergencies or government activity. No external map tiles or GPS are requested.</p>
 </section>;
}
