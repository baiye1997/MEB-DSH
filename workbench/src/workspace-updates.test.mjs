import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial} from '../test-fixtures/workspace.mjs';
import {blankProject,ledgerBook} from './model.js';
import {updateBusinessBook,updateCalculationData,updateProjectFields} from './workspace-updates.js';
test('active sheet edits preserve unrelated project and attachment identity, and undo snapshots',()=>{
 const data=initial(),p=data.projects[0];data.projects.push(blankProject('other','其他项目'));
 p.calculationSheets={cable:{params:{current:'90'},rows:[]},bus:{params:{current:'80'},rows:[]}};
 const next=updateCalculationData(data,p.id,'cable','',s=>s.params.current='100');
 assert.equal(p.calculationSheets.cable.params.current,'90');assert.equal(next.projects[0].calculationSheets.cable.params.current,'100');
 assert.equal(next.projects[0].rows,p.rows);assert.equal(next.projects[0].calculationSheets.bus,p.calculationSheets.bus);assert.equal(next.projects[1],data.projects[1]);assert.equal(next.files,data.files);
 const edited=updateProjectFields(next,p.id,['quickTools','quickToolFormats'],q=>{q.quickTools=[{id:'new'}];});assert.deepEqual(next.projects[0].quickTools,[]);assert.equal(edited.projects[0].rows,p.rows);
});
test('business formatting and structural edits isolate the exact worksheet and keep prior data intact',()=>{
 const data=initial(),p=data.projects[0];p.businessWorksheets=[{id:'extra',kind:'receipt',name:'分表',columns:[],rows:[],views:[]}];
 const oldRows=p.rows,contract=ledgerBook(p,'contract');
 const next=updateBusinessBook(data,p.id,'receipt','extra',book=>book.rows.push({id:'r',cells:{}}));
 assert.equal(p.businessWorksheets[0].rows.length,0);assert.equal(next.projects[0].businessWorksheets[0].rows.length,1);assert.equal(next.projects[0].rows,oldRows);assert.equal(next.projects[0].ledgers.contract,contract);
 assert.throws(()=>updateBusinessBook(data,p.id,'receipt','missing',()=>{}),/工作表/);
 assert.throws(()=>updateCalculationData(data,'missing','cable','',()=>{}),/项目/);
});
