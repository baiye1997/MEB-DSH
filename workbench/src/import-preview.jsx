import React,{useState} from 'react';
import UISelect from './ui-select.jsx';
import UIField from './ui-field.jsx';
import {outputKinds} from './business.js';
import {detectFloorMatrix,detectOutputValuation,detectReceiptForm,floorMatrixImport,importGuess,matchColumns,mappedImport,materialPriceCandidates,outputValuationDraft,receiptFormImport,usefulMapping} from './sheet-import.js';

const visibleValue=value=>value instanceof Date?value.toLocaleDateString('zh-CN'):String(value??'');
const moneyText=value=>{const [whole,part='']=value.split('.');return whole.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+part.padEnd(2,'0');};

function FloorImport({matrix,plan,source,target,buildings,disciplines,onApply,onSwitch}){
 const [building,setBuilding]=useState(''),[discipline,setDiscipline]=useState(''),[error,setError]=useState('');
 let preview;try{preview=floorMatrixImport(matrix,{plan,building,discipline,source});}catch(e){preview={rows:[],skipped:0,error:e.message};}
 const header=matrix[plan.headerRow]||[],width=matrix.reduce((n,row)=>Math.max(n,row.length),0);
 const sample=matrix.map((row,i)=>({row,i})).slice(plan.headerRow+1).filter(({row})=>row.some(v=>visibleValue(v).trim())).slice(0,3);
 return <div className="import-preview">
  <p>追加到 <strong>{target}</strong>。原文件与已有记录保留。</p>
  <div className="import-mode" role="group" aria-label="导入表格布局"><button type="button" aria-pressed="true">按楼层展开</button><button type="button" aria-pressed="false" onClick={onSwitch}>普通逐行映射</button></div>
  <p className="import-explanation">发现 {plan.floors.length} 个楼层列。每个有数量的“清单项 × 楼层”生成一条<strong>草稿</strong>。清单总量、合计和差值只作来源参考；原表没有单位或签认结论，导入后须逐项补齐、核对。</p>
  <div className="import-floor-controls">
   <label>所属楼栋 / 区域 <span>必选</span>{buildings.length?<UISelect aria-label="导入所属楼栋" value={building} onChange={e=>setBuilding(e.target.value)}><option value="">选择这张工作表对应的楼栋</option>{buildings.map(b=><option key={b.id} value={b.name||b.number}>{b.number} · {b.name||'未命名楼栋'}</option>)}</UISelect>:<UIField aria-label="导入所属楼栋" value={building} onChange={e=>setBuilding(e.target.value)} placeholder="填写工作表对应的楼栋或区域"/>}</label>
   <label>专业 <span>可留空</span><UISelect aria-label="导入专业" value={discipline} onChange={e=>setDiscipline(e.target.value)}><option value="">暂不指定</option>{disciplines.map(value=><option key={value}>{value}</option>)}</UISelect></label>
  </div>
  <p className="import-floor-columns">楼层列：{plan.floors.map(f=>f.label).join('、')}。一张工作表按同一楼栋处理；其他工作表请分别导入。</p>
  {(error||preview.error)&&<p role="alert" className="import-error">{error||preview.error}</p>}
  <details className="import-source-preview"><summary>原表片段 · 表头第 {plan.headerRow+1} 行</summary><div className="import-source-scroll"><table><thead><tr><th>原行</th>{Array.from({length:width},(_,j)=><th key={j}><small>第 {j+1} 列</small>{visibleValue(header[j])||'—'}</th>)}</tr></thead><tbody>{sample.map(({row,i})=><tr key={i}><th>{i+1}</th>{Array.from({length:width},(_,j)=><td key={j} title={visibleValue(row[j])}>{visibleValue(row[j])||'—'}</td>)}</tr>)}</tbody></table></div></details>
  {!preview.error&&<p role="status">将追加 {preview.rows.length} 条草稿，涉及 {preview.items} 个清单项；跳过 {preview.skipped} 行。公式使用文件中已保存的结果，不在这里重算。</p>}
  <div className="import-floor-sample"><table><thead><tr><th>来源行</th><th>收方内容</th><th>部位</th><th>数量</th><th>单位</th></tr></thead><tbody>{preview.rows.slice(0,5).map(row=><tr key={row.id}><td>{row.notes.match(/第 (\d+) 行/)?.[1]||'—'}</td><td>{row.cells.description}</td><td>{row.cells.location}</td><td>{row.cells.reported}</td><td>待补</td></tr>)}</tbody></table></div>
  <div className="review-actions"><span>预览前 5 条 · 共 {preview.rows.length} 条</span><button className="primary" disabled={!preview.rows.length||!!preview.error} onClick={()=>{try{onApply(preview.rows);}catch(e){setError(e.message);}}}>确认追加 {preview.rows.length} 条草稿</button></div>
 </div>;
}

function FormImport({matrix,plan,source,target,onApply,onSwitch}){
 let preview;try{preview=receiptFormImport(matrix,{plan,source});}catch(e){preview={rows:[],error:e.message};}
 return <div className="import-preview">
  <p>追加到 <strong>{target}</strong>。原文件与已有记录保留。</p>
  <div className="import-mode" role="group" aria-label="导入表格布局"><button type="button" aria-pressed="true">整单归档</button><button type="button" aria-pressed="false" onClick={onSwitch}>普通逐行映射</button></div>
  <p className="import-explanation">这张工作表是现场收方文书。整单保存为 <strong>1 条未签认草稿</strong>；正文中的各项算式不自动拆成工程量。请核对日期、部位与签认，导入后在附件库引用原件。</p>
  {preview.error&&<p role="alert" className="import-error">{preview.error}</p>}
  <article className="import-form-sheet" aria-label="收方单导入预览">
   <header><small>原表 · 第 {plan.content.row+1} 行</small><h3>现场收方单</h3></header>
   <dl><div><dt>工程名称</dt><dd>{plan.project?.value||'待核对'}</dd></div><div><dt>工程部位</dt><dd>{plan.location?.value||'待补'}</dd></div><div><dt>日期</dt><dd>{plan.date?.value||'待补'}</dd></div><div><dt>分包单位</dt><dd>{plan.contractor?.value||'待核对'}</dd></div></dl>
   <section><h4>工程内容</h4><p>{plan.content.value}</p></section>
  </article>
  <div className="review-actions"><span>签字、盖章和工程量仍需人工核验</span><button className="primary" disabled={!preview.rows.length||!!preview.error} onClick={()=>onApply(preview.rows)}>确认追加 1 条草稿</button></div>
 </div>;
}

function OutputValuation({plan,source,target,onApply}){
 const [category,setCategory]=useState(''),[period,setPeriod]=useState(()=>{const found=plan.periods.filter(v=>/^第[一二三四五六七八九十\d]+期$/.test(v));return found.length===1?found[0]:'';}),[error,setError]=useState('');
 const reconciled=!!plan.count&&!plan.invalid&&plan.summaries.length===1&&plan.summaries[0].matches;
 return <div className="import-preview">
  <p>核对来源 <strong>{source}</strong> · 目标 <strong>{target}</strong></p>
  <div className="import-valuation-card">
   <span>本期分部分项合价 · 原表清单行合计</span>
   <strong>{plan.invalid?'待核对':moneyText(plan.amount)} <small>元</small></strong>
   <p>{plan.count} 条带编码清单行，其中 {plan.nonzero} 条本期非零。{plan.summaries.length===1&&plan.summaries[0].matches?'与原表单列总额一致。':'未找到唯一且一致的原表总额，须核对。'}{plan.invalid?`另有 ${plan.invalid} 个金额无法解析。`:''}</p>
  </div>
  <p className="import-explanation">此表还包含专业/楼栋分类小计，以及多个期次的申报、审核和累计列。逐行追加会重复累计。上面的金额只覆盖本期分部分项，不能直接当作完整报送产值。</p>
  {!!plan.periods.length&&<p className="import-floor-columns">原表期次提示：{plan.periods.join('、')}。文件名与表内月份也应分别核对。</p>}
  <section className="import-valuation-draft" aria-label="建立产值核对记录"><div><h3>留一条待核对记录</h3><p>选择口径并确认期次。清单合价只写入来源说明；报送金额、审定金额、合同和往来方均留空，随后在台账补齐。</p></div>
   <div className="import-floor-controls"><label>产值口径 <span>必选</span><UISelect aria-label="导入产值口径" value={category} onChange={e=>setCategory(e.target.value)}><option value="">请选择产值口径</option>{outputKinds.map(value=><option key={value}>{value}</option>)}</UISelect></label><label>期次 <span>请核对</span><UIField aria-label="导入产值期次" value={period} onChange={e=>setPeriod(e.target.value)} placeholder="例如：第六期"/></label></div>
   {!reconciled&&<p role="alert" className="import-error">分部分项合价未能与原表唯一核对，请检查原文件后手动录入。</p>}
   {error&&<p role="alert" className="import-error">{error}</p>}
   <div className="review-actions"><span>来源金额不会写入报送金额</span><button className="primary" disabled={!reconciled||!category||!period.trim()} onClick={()=>{try{onApply([outputValuationDraft(plan,{source,category,period})]);}catch(e){setError(e.message);}}}>创建 1 条待核对记录</button></div>
  </section>
  <details className="import-valuation-sample"><summary>查看原表非零清单项示例 · {plan.nonzero} 条</summary><div className="import-floor-sample"><table><thead><tr><th>原行</th><th>本期非零清单项</th><th>分部分项合价 · 元</th></tr></thead><tbody>{plan.sample.map(item=><tr key={item.row}><td>{item.row}</td><td>{item.name}</td><td>{item.amount}</td></tr>)}</tbody></table></div></details>
 </div>;
}

export default function ImportPreview({matrix,columns,source,target,targetKind,buildings=[],onApply}){
 const floorPlan=targetKind==='receipt'?detectFloorMatrix(matrix):null;
 const formPlan=targetKind==='receipt'?detectReceiptForm(matrix):null;
 const valuationPlan=targetKind==='output'?detectOutputValuation(matrix):null;
 const [mode,setMode]=useState(floorPlan?'floors':formPlan?'form':'rows');
 const [config,setConfig]=useState(()=>({...importGuess(matrix,columns),source})),[error,setError]=useState('');
 if(valuationPlan)return <OutputValuation plan={valuationPlan} source={source} target={target} onApply={onApply}/>;
 if(mode==='floors')return <FloorImport matrix={matrix} plan={floorPlan} source={source} target={target} buildings={buildings} disciplines={columns.find(c=>c.id==='discipline')?.options||[]} onApply={onApply} onSwitch={()=>setMode('rows')}/>;
 if(mode==='form')return <FormImport matrix={matrix} plan={formPlan} source={source} target={target} onApply={onApply} onSwitch={()=>setMode('rows')}/>;
 let preview;try{preview=mappedImport(matrix,columns,{...config,kind:targetKind});}catch(e){preview={rows:[],skipped:0,error:e.message};}
 const width=matrix.reduce((n,r)=>Math.max(n,r.length),0),header=matrix[config.headerRow]||[];
 const matches=columns.flatMap((column,i)=>config.mapping[i]>=0?[`${column.name} ← 第 ${config.mapping[i]+1} 列`]:[]);
 const sourceSample=matrix.map((row,i)=>({row,i})).slice(config.startRow).filter(({row})=>row.some(v=>visibleValue(v).trim())).slice(0,3);
 const priceCandidates=targetKind==='materials'?materialPriceCandidates(matrix,config.headerRow,config.startRow):[];
 const priceUnmapped=priceCandidates.length>0&&config.mapping[columns.findIndex(c=>c.id==='price')]<0;
 const needsReview=!usefulMapping(config.mapping,columns)||priceUnmapped;
 return <div className="import-preview">
  <p>追加到 <strong>{target}</strong>。原文件与已有记录保留。</p>
  {floorPlan&&<div className="import-mode" role="group" aria-label="导入表格布局"><button type="button" aria-pressed="false" onClick={()=>setMode('floors')}>按楼层展开</button><button type="button" aria-pressed="true">普通逐行映射</button></div>}
  {formPlan&&!floorPlan&&<div className="import-mode" role="group" aria-label="导入表格布局"><button type="button" aria-pressed="false" onClick={()=>setMode('form')}>整单归档</button><button type="button" aria-pressed="true">普通逐行映射</button></div>}
  <div className="import-controls">
   <label>表头行<UISelect aria-label="导入表头行" value={config.headerRow} onChange={e=>{const i=Number(e.target.value);setConfig({...config,headerRow:i,startRow:i+1,mapping:i<0?columns.map(()=>-1):matchColumns(matrix[i],columns),allowUnpriced:false});}}><option value={-1}>无表头，手动匹配</option>{matrix.slice(0,30).map((r,i)=><option key={i} value={i}>第 {i+1} 行 · {r.filter(Boolean).join(' / ').slice(0,70)}</option>)}</UISelect></label>
   <label>数据起始行<UIField aria-label="数据起始行" type="number" min={1} max={matrix.length+1} value={config.startRow+1} onChange={e=>setConfig({...config,startRow:Number(e.target.value)-1})}/></label>
  </div>
  <p>核对表头、实际业务字段和数据起始行；含多个金额口径的表格请明确选择。{targetKind==='receipt'?'收方资料按未签认草稿导入；仅有分类标题、没有数量或部位的行会跳过。':''}</p>
  {priceUnmapped&&<div className="import-explanation" role="status">原表 {priceCandidates.map(c=>`第 ${c.column+1} 列“${c.label}”`).join('、')} 含数值，但未匹配“单价”。请先确认是报价、调整额还是合价，再手动匹配；也可明确作为无价资料导入，原表金额会保留在补充说明。<label className="check"><UIField type="checkbox" checked={!!config.allowUnpriced} onChange={e=>setConfig({...config,allowUnpriced:e.target.checked,keepExtra:e.target.checked?true:config.keepExtra})}/>作为无价资料导入</label></div>}
  {(error||preview.error)&&<p role="alert" className="import-error">{error||preview.error}</p>}
  <details className="import-source-preview" open={needsReview?true:undefined}>
   <summary>原表片段 · 从第 {config.startRow+1} 行查看</summary>
   <div className="import-source-scroll"><table><thead><tr><th scope="col">原行</th>{Array.from({length:width},(_,j)=><th scope="col" key={j}><small>第 {j+1} 列</small>{visibleValue(header[j])||'—'}</th>)}</tr></thead><tbody>{sourceSample.map(({row,i})=><tr key={i}><th scope="row">{i+1}</th>{Array.from({length:width},(_,j)=><td key={j} title={visibleValue(row[j])}>{visibleValue(row[j])||'—'}</td>)}</tr>)}</tbody></table></div>
  </details>
  <details className="import-mapping" open={matches.length<3||needsReview?true:undefined}>
   <summary>字段匹配 · 已匹配 {matches.length} 项{matches.length>=3&&<small>　{matches.slice(0,4).join(' · ')}{matches.length>4?' …':''}</small>}</summary>
   <div className="mapping">{columns.filter(c=>c.type!=='computed').map(c=>{const i=columns.indexOf(c);return <label key={c.id}>{c.name}<UISelect aria-label={'导入 '+c.name} value={config.mapping[i]} onChange={e=>setConfig({...config,allowUnpriced:false,mapping:config.mapping.map((x,j)=>j===i?Number(e.target.value):x)})}><option value={-1}>不导入</option>{Array.from({length:width},(_,j)=><option value={j} key={j}>第 {j+1} 列 · {String(header[j]||'无列名').slice(0,40)}</option>)}</UISelect></label>;})}</div>
  </details>
  <label className="check"><UIField type="checkbox" checked={config.skipTotals} onChange={e=>setConfig({...config,skipTotals:e.target.checked})}/>跳过明确标为合计、小计或总计的行</label>
  <label className="check"><UIField type="checkbox" checked={config.keepExtra} onChange={e=>setConfig({...config,keepExtra:e.target.checked})}/>未匹配内容保留在记录补充说明</label>
  {!preview.error&&<p>将追加 {preview.rows.length} 行，跳过 {preview.skipped} 行。公式使用文件中已保存的结果，不在这里重算。</p>}
  <div className="import-sample">{preview.rows.slice(0,3).map((r,i)=><dl key={r.id}><dt>预览 {i+1}</dt>{columns.filter(c=>r.cells[c.id]).map(c=><React.Fragment key={c.id}><dt>{c.name}</dt><dd>{r.cells[c.id]}</dd></React.Fragment>)}</dl>)}</div>
  <div className="review-actions"><span>预览前 3 行 · 共 {preview.rows.length} 行</span><button className="primary" disabled={!preview.rows.length||!!preview.error} onClick={()=>{try{onApply(preview.rows);}catch(e){setError(e.message);}}}>确认追加 {preview.rows.length} 行</button></div>
 </div>;
}
