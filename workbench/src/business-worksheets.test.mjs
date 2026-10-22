import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProject,validate,initial,ledgerBook,allRows,restoreBackup} from './model.js';
import {addBusinessWorksheet,renameBusinessWorksheet,businessRows} from './business-worksheets.js';
import {readLedger,updateLedgerCell} from './ledger-state.js';
import {queryProject,projectContext} from './dsh-bridge.js';
import {prepareChanges} from './assistant-changes.js';
import {searchWorkspace} from './workspace-search.js';
const row=id=>({id,cells:{description:'复核 '+id,reported:'2',unit:'m'},files:[],notes:''});
test('business sheets keep legacy rows, fields and formatting independent across save, restore and cell updates',()=>{
 const p=blankProject('p','验收项目'),d={...initial(),projects:[p]};p.rows=[row('r1')];const sheet=addBusinessWorksheet(p,'receipt','复核表','s1');sheet.rows=[row('r2')];sheet.columns[0].name='独立字段';sheet.format={paint:{cells:{r2:{reported:{fill:'#e9effb'}}}}};
 const saved=validate(JSON.parse(JSON.stringify(d)));assert.equal(saved.projects[0].columns[0].name,'收方单编号');assert.equal(readLedger(saved.projects[0],'receipt','s1').rows[0].id,'r2');
 const changed=updateLedgerCell(saved,'p','receipt','r2','reported','9','s1');assert.equal(readLedger(changed.projects[0],'receipt','s1').rows[0].cells.reported,'9');assert.equal(saved.projects[0].businessWorksheets[0].rows[0].cells.reported,'2');assert.equal(changed.projects[0].rows[0].cells.reported,'2');assert.equal(allRows(changed.projects[0]).length,2);assert.equal(businessRows(changed.projects[0],'receipt').length,2);
 assert.deepEqual(restoreBackup(changed,4).projects[0].businessWorksheets,changed.projects[0].businessWorksheets);assert.throws(()=>ledgerBook(p,'change','s1'),/不匹配/);assert.throws(()=>addBusinessWorksheet(p,'receipt','复核表'),/已存在/);renameBusinessWorksheet(p,'receipt','s1','第二复核表');assert.equal(p.businessWorksheets[0].name,'第二复核表');
});
test('assistant queries, change proposals and search route to the exact business sheet',()=>{
 const p=blankProject('p','验收项目'),d={...initial(),projects:[p]};p.rows=[row('r1')];addBusinessWorksheet(p,'receipt','复核表','s1').rows=[row('r2')];
 const detail=JSON.parse(queryProject(d,{projectId:'p',ledger:'receipt',worksheetId:'s1'}));assert.equal(detail.worksheetId,'s1');assert.equal(detail.rows[0].id,'r2');assert.equal(detail.worksheets.length,2);assert.equal(JSON.parse(projectContext(p,'table','receipt',{businessWorksheetId:'s1'})).worksheetName,'复核表');assert.throws(()=>queryProject(d,{projectId:'p',ledger:'receipt',worksheetId:'missing'}));
 const proposal={version:1,id:'qa',projectId:'p',ledger:'receipt',worksheetId:'s1',operations:[{type:'update',rowId:'r2',before:{reported:'2'},cells:{reported:'8'}}]};const next=prepareChanges(d,proposal,'p').next;assert.equal(next.projects[0].rows[0].cells.reported,'2');assert.equal(next.projects[0].businessWorksheets[0].rows[0].cells.reported,'8');
 const result=searchWorkspace(d,'复核 r2');assert.equal(result[0].worksheetId,'s1');assert.equal(result[0].rowId,'r2');assert.equal(d.projects[0].businessWorksheets[0].rows[0].cells.reported,'2');
});
