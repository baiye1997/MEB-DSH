import React,{useEffect,useRef,useState} from 'react';
import UISelect from './ui-select.jsx';
import UIIcon from './ui-icon.jsx';
import DwgReview from './dwg-review.jsx';
import {addDwgContours,existingBuildings} from './dwg-model.js';
import ModelSplitter from './model-splitter.jsx';
import {initialModelConfig,validateModelConfig} from './model-generation.js';

const block=()=>({id:crypto.randomUUID(),number:'1',name:'新建楼栋',width:30,depth:18,x:0,y:0,heights:[3.6,3.6,3.6]});
const minimum=(points,axis)=>Math.min(...points.map(p=>p[axis]));
export function parseModelNumber(text,{min=-Infinity,max=Infinity,integer=false}={}){
 const trimmed=String(text).trim();if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed))return null;
 const value=Number(trimmed);return Number.isFinite(value)&&value>=min&&value<=max&&(!integer||Number.isInteger(value))?value:null;
}
export function validateModelNumberInput(input,{label,min,max,integer=false}){
 const next=parseModelNumber(input.value,{min,max,integer});
 input.setCustomValidity(next===null?`${label}需填写 ${min}–${max} 的${integer?'整数':'数字'}。`:'');
 return next;
}
function ModelNumberInput({value,onCommit,onError,label,min,max,integer=false,...props}){
 const [draft,setDraft]=useState(String(value??'')),inputRef=useRef(null);
 useEffect(()=>{setDraft(String(value??''));inputRef.current?.setCustomValidity('');},[value]);
 function commit(event){const input=event.currentTarget;if(input.value===String(value??'')){input.setCustomValidity('');onError('');return;}const next=validateModelNumberInput(input,{label,min,max,integer});if(next===null){onError(input.validationMessage);return;}setDraft(String(next));onCommit(next);}
 return <input {...props} ref={inputRef} type="text" inputMode={integer?'numeric':'decimal'} aria-label={label} value={draft} onChange={event=>{event.currentTarget.setCustomValidity('');setDraft(event.currentTarget.value);}} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.currentTarget.blur();}}}/>;
}

export default function ModelEditor({project,cad,onGenerate,onImportDwg,onRenderDwgEvidence,onAskDsh,modelSuggestion,busy,preview}){
 const hasCad=project.modelConfig?.mode==='cad'&&!!cad?.buildings?.length;
 const fresh=()=>structuredClone(project.modelConfig||(hasCad?initialModelConfig(cad):{mode:'blocks',buildings:[block()]}));
 const [config,setConfig]=useState(fresh),[error,setError]=useState(''),[changed,setChanged]=useState(false);
 const [activeBuildingId,setActiveBuildingId]=useState(()=>config.buildings[0]?.id||''),[lotFilter,setLotFilter]=useState(''),[buildingSearch,setBuildingSearch]=useState('');
 const [splitBuildingId,setSplitBuildingId]=useState('');
 const [splitHistory,setSplitHistory]=useState([]),editorRef=useRef(null);
 const savedConfig=JSON.stringify(project.modelConfig||null);
 useEffect(()=>{const next=fresh();setConfig(next);setActiveBuildingId(id=>next.buildings.some(b=>b.id===id)?id:next.buildings[0]?.id||'');setLotFilter('');setBuildingSearch('');setSplitBuildingId('');setSplitHistory([]);setChanged(false);setError('');},[savedConfig]);
 const change=fn=>{setConfig(current=>{const next=structuredClone(current);fn(next);return next;});setSplitHistory([]);setChanged(true);setError('');};
 const update=(i,key,value)=>change(next=>{next.buildings[i][key]=value;});
 const replace=next=>{setConfig(next);setSplitHistory([]);setChanged(true);setError('');};
 const undoSplit=()=>{const last=splitHistory.at(-1);if(!last)return;setConfig(last.config);setActiveBuildingId(last.activeId);setChanged(last.changed);setSplitHistory(history=>history.slice(0,-1));setError('');};
 function move(i,axis,value){
  if(!Number.isFinite(value)||Math.abs(value)>100000)return;
  change(next=>{const b=next.buildings[i],delta=value-minimum(b.polygon,axis);b.polygon=b.polygon.map(p=>p.map((v,j)=>j===axis?Number((v+delta).toFixed(4)):v));if(b.holes)b.holes=b.holes.map(ring=>ring.map(p=>p.map((v,j)=>j===axis?Number((v+delta).toFixed(4)):v)));});
 }
 function adopt(result,indexes,options){const next=addDwgContours(config,cad,result,indexes,options);replace(next);setActiveBuildingId(next.buildings.at(-1)?.id||'');setLotFilter('');setBuildingSearch('');return next;}
 function generate(){const invalid=editorRef.current?.querySelector('input:invalid');if(invalid){setError(invalid.validationMessage);invalid.reportValidity();return;}try{validateModelConfig(config);onGenerate(config);setSplitHistory([]);setChanged(false);setError('');}catch(e){setError(e.message);}}
 const sources=new Set(config.buildings.map(b=>b.dwgSource?.name).filter(Boolean));
 if(config.mode==='imported'&&config.source)sources.add(config.source.name);
 const lots=[...new Set(config.buildings.map(b=>b.lot||'未分标段'))];
 const available=config.buildings.filter(b=>(!lotFilter||(b.lot||'未分标段')===lotFilter)&&(!buildingSearch||`${b.number} ${b.name} ${b.lot||''}`.toLowerCase().includes(buildingSearch.trim().toLowerCase())));
 const active=available.find(b=>b.id===activeBuildingId)||available[0];
 return <section className="model-editor" ref={editorRef} onKeyDown={event=>{if(splitHistory.length&&(event.metaKey||event.ctrlKey)&&!event.shiftKey&&event.key.toLowerCase()==='z'&&!event.target.matches('input,textarea,[contenteditable=true]')){event.preventDefault();event.stopPropagation();undoSplit();}}}>
  <div className="model-editor-tools"><label>几何来源 <UISelect value={config.mode} disabled={busy} aria-label="模型几何来源" onChange={e=>{const next=e.target.value==='cad'?initialModelConfig(cad):{mode:'blocks',buildings:[block()]};replace(next);setActiveBuildingId(next.buildings[0]?.id||'');setLotFilter('');setBuildingSearch('');}}>{hasCad&&<option value="cad">保留原 CAD 轮廓</option>}{config.mode==='imported'&&<option value="imported">可编辑轮廓（图纸 / 拆分）</option>}<option value="blocks">参数体块生成</option></UISelect></label><details className="action-menu model-editor-guidance"><summary>建模说明</summary><div className="menu-panel"><p className="model-editor-note">{config.mode==='cad'?'保留原 CAD 平面轮廓；逐栋设置楼层数及每层层高。':config.mode==='imported'?'逐栋核对轮廓与位置，再自行设置楼层数及每层层高；可继续追加图纸或拆分楼栋。':'按长宽、位置和层高生成示意体块。'} 立面标高仅供参考，不影响手动设置。生成后点击页面「保存更改」。</p></div></details><span>{changed?'参数已修改，生成后生效':'生成结果随项目保存'}</span><button className="primary" disabled={busy} onClick={generate}>生成模型</button></div>

  <DwgReview config={config} cad={cad} hasModel={project.model||config.mode==='imported'} onImport={onImportDwg} onRenderEvidence={onRenderDwgEvidence} onAdopt={adopt} onAskDsh={onAskDsh} suggestion={modelSuggestion} disabled={busy}/>
  {error&&<p role="alert" className="model-editor-error">{error}</p>}
  <div className={`model-editor-layout${splitBuildingId?' is-splitting':''}`}><div className="model-building-list">
  <div className="model-building-browser">
   <div className="model-building-browser-head"><div><strong>楼栋</strong><span>{config.buildings.length} 栋{sources.size>0&&` · ${sources.size} 张图纸`}</span></div><div className="model-building-browser-actions">{splitHistory.length>0&&<button type="button" onClick={undoSplit}>撤销拆分</button>}{config.mode==='blocks'&&<button disabled={busy||config.buildings.length>=30} onClick={()=>{let id;change(next=>{const b=block();let number=1;while(next.buildings.some(x=>x.number===String(number)))number++;b.number=String(number);b.x=Math.min(1000,Math.max(...next.buildings.map(x=>x.x+x.width))+15);id=b.id;next.buildings.push(b);});setActiveBuildingId(id);setBuildingSearch('');}}><UIIcon name="plus"/>添加楼栋</button>}</div></div>
   {(lots.length>1||config.buildings.length>8)&&<div className="model-building-browser-filters">{lots.length>1&&<UISelect aria-label="模型标段筛选" value={lotFilter} onChange={e=>{setLotFilter(e.target.value);setBuildingSearch('');}}><option value="">全部标段</option>{lots.map(lot=><option key={lot} value={lot}>{lot}</option>)}</UISelect>}{config.buildings.length>8&&<input aria-label="查找楼栋" placeholder="查找楼栋号或名称" value={buildingSearch} onChange={e=>setBuildingSearch(e.target.value)}/>}</div>}
   <div className="model-building-tabs" role="group" aria-label="选择楼栋">{available.map(b=><button type="button" aria-pressed={active?.id===b.id} key={b.id} onClick={()=>{setActiveBuildingId(b.id);setSplitBuildingId('');}}><strong>{b.number||'未编号'}</strong><span>{b.name||'未命名'}</span>{config.mode==='imported'&&<small>{b.lot||'未分标段'}</small>}{(!b.heights.length||b.heights.some(h=>!h))&&<em>待补层高</em>}</button>)}</div>
   {!available.length&&<p className="model-building-empty">没有符合筛选条件的楼栋。</p>}
  </div>

   {config.mode==='imported'&&<p className="dwg-source">可编辑轮廓随本项目保存。{config.buildings.some(b=>b.dwgSource)?'原 DWG 不复制。':''}{config.buildings.some(b=>b.cadLayer==='原 CAD')?'含既有 CAD 楼栋。':''}</p>}
   {active&&[active].map(b=>{const i=config.buildings.findIndex(item=>item.id===b.id);return <section className="model-building" key={b.id}>
    <header><h3>{b.lot&&<small>{b.lot}</small>} {b.number} · {b.name}</h3><div className="model-building-actions"><button type="button" disabled={busy||config.buildings.length>=30} onClick={()=>setSplitBuildingId(id=>id===b.id?'':b.id)} aria-expanded={splitBuildingId===b.id}>划线拆分</button>{config.mode!=='cad'&&<details className="action-menu model-building-menu"><summary aria-label="更多楼栋操作"><UIIcon name="more"/></summary><div className="menu-panel"><button disabled={busy||config.buildings.length===1} onClick={()=>{change(next=>next.buildings.splice(i,1));setActiveBuildingId(config.buildings[i+1]?.id||config.buildings[i-1]?.id||'');setLotFilter('');setBuildingSearch('');}}>移除楼栋</button></div></details>}</div></header>
    {splitBuildingId===b.id&&<ModelSplitter key={b.id} config={config} cad={cad} building={existingBuildings(config,cad)[i]} disabled={busy} onClose={()=>setSplitBuildingId('')} onApply={proposal=>{setSplitHistory(history=>[...history,{config,activeId:b.id,changed}]);setConfig(proposal.config);setChanged(true);setError('');setActiveBuildingId(proposal.children[0].id);setSplitBuildingId('');setLotFilter('');setBuildingSearch('');}}/>}
    {config.mode==='imported'&&<p className="dwg-building-provenance">来源：{b.cadLayer==='原 CAD'?'既有 CAD':b.cadLayer==='参数体块'?'原参数体块':b.dwgSource?.name||config.source?.name||'手动轮廓'}{b.cadLayer&&b.cadLayer!=='原 CAD'&&b.cadLayer!=='参数体块'&&` · 图层：${b.cadLayer}`}{Number.isInteger(b.cadEntityIndex)&&` · 图元 #${b.cadEntityIndex}`}{b.closureGap>=.05&&` · 轮廓开口 ${b.closureGap} m，请核对闭合边`}</p>}
    <div className="model-fields">
     {config.mode==='imported'&&<label>标段 / 分组<input disabled={busy} maxLength="80" value={b.lot||''} onChange={e=>update(i,'lot',e.target.value)}/></label>}
     <label>楼栋号<input disabled={busy} value={b.number} onChange={e=>update(i,'number',e.target.value)}/></label>
     <label>楼栋名称<input disabled={busy} value={b.name} onChange={e=>update(i,'name',e.target.value)}/></label>
     <label>楼层数<ModelNumberInput disabled={busy} label="楼层数" integer min={1} max={60} placeholder={config.mode==='imported'?'请填写楼层数':''} value={b.heights.length||''} onError={setError} onCommit={count=>update(i,'heights',Array.from({length:count},(_,j)=>b.heights[j]??(config.mode==='imported'?0:3.6)))}/></label>
     <label>统一层高 · 米<ModelNumberInput disabled={busy} label="统一层高" min={1} max={20} value={b.heights.length&&b.heights.every(h=>h===b.heights[0])&&b.heights[0]?b.heights[0]:''} placeholder="填写后按 Tab 应用" onError={setError} onCommit={height=>update(i,'heights',b.heights.map(()=>height))}/></label>
     {config.mode==='blocks'&&[['width','长'],['depth','宽'],['x','X 位置'],['y','Y 位置']].map(([key,label])=><label key={key}>{label} · 米<ModelNumberInput disabled={busy} label={label} value={b[key]} min={key==='x'||key==='y'?-1000:2} max={key==='x'||key==='y'?1000:200} onError={setError} onCommit={value=>update(i,key,value)}/></label>)}
     {config.mode==='imported'&&<><label>位置 X · 米<ModelNumberInput disabled={busy} label="位置 X" value={Number(minimum(b.polygon,0).toFixed(2))} min={-100000} max={100000} onError={setError} onCommit={value=>move(i,0,value)}/></label><label>位置 Y · 米<ModelNumberInput disabled={busy} label="位置 Y" value={Number(minimum(b.polygon,1).toFixed(2))} min={-100000} max={100000} onError={setError} onCommit={value=>move(i,1,value)}/></label></>}
    </div>
    {config.mode==='imported'&&!b.heights.length&&<p className="model-editor-error">待填楼层数与层高</p>}
    <details><summary>逐层层高 · {b.heights.length||'待填'} 层 / 总高 {b.heights.length&&b.heights.every(Boolean)?b.heights.reduce((a,h)=>a+h,0).toFixed(2)+' m':'待确认'}</summary><div className="model-floor-fields">{b.heights.map((h,j)=><label key={j}>{j+1}F<ModelNumberInput disabled={busy} label={`${b.number}栋 ${j+1}层层高`} min={1} max={20} placeholder="层高 / m" value={h||''} onError={setError} onCommit={height=>change(next=>{next.buildings[i].heights[j]=height;})}/></label>)}</div></details>
   </section>})}
  </div><div className="model-editor-preview">{preview}</div></div>
 </section>;
}
