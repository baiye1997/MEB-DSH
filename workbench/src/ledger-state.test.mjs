import test from 'node:test';
import assert from 'node:assert/strict';
import {blankProject} from './model.js';
import {initial} from '../test-fixtures/workspace.mjs';
import {readLedger,updateLedgerCell} from './ledger-state.js';
test('cell edits share untouched records and do not mutate undo snapshots or other projects',()=>{
 const d=initial();d.projects=[blankProject('a','甲'),blankProject('b','乙')];
 d.projects[0].rows=[{id:'r',cells:{remarks:'旧'},notes:'旧',files:[]},{id:'other',cells:{},notes:'',files:[]}];
 const n=updateLedgerCell(d,'a','receipt','r','remarks','新');
 assert.equal(d.projects[0].rows[0].notes,'旧');assert.equal(n.projects[0].rows[0].notes,'新');
 assert.equal(n.projects[1],d.projects[1]);assert.equal(n.projects[0].rows[1],d.projects[0].rows[1]);assert.equal(n.files,d.files);
 assert.equal(updateLedgerCell(n,'a','receipt','r','remarks','新'),n);
});
test('reading missing and legacy ledgers is cached without mutating source data',()=>{
 const p={ledgers:{calculation:{columns:[{id:'reported'}],rows:[{id:'r',cells:{reported:'2',unit:'m'}}]}}};
 const original=structuredClone(p),calc=readLedger(p,'calculation');assert.equal(calc.rows[0].cells.quantity,'2');
 assert.equal(readLedger(p,'calculation'),calc);readLedger(p,'change');assert.deepEqual(p,original);
});
