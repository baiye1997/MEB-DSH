// Isolated origin, synthetic records, no connection to DSH storage.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from '../src/client.jsx';
import {blankProject,ledgerBook,validate} from '../src/model.js';
import {initial} from './workspace.mjs';
const data=initial();data.projects=[blankProject('test','隔离操作验收')];data.projects[0].rows=[{id:'a',cells:{number:'SF-001',description:'完整长文本验收：\n第一行记录施工范围。\n第二行记录规格、数量和依据。'},files:[],notes:''},{id:'b',cells:{number:'SF-002'},files:[],notes:''}];
data.projects[0].rows.push(...Array.from({length:33},(_,i)=>({id:'many-'+i,cells:{number:'SF-'+(i+3),description:'长表格验收 '+(i+3)},files:[],notes:''})));
data.projects[0].rows[0].cells={number:'SF-001',location:'原有教学楼 / 1F',discipline:'给排水',description:'管道安装',unit:'m',reported:'0.1'};
data.projects[0].rows[1].cells={number:'SF-002',location:'原有教学楼 / 2F',discipline:'给排水',description:'管道安装',unit:'m',reported:'0.2'};
data.projects[0].rows[2].cells={number:'SF-003',description:'管道安装',unit:'个',reported:'2'};
ledgerBook(data.projects[0],'calculation').rows=[{id:'reader-test',cells:{date:'2026-09-22',title:'教学楼一层照明线路\n按竣工长度复核，预留段已包含。',description:'电线电缆铜价调差',specification:'YJV-3×400',quantity:'0.679',unit:'t',amount:'23792.91'},notes:'',files:[]}];
data.projects.push(blankProject('other','隔离第二项目'),blankProject('sample','CAD 隔离测试',true));
let saved=JSON.parse(localStorage.getItem('meb-acceptance-state-v2')||'null')||data;
window.fetch=async(url,options)=>{const {endpoint,payload}=JSON.parse(options.body);if(endpoint==='meb/model-dwg')return {json:async()=>({ok:true,value:{units:'mm',origin:[0,0],unitsConfirmed:false,scanned:10,truncated:false,source:{name:payload.name,sha256:'a'.repeat(64)},candidates:[{index:1,layer:'A-WALL',points:[[0,0],[20,0],[20,12],[0,12]],width:20,depth:12,area:240,gap:0,score:10},{index:2,layer:'A-BLD',points:[[40,0],[55,0],[55,10],[40,10]],width:15,depth:10,area:150,gap:2.1,score:8}]}})};if(endpoint==='meb/save'){saved=validate(payload);saved.revision++;localStorage.setItem('meb-acceptance-state-v2',JSON.stringify(saved));}return {json:async()=>({ok:true,value:structuredClone(saved)})};};
createRoot(document.getElementById('root')).render(<App ctx={{}}/>);
