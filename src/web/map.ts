import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import boundaries from '../../data/grid3/lga.json?url';

/**
 * GRID3-derived vector boundary map. No third-party tile requests, geocoder,
 * analytics, location storage or unreviewed incident markers.
 */
export interface ReviewedMapPin {
  id:string;name:string;category:string;lga:string;
  latitude:number;longitude:number;
}
export interface EkitiMapOptions {
  container:HTMLElement;
  onPoint?:(latitude:number,longitude:number)=>void;
  onError:()=>void;
  pins?:readonly ReviewedMapPin[];
}
const bounds:[[number,number],[number,number]]=[[4.8,7.24],[5.85,8.15]];
const validName=(v:string)=>v.trim().length>0&&v.length<=120&&!/[\u0000-\u001f<>]/u.test(v);
export function safeMapPin(v:ReviewedMapPin):boolean {
  return !!v&&/^[0-9a-f-]{36}$/i.test(v.id)&&
    validName(v.name)&&validName(v.category)&&validName(v.lga)&&
    Number.isFinite(v.latitude)&&Number.isFinite(v.longitude)&&
    v.latitude>=7.1&&v.latitude<=8.3&&
    v.longitude>=4.6&&v.longitude<=6.0;
}
export function createEkitiMap({container,onPoint,onError,pins=[]}:EkitiMapOptions){
  maplibregl.setWorkerUrl(new URL(workerUrl,location.href).href);
  const map=new maplibregl.Map({
    container,
    bounds,fitBoundsOptions:{padding:24},
    minZoom:7,maxZoom:16,
    attributionControl:false,
    dragRotate:false,pitchWithRotate:false,
    style:{
      version:8,
      sources:{lgas:{type:'geojson',data:boundaries}},
      layers:[
        {id:'background',type:'background',paint:{'background-color':'#f5f7f4'}},
        {id:'areas',type:'fill',source:'lgas',paint:{
          'fill-color':'#d9eadc','fill-opacity':0.88,
        }},
        {id:'borders',type:'line',source:'lgas',paint:{
          'line-color':'#5a8878','line-width':1.3,
        }},
        {id:'names',type:'symbol',source:'lgas',layout:{
          'text-field':['get','lganame'],'text-size':11,
          'text-font':['Open Sans Regular','Arial Unicode MS Regular'],
          'text-allow-overlap':false,
        },paint:{'text-color':'#264c41','text-halo-color':'#f4f7f3',
          'text-halo-width':1.2}},
      ],
    },
  });
  map.addControl(new maplibregl.NavigationControl({showCompass:false}));
  map.addControl(new maplibregl.ScaleControl({maxWidth:100}),'bottom-left');
  const selectedMarker=new maplibregl.Marker({color:'#b65c35'});
  if(onPoint)map.on('click',({lngLat})=>{
    selectedMarker.setLngLat([lngLat.lng,lngLat.lat]).addTo(map);
    onPoint(lngLat.lat,lngLat.lng);
  });
  map.on('error',onError);
  const markers:maplibregl.Marker[]=[];
  for(const item of pins.filter(safeMapPin).slice(0,25)){
    const button=document.createElement('button');
    button.type='button';
    button.className='ekiti-map-pin';
    button.title=item.name;
    button.setAttribute('aria-label','Reviewed '+item.category+': '+item.name);
    const dot=document.createElement('span');
    dot.setAttribute('aria-hidden','true');dot.textContent='●';
    button.append(dot);
    const popup=document.createElement('div');
    const strong=document.createElement('strong');strong.textContent=item.name;
    const p=document.createElement('p');
    p.textContent=item.category+' · '+item.lga+' · reviewed directory entry';
    const a=document.createElement('a');
    a.textContent='View directory details';
    a.href='/places/'+encodeURIComponent(item.id);
    popup.append(strong,p,a);
    const marker=new maplibregl.Marker({element:button,anchor:'bottom'})
      .setLngLat([item.longitude,item.latitude])
      .setPopup(new maplibregl.Popup({offset:18,maxWidth:'250px'}).setDOMContent(popup))
      .addTo(map);
    markers.push(marker);
  }
  return {
    resize(){map.resize();},
    clear(){selectedMarker.remove();},
    pin(lat:number,lon:number){selectedMarker.setLngLat([lon,lat]).addTo(map);},
    destroy(){selectedMarker.remove();markers.forEach(marker=>marker.remove());map.remove();},
  };
}

/** Backwards-compatible incident picker for existing prototype callers. */
export function openMap(onPoint:(lat:number,lon:number)=>void,onError:()=>void){
  const container=document.getElementById('map');
  if(!container)throw new Error('Ekiti map container missing');
  return createEkitiMap({container,onPoint,onError});
}
