import {ledgerDisplayColumns} from './ledger-layout.js';
import {specs} from './calculations.js';
import {cellValue} from './business.js';
import {participatingFields} from './calculation-sheet.js';

// Selection is explicit: a normal export always includes all visible rows.
export function exportRows(rows,scope,selectedOnly=false){
 if(!scope)return selectedOnly?[]:rows;
 const ids=new Set(selectedOnly?scope.selectedIds:scope.rowIds);
 return rows.filter(r=>ids.has(r.id));
}
export function snapshotColumns(source){
 if(!source)return ['','','','','',''];
 const fields=source.sheetId==='custom'?(source.customRule?.variables||[]).map(v=>[v.name,v.name,v.unit]):participatingFields(source.sheetId,source.mode);
 return [source.formula,fields.map(([id,label,unit])=>`${label}：${source.inputs[id]??'未留存'}${unit?' '+unit:''}`).join('\n'),source.expression||'',source.result,source.unit||'',source.capturedAt];
}
function exportNote(row){
 const s=row.source,note=row.notes||'';if(!s||s.sheetId==='custom')return note;
 const generated=`${s.projectName} / ${specs[s.sheetId]?.name} / 行 ${s.rowId}\n${s.workbook}`;
 return note.startsWith(generated)?note.slice(generated.length).trim():note;
}
export function ledgerExportMatrix(rows,columns,kind){
 columns=ledgerDisplayColumns(columns,kind);
 const snapshots=rows.some(r=>r.source);
 const numeric=v=>v!==''&&/^-?\d+(\.\d+)?$/.test(v)&&v.replace(/[^0-9]/g,'').length<=15?Number(v):v;
 return [[...columns.map(c=>c.name),'补充说明',...(snapshots?['计算规则','入账时参数','代入算式','入账时计算结果','结果单位','入账时间']:[])],...rows.map(r=>[...columns.map(c=>['number','computed'].includes(c.type)?numeric(cellValue(r,c,kind)):cellValue(r,c,kind)),exportNote(r),...(snapshots?snapshotColumns(r.source):[])])];
}
