import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {webcrypto} from 'node:crypto';

// DOM unit harness only: no browser rendering or claimed device/layout results.
export function domHarness(html, path = '/qgh-voice/procedural-beta/', width = 390) {
  const {document, window:dom}=parseHTML(html);
  const store=new Map(), storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const context2d=new Proxy({}, {get:(target,key)=>key==='measureText'?text=>({width:String(text).length*7}):target[key]??(()=>{}),set:(target,key,value)=>(target[key]=value,true)});
  const proto=dom.HTMLElement.prototype;
  proto.focus=function(){document.activeElement=this;};
  proto.scrollIntoView=function(){};
  proto.getContext=function(){return context2d;};
  dom.HTMLCanvasElement.prototype.getContext=function(){return context2d;};
  proto.setPointerCapture=function(){};proto.hasPointerCapture=()=>false;proto.releasePointerCapture=function(){};
  proto.getBoundingClientRect=()=>({left:0,top:0,width:600,height:500});
  proto.reportValidity=()=>true;
  Object.defineProperty(proto,'clientWidth',{configurable:true,get:()=>600});
  Object.defineProperty(proto,'clientHeight',{configurable:true,get:()=>500});
  Object.defineProperty(dom.HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.getAttribute('value')??this.querySelector('option')?.getAttribute('value')??'';},set(value){for(const o of this.querySelectorAll('option'))o.toggleAttribute('selected',o.getAttribute('value')===String(value));}});
  Object.defineProperty(proto,'elements',{configurable:true,get(){return {namedItem:name=>this.querySelector(`[name="${name}"]`)};}});
  Object.defineProperty(document,'readyState',{value:'complete'});
  Object.defineProperty(document,'currentScript',{value:{src:'https://example.test/qgh-voice/procedural-beta/suite-guide-chat.js'}});
  const location={pathname:path,hash:'',search:'',origin:'https://example.test',href:'https://example.test'+path};
  const media=new Map();
  const window={document,location,innerWidth:width,devicePixelRatio:1,setTimeout:()=>0,addEventListener(){},speechSynthesis:null,
    matchMedia(query){if(!media.has(query))media.set(query,{matches:/max-width: (?:700|1000)px/.test(query)&&width<=700,addEventListener(){}});return media.get(query);}};
  const context=vm.createContext({window,document,location,sessionStorage:storage,localStorage:storage,console,crypto:webcrypto,
    URL,URLSearchParams,Blob,AbortSignal,DOMException,TextEncoder,performance,devicePixelRatio:1,
    HTMLElement:dom.HTMLElement,HTMLInputElement:dom.HTMLInputElement,MutationObserver:dom.MutationObserver,
    ResizeObserver:class{observe(){}},Option:function(text,value){const e=document.createElement('option');e.textContent=text;e.value=value;return e;},
    requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,
    fetch:async()=>{throw new Error('Unexpected network request in DOM unit test');},
  });
  return {context,document,window,Event:dom.Event,media};
}
