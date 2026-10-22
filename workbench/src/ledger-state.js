import {ledgerBook} from './model.js';
import {setLedgerCell} from './business.js';

// Reading a ledger must not clone the project's other rows or mutate undo history.
const reads=new WeakMap();
export function readLedger(project,key='receipt',worksheetId=''){
 if(worksheetId)return ledgerBook(project,key,worksheetId);
 if(key==='receipt')return project;
 const existing=project.ledgers?.[key];
 if(existing&&(key!=='calculation'||existing.columns.some(c=>c.id==='quantity')))return existing;
 let cache=reads.get(project);if(!cache){cache=new Map();reads.set(project,cache);}
 if(!cache.has(key))cache.set(key,ledgerBook({ledgers:{...(existing?{[key]:structuredClone(existing)}:{})}},key));
 return cache.get(key);
}
export function updateLedgerCell(data,projectId,key,rowId,columnId,value,worksheetId=''){
 const project=data.projects.find(p=>p.id===projectId),book=key==='materials'?data.materials:readLedger(project,key,worksheetId);
 const index=book.rows.findIndex(r=>r.id===rowId);
 if(index<0||book.rows[index].cells[columnId]===value)return data;
 const row={...book.rows[index],cells:{...book.rows[index].cells}};setLedgerCell(row,columnId,value);
 const rows=book.rows.slice();rows[index]=row;
 if(key==='materials')return {...data,materials:{...book,rows}};
 const next=worksheetId?{...project,businessWorksheets:project.businessWorksheets.map(s=>s.id===worksheetId?{...s,rows}:s)}:key==='receipt'?{...project,rows}:{...project,ledgers:{...project.ledgers,[key]:{...book,rows}}};
 return {...data,projects:data.projects.map(p=>p===project?next:p)};
}
