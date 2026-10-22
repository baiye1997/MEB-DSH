import {z} from 'zod';

const alignment=z.enum(['left','center','right']);
const key=z.string().min(1).max(100).refine(value=>!['__proto__','prototype','constructor'].includes(value),'字段标识无效');
const color=z.string().regex(/^#[\da-f]{6}$/i);
const paint=z.object({fill:color.nullable().optional(),color:color.nullable().optional()});
export const conditionOperators=[['gt','大于'],['gte','大于或等于'],['lt','小于'],['lte','小于或等于'],['eq','等于'],['ne','不等于'],['contains','包含文字'],['empty','为空'],['filled','不为空']];
export const sheetFormatSchema=z.object({
 columns:z.record(key,alignment).optional(),
 rows:z.record(key,alignment).optional(),
 cells:z.record(key,z.record(key,alignment)).optional(),
 paint:z.object({columns:z.record(key,paint).optional(),rows:z.record(key,paint).optional(),cells:z.record(key,z.record(key,paint)).optional()}).optional(),
 rules:z.array(z.object({id:key,columnId:key,operator:z.enum(conditionOperators.map(([id])=>id)),value:z.string().max(500).default(''),excludeRows:z.array(key).max(20000).optional(),includeRows:z.array(key).max(20000).optional(),fill:color.optional(),color:color.optional()})).max(50).optional(),
 hiddenColumns:z.array(key).max(60).optional(),
 extraColumns:z.array(z.object({id:key,name:z.string().trim().min(1).max(100),type:z.enum(['text','number'])})).max(30).optional(),
 extraValues:z.record(key,z.record(key,z.string().max(20000))).optional()
}).superRefine((format,ctx)=>{
 const ids=new Set(),names=new Set();
 for(const column of format.extraColumns||[]){
  if(!column.id.startsWith('extra:')||ids.has(column.id)||names.has(column.name))ctx.addIssue({code:'custom',message:'附加字段标识或名称重复'});
  ids.add(column.id);names.add(column.name);
  if(column.type==='number')for(const values of Object.values(format.extraValues||{})){const value=values[column.id];if(value&& !/^-?\d+(\.\d{1,8})?$/.test(value))ctx.addIssue({code:'custom',message:column.name+'：请输入数字（最多8位小数）'});}
 }
});
export function defaultSheetAlignment(type,columnId){
 return ['number','computed'].includes(type)?'right':type==='date'||columnId==='unit'?'center':'left';
}

const own=(object,key)=>object&&Object.hasOwn(object,key)?object[key]:undefined;
export function setSheetPaint(format,{scope,rowId,columnId},property,value){
 if(!['cell','row','column'].includes(scope)||!['fill','color'].includes(property)||value!==null&&!color.safeParse(value).success)throw Error('单元格颜色无效');
 if(rowId&&!key.safeParse(rowId).success||columnId&&!key.safeParse(columnId).success)throw Error('字段或行标识无效');
 if(scope!=='column'&&!rowId||scope!=='row'&&!columnId)throw Error('请先选择单元格');
 const next=structuredClone(format||{}),p=next.paint??={};
 const clean=cells=>{delete cells[property];return Object.keys(cells).length?cells:undefined;};
 if(scope==='column'){
  p.columns??={};p.columns[columnId]={...own(p.columns,columnId),[property]:value};
  for(const id of new Set([...Object.keys(p.cells||{}),...Object.keys(p.rows||{})])){
   const cells=p.cells?.[id];
   if(cells?.[columnId]){const rest=clean(cells[columnId]);if(rest)cells[columnId]=rest;else delete cells[columnId];}
   if(Object.hasOwn(own(p.rows,id)||{},property)){p.cells??={};p.cells[id]??={};p.cells[id][columnId]={...own(p.cells[id],columnId),[property]:value};}
  }
 }else if(scope==='row'){
  p.rows??={};p.rows[rowId]={...own(p.rows,rowId),[property]:value};
  for(const [id,cell] of Object.entries(own(p.cells,rowId)||{})){const rest=clean(cell);if(rest)p.cells[rowId][id]=rest;else delete p.cells[rowId][id];}
 }else{p.cells??={};p.cells[rowId]??={};p.cells[rowId][columnId]={...own(p.cells[rowId],columnId),[property]:value};}
 return next;
}
const numeric=value=>{const s=String(value??'').replaceAll(',','').trim();return s!==''&&/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)&&Number.isFinite(Number(s))?Number(s):null;};
export function conditionMatches(rule,value){
 const text=String(value??'').trim(),expected=String(rule.value??'').trim();
 if(rule.operator==='empty')return text==='';if(rule.operator==='filled')return text!=='';
 if(rule.operator==='contains')return text.toLocaleLowerCase().includes(expected.toLocaleLowerCase());
 const a=numeric(text),b=numeric(expected);
 if(['eq','ne'].includes(rule.operator)){const equal=a!==null&&b!==null?a===b:text.toLocaleLowerCase()===expected.toLocaleLowerCase();return rule.operator==='eq'?equal:!equal;}
 if(a===null||b===null)return false;
 return {gt:a>b,gte:a>=b,lt:a<b,lte:a<=b}[rule.operator]??false;
}
// A matching rule overrides manual paint; later matching rules win per property.
export function sheetPaint(format,rowId,columnId,value){
 const p=format?.paint,style={...own(p?.columns,columnId),...own(p?.rows,rowId),...own(own(p?.cells,rowId),columnId)};
 for(const rule of format?.rules||[])if(rule.columnId===columnId&&(!rule.includeRows||rule.includeRows.includes(rowId))&&!rule.excludeRows?.includes(rowId)&&conditionMatches(rule,value))for(const property of ['fill','color'])if(rule[property])style[property]=rule[property];
 return style;
}
export function removeExtraColumn(format,id){
 const next=structuredClone(format||{});next.extraColumns=next.extraColumns?.filter(c=>c.id!==id);next.hiddenColumns=next.hiddenColumns?.filter(key=>key!==id);next.rules=next.rules?.filter(r=>r.columnId!==id);
 for(const values of Object.values(next.extraValues||{}))delete values[id];
 delete next.columns?.[id];delete next.paint?.columns?.[id];
 for(const values of Object.values(next.cells||{}))delete values[id];for(const values of Object.values(next.paint?.cells||{}))delete values[id];
 return next;
}
export function sheetAlignment(format,rowId,columnId,fallback='left'){
 const own=(object,key)=>object&&Object.hasOwn(object,key)?object[key]:undefined;
 return own(own(format?.cells,rowId),columnId)||own(format?.rows,rowId)||own(format?.columns,columnId)||fallback;
}
// Keep formatting separate from cell values and preserve previous undo snapshots.
export function setSheetAlignment(format,{scope,rowId,columnId},value){
 if(!['left','center','right'].includes(value)||!['cell','row','column'].includes(scope))throw Error('对齐方式无效');
 if(scope!=='column'&&!rowId||scope!=='row'&&!columnId)throw Error('请先选择需要对齐的单元格');
 const next={...format};
 // Range actions replace narrower overrides in that range, as spreadsheet users expect.
 if(scope==='column'){
  next.columns={...format?.columns,[columnId]:value};
  const ids=new Set([...Object.keys(format?.cells||{}),...Object.keys(format?.rows||{})]);
  const cells=Object.fromEntries([...ids].map(id=>{
   const rowCells={...format?.cells?.[id]};delete rowCells[columnId];
   return [id,Object.hasOwn(format?.rows||{},id)?{...rowCells,[columnId]:value}:rowCells];
  }).filter(([,rowCells])=>Object.keys(rowCells).length));
  if(Object.keys(cells).length)next.cells=cells;else delete next.cells;
 }else if(scope==='row'){
  next.rows={...format?.rows,[rowId]:value};
  if(format?.cells&&Object.hasOwn(format.cells,rowId)){
   next.cells={...format.cells};delete next.cells[rowId];
   if(!Object.keys(next.cells).length)delete next.cells;
  }
 }
 else next.cells={...format?.cells,[rowId]:{...format?.cells?.[rowId],[columnId]:value}};
 return next;
}
