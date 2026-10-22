// Synthetic final-audit regressions. No host, real files, or model calls.
import React,{useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import DSHAssistant from '../src/dsh-assistant.jsx';
import SheetTable from '../src/sheet-table.jsx';
import {settleDwgReviewRequest} from '../src/dwg-assistant.js';
const emptyFeed={getSnapshot:()=>({}),subscribe:()=>()=>{}};
// Stable snapshots are required by useSyncExternalStore.
const emptySession={running:false},emptyEvents={entries:[]},session={...emptyFeed,getSnapshot:()=>emptySession,rename:async()=>({ok:true}),beginSubmission:()=>({requestId:'synthetic',abandon(){}}),prompt:async()=>({ok:true})};
let uploads=0;
const ctx={sessions:{create:async()=>'audit-session',binding:()=>({session,eventSource:{...emptyFeed,getSnapshot:()=>emptyEvents}}),open(){}},fileUpload:{available:true,upload:async()=>{uploads++;return {ok:true,value:{receiptId:'synthetic-receipt'}};}},layout:{selectPanel(){}}};
window.fetch=async()=>({ok:true,json:async()=>({ok:true,value:{}})});
function AuditRegressions(){
 const [projectId,setProjectId]=useState('audit-a'),[request,setRequest]=useState(null),[sequence,setSequence]=useState(0),[format,setFormat]=useState({extraColumns:[{id:'extra:amount',name:'复核数量',type:'number'}],extraValues:{r1:{'extra:amount':'20'},r2:{'extra:amount':'0'}},rules:[{id:'synthetic-rule',columnId:'extra:amount',operator:'gt',value:'10',fill:'#faf1d9',includeRows:['r1']}]});
 const drafts=useRef(new Map()),project={id:projectId,name:projectId==='audit-a'?'模拟项目 A':'模拟项目 B'};
 const context=JSON.stringify({project,page:'model',ledger:'receipt',visibleRows:0});
 function stage(){const id='audit-request-'+(sequence+1);setSequence(sequence+1);setProjectId('audit-a');setRequest({id,projectId:'audit-a',sourceSha256:'a'.repeat(64),allowedNumbers:[1],text:'请核对模拟图纸',file:new File(['synthetic fixture'],'audit-only.dwg')});}
 return <><nav><button onClick={stage}>准备模拟识图</button><button onClick={()=>setProjectId(projectId==='audit-a'?'audit-b':'audit-a')}>切换模拟项目</button></nav><div style={{width:650,height:300}}><SheetTable dataRows={[{id:'r1',name:'模拟行 1'},{id:'r2',name:'模拟行 2'}]} renderDataRow={(r,i)=><tr><td>{i+1}</td><td><input aria-label={'事项 '+(i+1)} value={r.name} readOnly/></td></tr>} format={format} onFormatChange={setFormat}><thead><tr><th>#</th><th data-column-key="name" data-column-label="事项">事项</th></tr></thead></SheetTable></div><DSHAssistant key={projectId} ctx={ctx} project={project} context={context} draftCache={drafts.current} modelReviewRequest={request?.projectId===projectId?request:null} onReviewRequestSettled={(id,status)=>setRequest(r=>settleDwgReviewRequest(r,id,status))} onClose={()=>{}}/><output aria-label="审计回归状态">{JSON.stringify({projectId,request:request?{id:request.id,sent:!!request.sent}:null,uploads,paint:format.paint})}</output></>;
}
createRoot(document.getElementById('root')).render(<AuditRegressions/>);
