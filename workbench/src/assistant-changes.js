import {ledgerBook,validate} from './model.js';
export const changeInstructions=`用户要生成、填写或修改台账时，只提出建议，不调用工具写入。字段和依据足够时，正文后必须附一份 meb-change 代码块，其 JSON 格式为 {"version":1,"id":"本次建议唯一编号","projectId":"当前项目ID","ledger":"receipt|change|output|contract|calculation|materials","summary":"说明","operations":[{"type":"update","rowId":"已有行ID","before":{"字段ID":"快照原值"},"cells":{"字段ID":"建议新值"}},{"type":"append","cells":{"字段ID":"新值"}}]}。目标为附加工作表时必须带 worksheetId（来自当前快照或查询结果），不得省略或跨表写入。全部值使用字符串，字段 ID 必须来自快照或查询结果 columns。资料不足先列缺项，不猜测，也不生成不完整块。材料价格库是个人共享库，仍须用户预览确认。最多100项操作，只涉及当前项目已有字段；不要删除记录或修改计算来源快照。建议必须由用户预览确认后才会进入编辑区。`;
const changeBlock=/```meb-change(?:\s+json)?\s*\r?\n([\s\S]*?)```/i;
const changeBlocks=/```meb-change(?:\s+json)?\s*\r?\n([\s\S]*?)```/gi;
export function hasChanges(text){return changeBlock.test(String(text||''));}
export function extractChanges(text){const blocks=[...String(text||'').matchAll(changeBlocks)];if(!blocks.length)return null;if(blocks.length!==1)throw Error('每条回复只支持一份修改建议');if(blocks[0][1].length>100000)throw Error('修改建议过长，请分批');try{return JSON.parse(blocks[0][1]);}catch{throw Error('修改建议格式不完整，请让 DSH 重新生成');}}
export function prepareChanges(data,proposal,projectId){
 if(!proposal||proposal.version!==1||typeof proposal.id!=='string'||!/^[-\w]{1,80}$/.test(proposal.id))throw Error('建议编号或版本无效');
 if(proposal.projectId!==projectId)throw Error('建议属于其他项目，不能写入当前项目');
 if(!['receipt','change','output','contract','calculation','materials'].includes(proposal.ledger))throw Error('不支持的台账');
 if(!Array.isArray(proposal.operations)||!proposal.operations.length||proposal.operations.length>100)throw Error('每次建议须为1至100项修改');
 const next=structuredClone(data),project=next.projects.find(p=>p.id===projectId);if(!project)throw Error('目标项目已不存在');
 const book=proposal.ledger==='materials'?next.materials:ledgerBook(project,proposal.ledger,proposal.worksheetId||''),fields=new Map(book.columns.map(c=>[c.id,c]));const changes=[],seen=new Set();
 proposal.operations.forEach((op,index)=>{
  if(!op||!['append','update'].includes(op.type)||!op.cells||Array.isArray(op.cells)||typeof op.cells!=='object'||!Object.keys(op.cells).length)throw Error('修改操作无效');
  const id=op.type==='append'?`dsh-${proposal.id}-${index}`:op.rowId;
  if(typeof id!=='string'||seen.has(id))throw Error('一份建议中不能重复修改同一行');seen.add(id);
  let row=book.rows.find(r=>r.id===id);
  if(op.type==='append'){if(row)throw Error('该建议已经添加过记录，请勿重复应用');row={id,cells:{},notes:'DSH 建议，经用户确认：'+proposal.id,files:[]};book.rows.push(row);}else if(!row)throw Error('建议中的记录已不存在，请重新生成');
  const originalLabel=[row.cells.number,row.cells.location,row.cells.description||row.cells.title||row.cells.itemName].filter(Boolean).join(' · ');
  const diff=[];
  for(const [key,value] of Object.entries(op.cells)){
   const field=fields.get(key);if(!field||field.type==='computed')throw Error('建议包含未知或计算字段：'+key);
   if(row.source&&['description','specification','unit','quantity','amount','reported'].includes(key))throw Error('入账快照请从原计算行修改后重新入账');
   if(typeof value!=='string'||value.length>10000)throw Error(field.name+'必须是有效文本');
   const before=row.cells[key]??'';
   if(op.type==='update'&&(!Object.hasOwn(op.before||{},key)||op.before[key]!==before))throw Error(field.name+'已发生变化，请基于最新记录重新生成建议');
   if(before!==value)diff.push({field:field.name,before,after:value});row.cells[key]=value;
  }
  if(!diff.length)throw Error('建议没有改变内容，无需再次应用');
  changes.push({type:op.type,rowId:id,index:book.rows.indexOf(row)+1,label:(originalLabel||[row.cells.number,row.cells.location,row.cells.description||row.cells.title||row.cells.itemName].filter(Boolean).join(' · ')).slice(0,200),diff});
 });
 validate(next);return {next,changes,ledger:proposal.ledger,worksheetId:proposal.worksheetId||''};
}
