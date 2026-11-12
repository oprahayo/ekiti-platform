import * as React from 'react';
import {Link} from 'react-router';
import {useApp} from './state.tsx';
import {CivicProductIcon,type CivicProductIconName} from './CivicProductIcon.tsx';

/** Product navigation stays independent of the search engine itself. */
const products:[{
  href:string;label:string;description:string;icon:CivicProductIconName
},...{href:string;label:string;description:string;icon:CivicProductIconName}[]]=[
  {href:'/search',label:'Search Ekiti',description:'Answers, services and public sources',icon:'search'},
  {href:'/report',label:'Civic report',description:'Prepare a civic incident report',icon:'report'},
  {href:'/report?kind=feedback',label:'Government feedback',description:'Draft feedback; delivery is not yet active',icon:'feedback'},
  {href:'/explore',label:'Explore Ekiti',description:'Businesses, professionals and places',icon:'explore'},
  {href:'/explore?map=1',label:'Ekiti map',description:'Ekiti boundaries and public listings',icon:'map'},
  {href:'/listings/new',label:'List a business',description:'Prepare a business or service listing',icon:'business'},
  {href:'/track',label:'Track a report',description:'Follow a report when intake is live',icon:'track'},
  {href:'/profile',label:'My account',description:'Account and saved places',icon:'account'},
];

export function CivicProductsMenu(){
  const {language,setLanguage}=useApp();
  const ref=React.useRef<HTMLDetailsElement>(null);
  React.useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape'&&ref.current?.open){
      ref.current.open=false;
      ref.current.querySelector<HTMLElement>('summary')?.focus();
    }};
    window.addEventListener('keydown',onKey);
    return()=>window.removeEventListener('keydown',onKey);
  },[]);
  return <details className="civic-products" ref={ref}>
    <summary className="icon-control civic-products-trigger" title="Ekiti Civic services"
      aria-label="Open Ekiti Civic menu">
      <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        {[5,12,19].flatMap(y=>[5,12,19].map(x=><circle key={x+'-'+y} cx={x} cy={y} r="1.9"/>))}
      </svg>
    </summary>
    <div className="civic-products-panel" aria-label="Ekiti Civic products">
      <strong className="civic-products-heading">Explore Ekiti Civic</strong>
      <nav className="civic-products-grid" aria-label="Ekiti Civic services">
        {products.map(product=><Link key={product.href} to={product.href}
          onClick={()=>{if(ref.current)ref.current.open=false;}}
          className={'civic-product-link civic-product-'+product.icon}>
          <span className="civic-product-glyph" aria-hidden="true"><CivicProductIcon name={product.icon} size={23}/></span>
          <span><strong>{product.label}</strong><small>{product.description}</small></span>
        </Link>)}
      </nav>
      <div className="civic-products-language" role="group" aria-label="Menu language">
        <strong>Language</strong>
        <button type="button" aria-pressed={language==='en'}
          onClick={()=>{setLanguage('en');if(ref.current)ref.current.open=false;}}>English</button>
        <button type="button" aria-pressed={language==='yo'}
          onClick={()=>{setLanguage('yo');if(ref.current)ref.current.open=false;}}>Yorùbá</button>
      </div>
      <p className="civic-products-disclaimer">
        Operated independently by inEkiti Official. Government delivery and
        real citizen reporting are not active in this preview.
      </p>
    </div>
  </details>;
}
