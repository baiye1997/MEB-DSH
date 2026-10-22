import React,{useRef,useState} from 'react';
import * as Popover from '@radix-ui/react-popover';
import UIIcon from './ui-icon.jsx';
import LedgerColumnFilter from './ledger-column-filter.jsx';
import {filterFields,filterLedgerRows,filterOperators} from './ledger-filter.js';
function conditionLabel(condition){
 const describe=c=>c.operator?filterOperators[c.operator]+(['empty','filled'].includes(c.operator)?'':` ${c.value||''}${c.operator==='between'?' 至 '+(c.to||''):''}`):'';
 const selected=condition.values?(condition.selection==='exclude'?'排除 ':'')+(condition.values.length?condition.values.slice(0,2).map(v=>v||'空白').join('、')+(condition.values.length>2?` 等 ${condition.values.length} 项`:''):condition.selection==='exclude'?'全部值':'未选任何值'):'';
 const rule=describe(condition)+(condition.second?(condition.relation==='or'?' 或 ':' 且 ')+describe(condition.second):'');return [selected,rule].filter(Boolean).join('；');
}
export default function LedgerFilters({columns,rows,kind,query,status,filters,direction,sort,onFilter,onSort,onReset,views,onView,onSave,count}){
 const anchor=useRef(null),[open,setOpen]=useState(false),fields=filterFields(columns),active=Object.keys(filters);
 return <><Popover.Root open={open} onOpenChange={setOpen}><Popover.Trigger asChild><button ref={anchor} type="button" className="compact-action" aria-label="筛选记录"><UIIcon name="filter"/><span>筛选{active.length?' · '+active.length:status?' · 已设置':''}</span></button></Popover.Trigger><Popover.Portal container={anchor.current?.closest('.meb')}><Popover.Content className="ledger-filter-browser" aria-label="台账筛选" sideOffset={6} collisionPadding={12}>
 <header><strong>按列筛选</strong><Popover.Close asChild><button aria-label="关闭筛选面板">×</button></Popover.Close></header><p>同列多选满足任一项，不同列同时满足。候选数量随其他条件更新。</p>
 <div className="filter-fields">{fields.map(column=><LedgerColumnFilter key={column.id} label column={column} rows={()=>filterLedgerRows(rows,columns,kind,{query,status,filters,omit:column.id})} kind={kind} condition={filters[column.id]} onChange={condition=>onFilter(column.id,condition)} onSort={column.id==='$attachments'?undefined:d=>onSort(column.id,d)}/>)}</div>
 <label className="filter-operator">排序<select aria-label="排序字段" value={sort} onChange={e=>onSort(e.target.value,direction)}><option value="">录入顺序</option>{columns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{sort&&<select aria-label="排序方向" value={direction} onChange={e=>onSort(sort,e.target.value)}><option value="asc">升序</option><option value="desc">降序</option></select>}
 {views.length>0&&<label className="filter-operator">已存视图<select aria-label="应用已存视图" value="" onChange={e=>{onView(views.find(v=>v.id===e.target.value));setOpen(false);}}><option value="">选择视图…</option>{views.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}</select></label>}
 <footer><button onClick={()=>{onSave();setOpen(false);}}>保存当前视图</button><button onClick={onReset}>清空全部筛选</button></footer></Popover.Content></Popover.Portal></Popover.Root>
 {(active.length>0||status||query||sort)&&<div className="ledger-active-filters"><span>显示 {count} / {rows.length} 条</span>{active.map(id=><button key={id} className="filter-chip" title={conditionLabel(filters[id])+' · 点击清除此列筛选'} aria-label={'清除'+(fields.find(c=>c.id===id)?.name||'已删除字段')+'筛选'} onClick={()=>onFilter(id,null)}><span className="filter-chip-text">{fields.find(c=>c.id===id)?.name||'已删除字段'}：{conditionLabel(filters[id])}</span><span className="filter-chip-clear" aria-hidden="true">×</span></button>)}{status&&<span>状态：{status}</span>}{sort&&<span>{columns.find(c=>c.id===sort)?.name} {direction==='desc'?'↓':'↑'}</span>}<button onClick={onReset}>重置</button></div>}</>;
}
