import {sheetAlignment,sheetPaint,setSheetAlignment,setSheetPaint} from './sheet-format.js';
const valid=id=>typeof id==='string'&&id.length>0&&id.length<=100&&!['__proto__','prototype','constructor'].includes(id);
export function rangeBetween(rows,columns,anchor,focus,kind='cell'){
 const rowIds=rows.map(r=>String(r.id??r)),columnIds=columns.map(c=>String(c.id??c));
 const span=(ids,a,b)=>{const x=ids.indexOf(a),y=ids.indexOf(b);return x<0||y<0?[]:ids.slice(Math.min(x,y),Math.max(x,y)+1);};
 return {kind,rowId:anchor.rowId,columnId:anchor.columnId,anchor,focus,rowIds:kind==='column'?rowIds:span(rowIds,anchor.rowId,focus.rowId),columnIds:kind==='row'?columnIds:span(columnIds,anchor.columnId,focus.columnId)};
}
export function formatTargets(selection,scope='cell'){
 const rowIds=[...new Set(selection?.rowIds||[selection?.rowId])].filter(valid),columnIds=[...new Set(selection?.columnIds||[selection?.columnId])].filter(valid);
 if(!columnIds.length||scope!=='column'&&!rowIds.length)throw Error('先选择需要格式化的范围');
 if(scope==='row')return {rowIds,columnIds:selection.allColumnIds||columnIds};
 if(scope==='column')return {rowIds:selection.allRowIds||rowIds,columnIds};
 return {rowIds,columnIds};
}
// One clone and one parent change keep each range operation a single undo step.
export function changeRangeFormat(format,selection,scope,action){
 const {rowIds,columnIds}=formatTargets(selection,scope);let next=structuredClone(format||{});
 if(scope==='column'){
  for(const columnId of columnIds){const target={scope:'column',columnId};if(['align','brush','clear'].includes(action.type))next=setSheetAlignment(next,target,action.type==='clear'?(selection.defaults?.[columnId]||'left'):action.alignment);if(action.type==='paint')next=setSheetPaint(next,target,action.property,action.value);if(['brush','clear'].includes(action.type))for(const property of ['fill','color'])next=setSheetPaint(next,target,property,action.type==='clear'?null:action.paint?.[property]??null);}
  if(['brush','clear'].includes(action.type))next.rules=(next.rules||[]).filter(rule=>!columnIds.includes(rule.columnId));return next;
 }
 if(rowIds.length*columnIds.length>200000)throw Error('所选范围超过20万个单元格，请分批设置');
 if(![...rowIds,...columnIds].every(valid))throw Error('范围标识无效');
 for(const rowId of rowIds)for(const columnId of columnIds){
  if(action.type==='align'||action.type==='brush'||action.type==='clear'){
   const alignment=action.type==='clear'?(selection.defaults?.[columnId]||'left'):action.alignment;
   if(!['left','center','right'].includes(alignment))throw Error('对齐方式无效');
   next.cells??={};next.cells[rowId]??={};next.cells[rowId][columnId]=alignment;
  }
  if(action.type==='paint'||action.type==='brush'||action.type==='clear'){
   const values=action.type==='paint'?{[action.property]:action.value}:action.type==='brush'?{fill:action.paint?.fill??null,color:action.paint?.color??null}:{fill:null,color:null};
   for(const [property,value] of Object.entries(values))if(!['fill','color'].includes(property)||value!==null&&!/^#[\da-f]{6}$/i.test(value))throw Error('颜色无效');
   next.paint??={};next.paint.cells??={};next.paint.cells[rowId]??={};next.paint.cells[rowId][columnId]={...next.paint.cells[rowId][columnId],...values};
  }
 }
 if(scope==='row')for(const rowId of rowIds){
  if(['align','brush'].includes(action.type)){next.rows??={};next.rows[rowId]=action.alignment;delete next.cells?.[rowId];}
  if(['paint','brush'].includes(action.type)){const values=action.type==='paint'?{[action.property]:action.value}:{fill:action.paint?.fill??null,color:action.paint?.color??null};next.paint??={};next.paint.rows??={};next.paint.rows[rowId]={...next.paint.rows[rowId],...values};for(const cell of Object.values(next.paint.cells?.[rowId]||{}))for(const property of Object.keys(values))delete cell[property];}
  if(action.type==='clear'){delete next.rows?.[rowId];delete next.paint?.rows?.[rowId];}
 }
 if(['clear','brush'].includes(action.type))next.rules=(next.rules||[]).map(rule=>columnIds.includes(rule.columnId)?{...rule,excludeRows:[...new Set([...(rule.excludeRows||[]),...rowIds])]}:rule);
 return next;
}
export function copyCellFormat(format,selection,value){return {type:'brush',alignment:sheetAlignment(format,selection.rowId,selection.columnId,selection.defaultAlignment),paint:sheetPaint(format,selection.rowId,selection.columnId,value)};}
