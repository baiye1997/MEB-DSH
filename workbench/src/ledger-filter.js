import {cellValue} from './business.js';
import {decimal} from './model.js';
export const filterOperators={contains:'包含',notContains:'不包含',eq:'等于',ne:'不等于',gte:'大于等于',lte:'小于等于',between:'介于',empty:'为空',filled:'不为空'};
export const filterFields=columns=>[...columns,{id:'$attachments',name:'附件',type:'select',options:['有附件','无附件']}];
export const filterValue=(row,column,kind)=>column.id==='$attachments'?(row.files?.length?'有附件':'无附件'):String(cellValue(row,column,kind)).trim();
const collator=new Intl.Collator('zh-CN',{numeric:true}),searchTexts=new WeakMap();
function searchText(row){if(!searchTexts.has(row))searchTexts.set(row,normalize([...Object.values(row.cells),row.notes||''].join(' ')));return searchTexts.get(row);}
const normalize=value=>String(value).normalize('NFKC').toLocaleLowerCase().trim();
export function filterError(column,condition){
 if(condition?.second){const error=filterError(column,condition.second);if(error)return error;if(!condition.operator||!condition.second.operator)return '请选择两个条件';}
 if(!condition?.operator||['empty','filled'].includes(condition.operator))return '';
 if(!condition.value?.trim()||condition.operator==='between'&&!condition.to?.trim())return '请填写完整条件';
 const values=condition.operator==='between'?[condition.value,condition.to]:[condition.value];
 if(['number','computed'].includes(column.type)&&values.some(v=>decimal(v.trim())===null))return '请输入有效数字，最多 8 位小数';
 if(column.type==='date'&&values.some(v=>!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v))return '请输入有效日期';
 if(condition.operator==='between'&&(['number','computed'].includes(column.type)?decimal(values[0].trim())>decimal(values[1].trim()):values[0]>values[1]))return '范围起点不能大于终点';
 return '';
}
export function matchesColumn(row,column,condition,kind,selectedValues){
 if(!condition)return true;
 const value=filterValue(row,column,kind),{operator,value:target='',to=''}=condition;
 if(condition.values){const included=selectedValues?selectedValues.has(value):condition.values.includes(value);if(condition.selection==='exclude'?included:!included)return false;}
 if(filterError(column,condition))return false;
 if(condition.second){const first=matchesColumn(row,column,{operator,value:target,to},kind),second=matchesColumn(row,column,condition.second,kind);return condition.relation==='or'?first||second:first&&second;}
 if(!operator)return true;
 if(operator==='empty')return !value;
 if(operator==='filled')return !!value;
 const a=normalize(value),b=normalize(target);
 if(operator==='contains')return a.includes(b);
 if(operator==='notContains')return !a.includes(b);
 if(['number','computed'].includes(column.type)){
  const x=decimal(value),y=decimal(target.trim());if(x===null)return false;
  return operator==='eq'?x===y:operator==='ne'?x!==y:operator==='gte'?x>=y:operator==='lte'?x<=y:operator==='between'?x>=y&&x<=decimal(to.trim()):false;
 }
 return operator==='eq'?a===b:operator==='ne'?a!==b:operator==='gte'?!!value&&a>=b:operator==='lte'?!!value&&a<=b:operator==='between'?!!value&&a>=b&&a<=normalize(to):false;
}
export function filterLedgerRows(rows,columns,kind,{query='',status='',filters={},omit}={}){
 const terms=normalize(query).split(/\s+/).filter(Boolean),fields=filterFields(columns),lookup=new Map(fields.map(c=>[c.id,c])),conditions=Object.entries(filters),selections=new Map(Object.entries(filters).map(([id,c])=>[id,c.values?new Set(c.values):null]));
 return rows.filter(row=>(!status||row.cells.status===status)&&(!terms.length||terms.every(term=>searchText(row).includes(term)))&&conditions.every(([id,condition])=>id===omit?true:lookup.has(id)&&matchesColumn(row,lookup.get(id),condition,kind,selections.get(id))));
}
export function columnValueCounts(rows,column,kind){const counts=new Map();for(const row of rows){const v=filterValue(row,column,kind);counts.set(v,(counts.get(v)||0)+1);}return [...counts].sort(([a],[b])=>collator.compare(a,b));}
export function sortLedgerRows(rows,columns,kind,sort,direction='asc'){
 const column=columns.find(c=>c.id===sort);if(!column)return rows;
 return [...rows].sort((a,b)=>{const x=filterValue(a,column,kind),y=filterValue(b,column,kind);if(!x||!y)return !x&&!y?0:!x?1:-1;let n;if(['number','computed'].includes(column.type)){const p=decimal(x),q=decimal(y);if(p===null||q===null)return p===q?0:p===null?1:-1;n=p===q?0:p<q?-1:1;}else n=collator.compare(x,y);return direction==='desc'?-n:n;});
}
