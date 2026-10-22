import React,{useMemo,useState} from 'react';
import {businessRows} from './business-worksheets.js';
import UISelect from './ui-select.jsx';
import UIIcon from './ui-icon.jsx';
import HelpNote from './help-note.jsx';
import {costStages} from './project-overview.js';
import {dashboardSummary} from './dashboard-summary.js';

export default function ProjectBoard({projects,onOpen,onNew,onReview}){
 const [stage,setStage]=useState(''),[query,setQuery]=useState('');
 const summary=useMemo(()=>dashboardSummary(projects),[projects]);
 const visible=summary.summaries.filter(({project:p})=>(!stage||(p.finance?.stage||'未设置')===stage)&&p.name.toLowerCase().includes(query.toLowerCase()));
 const pending=summary.summaries.filter(p=>p.pending),stages=[...costStages,'未设置'].map(name=>({name,count:projects.filter(p=>(p.finance?.stage||'未设置')===name).length})).filter(s=>s.count);
 return <section className="project-directory">
  <div className="directory-heading"><div><h1>项目工作台</h1></div><button className="primary" onClick={onNew}><UIIcon name="plus"/>新建项目</button></div>
  <div className="dashboard-summary" aria-label="工作台摘要">
   <section className="dashboard-attention"><div className="summary-label"><UIIcon name="check"/><span>待核对收方</span><HelpNote label="待核对统计口径">关键字段或四方签认信息尚未齐全的收方记录。请结合原单核实。</HelpNote></div><strong>{summary.pending}<small> 条</small></strong>{pending.length?<button onClick={()=>onReview(pending[0].project)}>开始核对 <UIIcon name="arrow-right"/></button>:<span className="summary-finished">{summary.receipts?'当前记录信息已齐全':'添加收方记录后在这里跟进'}</span>}</section>
   <section className="dashboard-projects"><div className="summary-label">项目档案</div><strong>{summary.projects}<small> 个项目</small></strong><dl><div><dt>收方记录</dt><dd>{summary.receipts}</dd></div><div><dt>已关联模型</dt><dd>{summary.withModel}</dd></div></dl></section>
   <section className="dashboard-calculations"><div className="summary-label"><UIIcon name="calculator"/>计算留存<HelpNote label="计算留存说明">保留当时的公式、参数与结果；不同施工批次可建立独立工作表。</HelpNote></div><strong>{summary.calculations}<small> 条记录</small></strong></section>
  </div>
  <div className="dashboard-content"><section className="directory-list" aria-label="项目档案">
   <div className="directory-list-heading"><h2>所有项目 <span>{visible.length}</span></h2><div className="directory-filters"><div className="directory-search"><UIIcon name="search"/><input aria-label="看板搜索项目" placeholder="查找项目…" value={query} onChange={e=>setQuery(e.target.value)}/></div><UISelect aria-label="看板造价阶段" value={stage} onChange={e=>setStage(e.target.value)}><option value="">全部阶段</option>{['未设置',...costStages].map(s=><option key={s}>{s}</option>)}</UISelect></div></div>
   <div className="directory-labels" aria-hidden="true"><span>项目 / 当前阶段</span><span>造价档案</span><span>业务记录</span><span/></div>
   <div className="directory-projects">{visible.map(({project:p,pending})=>{const f=p.finance||{},stageAmount=[['audit3','三审金额'],['audit2','二审金额'],['audit1','一审金额'],['cleared','清标金额'],['contract','合同金额']].find(([id])=>f[id]!=null&&f[id]!==''),counts=['receipt','change','output','contract'].map(k=>businessRows(p,k).length);return <button className="directory-project" key={p.id} onClick={()=>onOpen(p)}><div className="directory-identity"><span className="project-initial" aria-hidden="true"><UIIcon name="project" size={19}/></span><div><h3>{p.name}</h3><span>{f.stage||'阶段未设置'}{pending?` · ${pending} 条待核对`:p.model?' · 已关联模型':''}</span></div></div><div className="directory-cost">{stageAmount?<><strong>{Number(f[stageAmount[0]]).toLocaleString('zh-CN',{maximumFractionDigits:2})}<small> 元</small></strong><span>{stageAmount[1]}</span></>:<><strong>—</strong><span>造价档案待填写</span></>}</div><div className="directory-counts">{['收方','变更','产值','合同'].map((label,i)=><span key={label}><b>{counts[i]}</b>{label}</span>)}</div><span className="directory-open"><UIIcon name="arrow-right"/></span></button>})}</div>
   {!visible.length&&<div className="directory-empty"><h3>没有找到项目</h3><p>试试其他名称或造价阶段。</p><button onClick={()=>{setStage('');setQuery('');}}>清除筛选</button></div>}
  </section><aside className="dashboard-aside"><section className="dashboard-stage"><h2>项目阶段</h2><ul>{stages.map(s=><li key={s.name}><div><span>{s.name}</span><strong>{s.count}</strong></div><meter min="0" max={summary.projects||1} value={s.count} aria-label={s.name+'项目数'}/></li>)}</ul></section></aside></div>
 </section>;
}
