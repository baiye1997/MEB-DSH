import UISelect from './ui-select.jsx';
import React,{useState} from 'react';
import * as Tabs from '@radix-ui/react-tabs';
export function DetailTabs({process,parameters,source,defaultTab='process'}){return <Tabs.Root defaultValue={defaultTab} className="inspector-tabs"><Tabs.List aria-label="明细内容">{[['process','计算过程'],['parameters','参数'],['source','计算规则']].map(([id,label])=><Tabs.Trigger key={id} value={id}>{label}</Tabs.Trigger>)}</Tabs.List><Tabs.Content value="process">{process}</Tabs.Content><Tabs.Content value="parameters">{parameters}</Tabs.Content><Tabs.Content value="source">{source}</Tabs.Content></Tabs.Root>;}
import {specs} from './calculations.js';
import {calculationInputs,participatingFields,parameterSource,calculationEquations,equationMeaning,equationOperandLabels,formatResult} from './calculation-sheet.js';
export const modeName=(kind,mode)=>kind==='cable'?'芯线截面积计算':kind==='bus'?(mode==='direct'?'厂家确认铜重':'铜排尺寸估算'):(mode==='single'?'单杆吊框':'双杆门架');
function LabeledExpression({kind,mode,label,expression}){let index=0;const labels=equationOperandLabels(kind,mode,label);return <span className="formula-numbers">{expression.split(/(\d+(?:\.\d+)?)/).map((part,i)=>/^\d/.test(part)?<span className="formula-term" key={i}><small>{labels[index++]||'区间内取值'}</small><span>{part}</span></span>:<span key={i}>{part}</span>)}</span>;}
export function Equations({kind,inputs,mode,error}){
 let lines;try{if(error)throw Error(error);lines=calculationEquations(kind,inputs,mode);}catch(e){return <p className="calc-explain" role="status">{e.message}。补全后这里会展示代入数字的完整算式。</p>;}
 const final=lines[lines.length-1];
 return <><div className="calculation-answer"><span>{final[0]}</span><strong>{formatResult(final[2],final[3])} <small>{final[3]}</small></strong><small>本行计算结果 · 过程见下方</small></div><ol className="calculation-steps">{lines.map(([label,expression,value,unit],i)=><li key={label} className={i===lines.length-1?'final-step':''}><div className="step-heading"><span>{label}</span><strong title={String(value)}>{i===lines.length-1?formatResult(value,unit):value.toLocaleString('zh-CN',{maximumFractionDigits:6})} <small>{unit}</small></strong></div><span className="formula-meaning">{equationMeaning(kind,mode,label)}</span><details className="step-operands"><summary>{expression}</summary><LabeledExpression kind={kind} mode={mode} label={label} expression={expression}/></details></li>)}</ol><p className="muted">展示值适度舍入，计算保留完整精度。展开算式可查看每个数字的含义。</p></>;

}
export function SnapshotDetail({source}){
 if(source.sheetId==='custom')return <section className="source-snapshot"><h3>{source.customRule?.name||'自定义计算'}</h3><p>{source.formula}</p><p>{source.expression} = <strong>{source.result.toFixed(source.customRule?.precision??4)} {source.unit}</strong></p><dl>{Object.entries(source.inputs).map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value} {source.customRule?.variables.find(v=>v.name===name)?.unit}</dd></div>)}</dl><p>{source.workbook==='用户自定义计算规则'?'':source.workbook}</p><p>入账时间：{new Date(source.capturedAt).toLocaleString('zh-CN')}。以上为当时的规则与参数，原行修改不会改变历史结果。</p></section>;

 return <section className="source-snapshot"><p>{source.specification}</p><DetailTabs process={<><Equations kind={source.sheetId} inputs={source.inputs} mode={source.mode}/><p>入账快照 · 原行后续修改不会改变此结果。</p></>} parameters={<div className="parameter-grid">{participatingFields(source.sheetId,source.mode).map(([id,label,unit])=><div className="parameter-item" key={id}><span>{label}</span><strong>{source.inputs[id]??'未留存'} <small>{unit}</small></strong></div>)}</div>} source={<><p>来源项目：{source.projectName}</p>{source.worksheetName&&<p>来源工作表：{source.worksheetName}</p>}<p>入账项目：{source.targetProjectName||source.projectName}</p><p>{new Date(source.capturedAt).toLocaleString('zh-CN')}</p><p>{source.formula}</p><p>保留入账时的参数与结果。原计算行后续调整不会覆盖本次记录。</p></>}/></section>;

}
export default function CalculationDetail({kind,sheet,row,onOverride,onLength,busy,defaultTab='process'}){
 const {inputs,mode,parseError}=calculationInputs(kind,sheet,row);
 return <DetailTabs defaultTab={defaultTab} process={<Equations kind={kind} inputs={inputs} mode={mode} error={parseError}/>} source={<><p>{specs[kind].formula}</p><p>{kind==='support'?'支架数量按长度÷间距折算，不自动取整；防晃支架按每20米折算。可在参数中调整间距、重量和形式。':'基准铜价、施工月均铜价及不可调幅度按项目约定填写；超出约定区间的部分参与调差，区间内为零。'}</p><p>单位换算和代入数字见计算过程；固定值与本行调整见参数。</p></>} parameters={<><p className="calc-explain">这里的调整仅影响本行；本表默认值在「公式与参数」中设置。</p><p className="calc-explain">此行采用：<strong>{modeName(kind,mode)}</strong>。{kind==='bus'?(mode==='direct'?'使用厂家确认的 kg/m × 长度计算铜量；排宽、厚度、根数及密度不参与。':'ABCN 按 4 极，加 PE 铜排。宽 × 厚 × 根数得到截面积，再乘密度计算铜重。'):kind==='support'?'按原表长度 ÷ 间距折算支架数量，不向上取整；防晃支架按每 20m 折算。':'按每组芯数 × 单芯截面积合计铜截面积。'}</p>
 {kind!=='cable'&&<label className="mode-choice">计算方式<UISelect aria-label="本行计算方式" disabled={busy} value={row.overrides.mode||(kind==='bus'?'section':'')} onChange={e=>onOverride('mode',e.target.value||null)}>{kind==='bus'?<><option value="section">铜排尺寸估算 · 填排宽、厚度及根数</option><option value="direct">厂家确认铜重 · 填 kg/m，不使用铜排尺寸</option></>:<><option value="">按宽度建议 · ≤100mm 单杆，其他双杆门架</option><option value="single">单杆吊框 · 1根吊杆，四边吊框</option><option value="frame">双杆门架 · 2根吊杆，直横担</option></>}</UISelect><small>{kind==='support'?'切换形式会改变吊杆数、单吊长度和横担算法；本行已手填的吊杆数仍保留，可点「恢复来源值」。':'切换方式保留已填参数，仅使用当前方式显示的字段。'}</small></label>}
 <div className="parameter-grid">{participatingFields(kind,mode).map(([id,label,unit])=><label className="parameter-item" key={id}><span>{label} <small>{unit}</small></span><input aria-label={'本行'+label} inputMode="decimal" disabled={busy} value={inputs[id]??''} placeholder="待填写" onChange={e=>id==='length'?onLength(e.target.value):onOverride(id,e.target.value)}/><small>{parameterSource(kind,sheet,row,id)} {Object.hasOwn(row.overrides,id)&&<button disabled={busy} onClick={()=>onOverride(id,null)}>恢复来源值</button>}</small></label>)}</div></>}/>;
}

export function CalculationSettings({kind,sheet,busy,onParameter,onInspectRow,onCustomRules}){
 const shared=specs[kind].fields.filter(([id])=>Object.hasOwn(sheet.params,id));
 const exceptions=sheet.rows.filter(row=>Object.keys(row.overrides).length);
 return <div className="calculation-settings">
  <section><h3>本表默认参数</h3><p>对未单独修改的行生效。本行例外和历史计算记录保持不变。</p>
   <div className="calc-default-grid">{shared.map(([id,label,unit])=>{const count=sheet.rows.filter(row=>Object.hasOwn(row.overrides,id)).length;return <label key={id}><span>{label}<small>{unit}</small></span><input aria-label={'本表默认'+label} inputMode="decimal" value={sheet.params[id]} disabled={busy} onChange={e=>onParameter(id,e.target.value)} placeholder="待填写"/>{count>0&&<small>{count} 行使用单独设置</small>}</label>;})}</div>
   {kind!=='support'&&<p>施工月均铜价需按项目约定手动填写。</p>}
  </section>
  <section><h3>本行例外 <small>{exceptions.length} 行</small></h3>{exceptions.length?<ul className="calc-exception-list">{exceptions.slice(0,20).map(row=><li key={row.id}><button onClick={()=>onInspectRow(row.id)}><span>第 {sheet.rows.indexOf(row)+1} 行 · {row.name||row.specification||'未命名事项'}</span><small>查看参数</small></button></li>)}</ul>:<p>当前没有单独修改的行。需要例外时，选择一行并打开「明细 → 参数」。</p>}{exceptions.length>20&&<p>列出前 20 行；其余行可在表格中打开明细查看。</p>}</section>
  <section><h3>计算公式</h3><p className="calc-rule-text">{specs[kind].formula}</p><p>内置公式保持固定。需要其他算法时，可创建自定义计算规则。</p>{onCustomRules&&<button onClick={onCustomRules}>打开自定义计算规则</button>}</section>
  <section><h3>规格填写</h3><p>{kind==='cable'?'例如 WDZ-BYJ-3*2.5；芯数与截面积从规格拆分。多组芯线用 + 连接。':kind==='bus'?'铜排尺寸格式为 ABCN宽×厚×每极根数 + PE宽×厚×根数，例如 50×3×1+50×1.5×1。厂家已确认铜重时，在本行明细中切换计算方式并填写 kg/m。':'桥架宽×高，例如 150×100。按宽度建议单杆或双杆；100/150/200/300mm 带入原表对应型钢重量，可在本行明细中修改。'}</p></section>
 </div>;
}

export function BatchCalculationParameters({kind,count,busy,onApply}){
 const [patch,setPatch]=useState({}),[error,setError]=useState('');
 const update=(id,value)=>setPatch(p=>({...p,[id]:value}));
 return <form className="calculation-settings batch-parameters" onSubmit={e=>{e.preventDefault();try{if(onApply(patch)!==false){setPatch({});setError('');}}catch(error){setError(error.message);}}}>
 <p>对勾选的 <strong>{count}</strong> 行统一设置。只修改下面勾选的参数，其余字段和其他行保持原值。</p>
 {kind!=='cable'&&<label className="batch-mode">计算方式<UISelect aria-label="批量计算方式" disabled={busy} value={patch.mode===null?'restore':patch.mode||''} onChange={e=>{if(!e.target.value)setPatch(p=>{const next={...p};delete next.mode;return next;});else update('mode',e.target.value==='restore'?null:e.target.value);}}><option value="">保持原值</option><option value="restore">恢复建议方式</option>{(kind==='bus'?[['section','铜排尺寸估算'],['direct','厂家确认铜重']]:[['single','单杆吊框'],['frame','双杆门架']]).map(([id,name])=><option key={id} value={id}>{name}</option>)}</UISelect></label>}
 <div className="batch-field-list">{specs[kind].fields.map(([id,label,unit])=><div className="batch-field" key={id}><label><input type="checkbox" aria-label={'批量修改'+label} disabled={busy} checked={Object.hasOwn(patch,id)} onChange={e=>{if(e.target.checked)update(id,'');else setPatch(p=>{const next={...p};delete next[id];return next;});}}/>{label}<small>{unit}</small></label>{Object.hasOwn(patch,id)&&<div><input aria-label={'批量'+label} inputMode="decimal" disabled={busy||patch[id]===null} placeholder={patch[id]===null?'采用来源值':'填写要统一的值'} value={patch[id]??''} onChange={e=>update(id,e.target.value)}/>{id!=='length'&&<label className="batch-restore"><input type="checkbox" aria-label={'批量恢复'+label} disabled={busy} checked={patch[id]===null} onChange={e=>update(id,e.target.checked?null:'')}/>恢复来源值</label>}</div>}</div>)}</div>
 {error&&<p role="alert">{error}</p>}<button className="primary" type="submit" disabled={busy||!count||!Object.keys(patch).length}>应用到勾选的 {count} 行</button><p>可撤销；核对后点击页面「保存更改」。</p>
 </form>;
}
