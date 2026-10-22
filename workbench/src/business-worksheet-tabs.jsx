import React,{useState} from 'react';
import WorksheetTabs from './worksheet-tabs.jsx';
import {businessWorksheets,addBusinessWorksheet,renameBusinessWorksheet} from './business-worksheets.js';
export default function BusinessWorksheetTabs({project,kind,value,onSelect,onChange,disabled}){
 const [mode,setMode]=useState(''),[name,setName]=useState(''),[error,setError]=useState('');const sheets=businessWorksheets(project,kind);
 function submit(e){e.preventDefault();try{const draft=structuredClone(project);if(mode==='new'){const sheet=addBusinessWorksheet(draft,kind,name);if(onChange(p=>{p.businessWorksheets??=[];p.businessWorksheets.push(sheet);})===false)return;onSelect(sheet.id);}else{renameBusinessWorksheet(draft,kind,value,name);if(onChange(p=>{p.businessWorksheets.find(s=>s.id===value&&s.kind===kind).name=name.trim();})===false)return;}setMode('');setError('');}catch(e){setError(e.message);}}

 return <WorksheetTabs className="business-worksheet-bar" label="台账工作表" sheets={sheets} value={value} disabled={disabled||sheets.length>100} onSelect={id=>{onSelect(id);setMode('');}} onNew={()=>{let n=2;while(sheets.some(s=>s.name==='工作表 '+n))n++;setName('工作表 '+n);setMode('new');setError('');}} onRename={value?()=>{setMode('rename');setName(sheets.find(s=>s.id===value)?.name||'');}:undefined} editor={mode&&<form onSubmit={submit}><label>工作表名称<input autoFocus aria-label="台账工作表名称" maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><button className="primary" disabled={!name.trim()||disabled}>{mode==='new'?'创建空白工作表':'保存名称'}</button><button type="button" onClick={()=>setMode('')}>取消</button>{error&&<span role="alert">{error}</span>}</form>}/>;
}
