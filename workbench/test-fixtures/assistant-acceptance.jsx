// Isolated synthetic acceptance. No model calls and no DSH/project storage access.
import React from 'react';
import ExcelJS from 'exceljs';
import {createRoot} from 'react-dom/client';
import {App} from '../src/client.jsx';
import {blankProject,ledgerBook,validate} from '../src/model.js';
import {initial} from './workspace.mjs';
const params=new URLSearchParams(location.search),layoutAudit=params.get('audit')==='layout';
const sampleCount=params.get('rows')==='5000'?5000:65;
const readmeDemo=params.get('demo')==='readme';
const emptyDemo=params.has('empty');
const storageKey=emptyDemo?'meb-empty-startup-v1':readmeDemo?'meb-public-demo-v2':layoutAudit?'meb-layout-acceptance-v1':'meb-experience-acceptance'+(sampleCount===65?'':'-5000');
const data=initial();data.projects=[blankProject('experience-test','体验验收 · 模拟项目'),blankProject('experience-other','隔离第二项目')];
data.projects[0].rows=Array.from({length:sampleCount},(_,i)=>({id:'r'+i,cells:{number:'SF-'+String(i+1).padStart(3,'0'),location:i<2?'教学楼一层':'教学楼二层',description:i<2?'给水管安装':'照明配管',reported:String(i+1),unit:'m',discipline:i<2?'给排水':'电气'},files:[],notes:''}));
if(layoutAudit){
 const project=data.projects[0],description='隔离布局验收模拟收方内容：施工范围、材料规格、工程数量、计量依据与签认情况均为合成数据，不对应任何真实工程。'.repeat(6).slice(0,300);
 project.name='隔离布局验收模拟项目 · 长项目名称用于核对普通窗口内的省略、切换与按钮间距 · 教学楼综合改造及配套管网工程';
 project.columns.push({id:'layout-long-field',name:'现场签认及施工图版本核对依据与分部分项工程补充记录'.repeat(3),type:'text',width:240,hidden:false,options:[]});
 project.columns.find(column=>column.id==='date').hidden=false;
 project.rows[0].cells={...project.rows[0].cells,description,date:'2026-10-15','layout-long-field':'仅供隔离布局验收，长字段内容不参与工程计算。'};
 project.rows[1].cells.date='2026-10-14';project.rows[2].cells.date='2026-10-13';
 ledgerBook(project,'calculation').rows=Array.from({length:3},(_,i)=>({id:'layout-calculation-'+i,cells:{date:'2026-10-'+String(15-i),title:'模拟计算记录 '+(i+1),description:'电线电缆铜价调差 · 隔离记录',specification:'YJV-3×4',quantity:String(12.5+i),unit:'m',amount:String(125.25+i),remarks:i===0?description:'模拟核对备注'},files:[],notes:''}));
 project.model=true;project.modelConfig={mode:'blocks',buildings:[{id:'layout-building-a',number:'1',name:'模拟教学楼',lot:'布局验收标段',phase:'one',heights:[3.6,3.3,3.3],width:24,depth:16,x:0,y:0},{id:'layout-building-b',number:'2',name:'模拟配套楼',lot:'布局验收标段',phase:'two',heights:[3.6,3.3],width:18,depth:12,x:40,y:8}]};
 project.finance={contract:'12000000',cleared:'11800000',audit1:'11750000',ownerDiscount:'3',ourDiscount:'2'};
 const image='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMwzX7+HwAE5wKHPqbviwAAAABJRU5ErkJggg==';
 data.files=[{id:'layout-png',projectId:project.id,name:'隔离验收-单像素.png',mime:'image/png',kind:'copy',data:'data:image/png;base64,'+image,size:atob(image).length,createdAt:'2026-10-15T00:00:00Z'}];project.rows[0].files=['layout-png'];
 data.materials=validate(data).materials;
 data.materials.rows=Array.from({length:3},(_,i)=>({id:'layout-material-'+i,cells:{title:['模拟铜芯电力电缆','模拟给水管材','模拟风管板材'][i],specification:['YJV-3×4','DN50','δ0.8'][i],brand:'隔离示例品牌',unit:['m','m','m²'][i],price:['18.5','32.75','86.2'][i],taxBasis:'含税',taxRate:'13',supplier:'模拟供应商 '+(i+1),date:'2026-10-'+String(15-i),location:'隔离模拟地区',source:'本机合成验收数据'},files:[],notes:''}));
}
if(readmeDemo){
 data.projects=Array.from({length:5},(_,i)=>{
  const p=blankProject('demo-project-'+i,['示例 · 办公楼机电工程','示例 · 园区配套工程','示例 · 公共建筑改造','示例 · 厂房给排水','示例 · 商业空间装修'][i]);
  p.finance={stage:['施工','一审','清标','施工','合同'][i],contract:String(4280000+i*360000),cleared:String(4165000+i*350000),taxBasis:'含税'};
  p.rows=Array.from({length:[18,12,9,7,4][i]},(_,n)=>({id:'demo-receipt-'+i+'-'+n,cells:{number:'SF-'+String(n+1).padStart(3,'0'),location:['1号楼 · 1F','1号楼 · 2F','室外配套'][n%3],description:['给水管安装','照明配管','电缆敷设','风管安装','消防管道'][n%5],discipline:['给排水','电气','电气','暖通','消防'][n%5],reported:String(24+n*3.5),unit:n%5===3?'m²':'m',date:'2026-10-'+String(12+n%10),...(n%4?{approval0:'签字+盖章',approval1:'签字',approval2:'签字',approval3:'签字'}:{})},files:[],notes:''}));
  for(const key of ['change','contract','output','calculation'])ledgerBook(p,key).rows=Array.from({length:key==='calculation'?8-i:3},(_,n)=>({id:'demo-'+key+'-'+i+'-'+n,cells:key==='calculation'?{title:'电缆调差计算 '+(n+1),specification:'YJV-3×'+[4,6,10][n%3],quantity:String(30+n*5),amount:String(120+n*18),unit:'m',date:'2026-10-18'}:{number:key.toUpperCase()+'-'+(n+1),description:'演示业务记录',reported:String(15000+n*3500),date:'2026-10-18'},files:[],notes:''}));
  p.calculationSheets={cable:{name:'10月施工批次',params:{base:'68740',current:'82500',threshold:'3',density:'0.0089'},rows:Array.from({length:9},(_,n)=>({id:'demo-cable-'+n,name:['照明干线 · 1F','动力干线 · 2F','消防配电 · 地下层'][n%3],specification:['YJV-3×4','YJV-4×25+1×16','YJV-3×10'][n%3],length:String(45+n*12),overrides:{}}))}};
  p.calculationWorksheets=[{id:'demo-november',kind:'cable',name:'11月施工批次',params:{base:'68740',current:'84300',threshold:'3',density:'0.0089'},rows:[{id:'demo-november-row',name:'二次配管 · 3F',specification:'YJV-3×6',length:'72',overrides:{}}]}];
  return p;
 });
 const banner=document.createElement('div');banner.className='meb-demo-badge';banner.textContent='演示数据 · 非真实工程';banner.style.cssText='position:fixed;bottom:8px;left:50%;transform:translateX(-50%);font:11px system-ui;color:#687062;z-index:200;pointer-events:none';document.body.append(banner);const style=document.createElement('style');style.textContent='@media(max-width:600px){.meb-demo-badge{display:none}}';document.head.append(style);
}
if(emptyDemo){data.projects=[];data.files=[];data.materials=undefined;}
let saved=validate(JSON.parse(localStorage.getItem(storageKey)||'null')||data);
window.fetch=async(url,options)=>{if(url!=='/api/meb-workbench')throw Error('隔离验收禁止外部请求');const {endpoint,payload}=JSON.parse(options.body);if(layoutAudit&&endpoint==='meb/model-dwg')return {json:async()=>({ok:true,value:{units:'mm',origin:[0,0],unitsConfirmed:false,scanned:10,truncated:false,source:{name:payload.name,sha256:'a'.repeat(64)},candidates:[{index:1,layer:'A-WALL',points:[[0,0],[20,0],[20,12],[0,12]],width:20,depth:12,area:240,gap:0,score:10},{index:2,layer:'A-BLD',points:[[40,0],[55,0],[55,10],[40,10]],width:15,depth:10,area:150,gap:2.1,score:8}]}})};if(layoutAudit&&endpoint==='meb/model-dwg-evidence')return {json:async()=>({ok:false,error:{message:'隔离布局验收未配置审图图像；可核对候选轮廓与模型操作。'}})};if(endpoint==='meb/export'){const wb=new ExcelJS.Workbook(),bytes=Uint8Array.from(atob(payload.base64),char=>char.charCodeAt(0));await wb.xlsx.load(bytes);const sheet=wb.worksheets[0],matrix=[];sheet.eachRow({includeEmpty:true},row=>matrix.push(row.values.slice(1).map(value=>value??'')));let out=document.getElementById('export-evidence');if(!out){out=document.createElement('pre');out.id='export-evidence';out.setAttribute('aria-label','模拟导出内容');document.body.append(out);}out.textContent=JSON.stringify(matrix);return {json:async()=>({ok:true,value:'/模拟导出/'+payload.name})};}if(['meb/sync-status','meb/sync-check','meb/sync-wait'].includes(endpoint))return {json:async()=>({ok:true,value:{configured:false,kind:'disabled'}})};if(endpoint==='meb/save'){saved=validate(payload);saved.revision++;localStorage.setItem(storageKey,JSON.stringify(saved));}return {json:async()=>({ok:true,apiVersion:8,value:structuredClone(saved)})};};
function feed(initial){let value=initial;const listeners=new Set();return {getSnapshot:()=>value,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},set:next=>{value=next;listeners.forEach(fn=>fn());}};}
const list=feed({ids:[],byId:{}}),bindings=new Map();let count=0;
const ctx={sessions:{list,create:async()=>{const id='fixture-'+Date.now()+'-'+(++count),events=feed({entries:[]}),session=feed({running:false});let seq=0;
 Object.assign(session,{rename:async()=>({ok:true}),beginSubmission:()=>({requestId:'fixture-request',abandon(){}}),command:async()=>({ok:true,value:{matched:true}}),cancel:async()=>({ok:true}),prompt:async(parts)=>{
 const text=parts.filter(p=>p.type==='text').map(p=>p.text).join('\n'),match=text.match(/<project-data>\s*([\s\S]*?)<\/project-data>/),context=match?JSON.parse(match[1]):null;
 const rows=context?.rows||[],reply='## 核对结果（模拟回复）\n本次收到 '+rows.length+' 条记录。'+(context?.dataState||'仅咨询业务方法')+'。\n\n| 单据 | 部位 | 数量 | 单位 |\n| --- | --- | --- | --- |\n'+rows.map(r=>'| '+r.cells.number+' | '+r.cells.location+' | '+r.cells.reported+' | '+r.cells.unit+' |').join('\n')+'\n\n## 待核事项\n- 签认资料尚需补齐；本次没有自动修改台账。\n- 这是隔离测试，未调用真实 DSH 模型。\n\n## 下一步\n请补齐依据后复核。';
 const suggestion=rows.length?{version:1,id:'fixture-'+seq,projectId:context.project.id,ledger:'receipt',summary:'模拟建议：给当前第一条记录补充核对备注。',operations:[{type:'update',rowId:rows[0].id,before:{remarks:rows[0].cells.remarks||''},cells:{remarks:'待补签认资料（隔离验收）'}}]}:null;
 events.set({entries:[...events.getSnapshot().entries,{event:{type:'user/message',seq:++seq,data:{source:{kind:'user'},content:[{type:'text',text}]}}},{event:{type:'assistant/message',seq:++seq,data:{message:{content:[{type:'text',text:reply+(suggestion?'\n```meb-change\n'+JSON.stringify(suggestion)+'\n```':'')}]}}}}]});return {ok:true};}});
 bindings.set(id,{session,eventSource:events});list.set({ids:[...list.getSnapshot().ids,id],byId:{...list.getSnapshot().byId,[id]:{id}}});return id;},binding:id=>bindings.get(id),open(){}},layout:{selectPanel(){}}};
// Visible opt-in diagnostics for manual acceptance; excluded from production bundles.
let measuredApp=<App ctx={ctx}/>;
if(params.has('perf')){
 const output=document.createElement('output');output.setAttribute('aria-label','性能验收');output.style.cssText='position:fixed;bottom:4px;right:6px;z-index:30000;background:#242627;color:white;padding:3px 8px;font:11px/18px system-ui;pointer-events:none';document.body.append(output);
 let commits=0,last=0,peak=0,eventPeak=0;
 const show=()=>{output.textContent=`5000 行验收 · 提交 ${commits} · 本次 ${last.toFixed(1)} ms · 渲染峰值 ${peak.toFixed(1)} ms · 交互峰值 ${eventPeak.toFixed(0)} ms`;};
 measuredApp=<React.Profiler id="workbench" onRender={(_id,_phase,duration)=>{commits++;last=duration;peak=Math.max(peak,duration);show();}}><App ctx={ctx}/></React.Profiler>;
 if(PerformanceObserver.supportedEntryTypes.includes('event')){const observer=new PerformanceObserver(list=>{for(const event of list.getEntries())eventPeak=Math.max(eventPeak,event.duration);show();});observer.observe({type:'event',durationThreshold:16,buffered:true});}
}
createRoot(document.getElementById('root')).render(measuredApp);
