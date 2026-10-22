import {ledgerNames} from './model.js';
export function searchWorkspace(data,query,limit=50){
 const terms=String(query).trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);if(!terms.length)return [];
 const matches=text=>terms.every(t=>String(text).toLocaleLowerCase().includes(t)),out=[];
 for(const project of data.projects){
  if(matches(project.name))out.push({id:'project:'+project.id,projectId:project.id,page:'overview',title:project.name,detail:'项目'});
  const books=[{...project,kind:'receipt',worksheetId:'',worksheetName:'工作表 1'},...Object.entries(project.ledgers||{}).map(([kind,b])=>({...b,kind,worksheetId:'',worksheetName:'工作表 1'})),...(project.businessWorksheets||[]).map(b=>({...b,worksheetId:b.id,worksheetName:b.name}))];
  for(const book of books)for(const row of book.rows){if(out.length>=limit)return out;const text=Object.values(row.cells).join(' ');if(matches(text))out.push({id:project.id+':'+book.kind+':'+book.worksheetId+':'+row.id,projectId:project.id,page:'table',ledger:book.kind,worksheetId:book.worksheetId,rowId:row.id,title:[row.cells.number,row.cells.title||row.cells.description||row.cells.itemName||text].filter(Boolean).join(' · ').slice(0,150)||'未命名记录',detail:project.name+' / '+ledgerNames[book.kind]+' / '+book.worksheetName});}
 }
 for(const file of data.files||[]){if(out.length>=limit)break;if(matches(file.name))out.push({id:'file:'+file.id,projectId:file.projectId,page:'files',title:file.name,detail:'附件 · '+(data.projects.find(p=>p.id===file.projectId)?.name||'')});}
 return out.slice(0,limit);
}
