// Isolated browser regression for skip -> adopt -> append; no DSH project storage.
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import DwgReview from '../src/dwg-review.jsx';
import {addDwgContours} from '../src/dwg-model.js';

function App(){
 const [config,setConfig]=useState({mode:'blocks',buildings:[{id:'starter',number:'1',name:'示例体块',x:0,y:0,width:20,depth:12,heights:[3.6]}]});
 const cad={site:[],buildings:[]};
 const source=async file=>({units:'m',origin:[0,0],unitsConfirmed:true,candidates:[{index:1,layer:'A-WALL',points:[[0,0],[20,0],[20,12],[0,12]],width:20,depth:12,area:240,gap:0}],source:{name:file.name,sha256:String(file.name.charCodeAt(0)%10).repeat(64)}});
 const adopt=(result,indexes,options)=>{const next=addDwgContours(config,cad,result,indexes,options);setConfig(next);return next;};
 return <main className="meb"><DwgReview config={config} cad={cad} hasModel={config.mode==='imported'} onImport={source} onAdopt={adopt}/><output aria-label="已采用楼栋">{config.mode} · {config.buildings.length} 栋 · {config.buildings.map(b=>`${b.dwgSource?.name||'示例'} / ${b.lot||'未分组'}`).join('、')}</output></main>;
}
createRoot(document.getElementById('root')).render(<App/>);
