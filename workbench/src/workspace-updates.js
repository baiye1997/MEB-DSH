import {readLedger} from './ledger-state.js';
import {editCalculationSheet,findCalculationSheet} from './calculation-sheet.js';

// Edit the active document without copying other projects, attachments or undo snapshots.
function replaceProject(data,id,change){
 const project=data.projects.find(p=>p.id===id);
 if(!project)throw Error('项目不存在，请重新选择');
 const next=change(project);
 return {...data,projects:data.projects.map(p=>p===project?next:p)};
}
export function updateProjectFields(data,id,fields,change){
 return replaceProject(data,id,project=>{
  const next={...project};
  for(const key of fields)next[key]=structuredClone(project[key]);
  change(next);return next;
 });
}
export function updateCalculationData(data,id,kind,worksheetId,change){
 return replaceProject(data,id,project=>{
  const sheet=findCalculationSheet(project,kind,worksheetId);
  if(worksheetId&&!sheet)throw Error('工作表不存在，请重新选择');
  const next=worksheetId?{...project,calculationWorksheets:project.calculationWorksheets.map(s=>s===sheet?structuredClone(s):s)}:{...project,calculationSheets:{...project.calculationSheets,...(sheet?{[kind]:structuredClone(sheet)}:{})}};
  editCalculationSheet(next,kind,worksheetId,change);return next;
 });
}
export function updateBusinessBook(data,id,kind,worksheetId,change){
 if(kind==='materials'){const book=structuredClone(data.materials);change(book);return {...data,materials:book};}
 return replaceProject(data,id,project=>{
  const book=readLedger(project,kind,worksheetId),nextBook=structuredClone({columns:book.columns,rows:book.rows,views:book.views,format:book.format});
  change(nextBook);
  if(worksheetId)return {...project,businessWorksheets:project.businessWorksheets.map(s=>s.id===worksheetId?{...s,...nextBook}:s)};
  return kind==='receipt'?{...project,...nextBook}:{...project,ledgers:{...project.ledgers,[kind]:nextBook}};
 });
}
