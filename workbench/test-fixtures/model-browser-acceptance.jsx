// Isolated model-browser fixture; no DSH storage or personal files.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '../src/client.jsx';
import {blankProject,ledgerBook,validate} from '../src/model.js';
import {initial} from './workspace.mjs';

const data=initial();
const project=blankProject('many-buildings','多标段模型验收',true);
project.modelConfig={mode:'imported',buildings:Array.from({length:12},(_,i)=>({
 id:`building-${i+1}`,number:String(i+1).padStart(2,'0'),name:`${i+1}号楼`,lot:i<6?'一标段':'二标段',
 polygon:[[i*22,0],[i*22+16,0],[i*22+16,12],[i*22,12]],heights:[3.6,3.6,3.6],
 dwgSource:{name:i<6?'一标总图.dwg':'二标总图.dwg',sha256:'a'.repeat(64),units:'m'},cadLayer:'A-WALL',cadEntityIndex:i,
}))};
project.rows=[
 {id:'receipt-11',cells:{location:'二标段 · 11号楼 / 2F',description:'11号楼定位验收'},files:[],notes:''},
 {id:'receipt-ambiguous',cells:{location:'1号楼与11号楼 / 2F',description:'跨楼栋待核对'},files:[],notes:''},
];
ledgerBook(project,'change').rows=[
 {id:'change-11',cells:{number:'BG-11',location:'二标段 · 11号楼 / 3F',description:'11号楼三层变更'},files:[],notes:''},
 {id:'change-ambiguous',cells:{number:'BG-待核',location:'1号楼与11号楼 / 2F',description:'跨楼栋待核对'},files:[],notes:''},
];
data.projects=[project];
let saved=validate(JSON.parse(localStorage.getItem('meb-model-browser-acceptance-v2')||'null')||data);
window.fetch=async(_url,options)=>{const {endpoint,payload}=JSON.parse(options.body);if(endpoint==='meb/save'){saved=validate(payload);saved.revision++;localStorage.setItem('meb-model-browser-acceptance-v2',JSON.stringify(saved));}return {json:async()=>({ok:true,value:structuredClone(saved)})};};
createRoot(document.getElementById('root')).render(<App ctx={{}}/>);
