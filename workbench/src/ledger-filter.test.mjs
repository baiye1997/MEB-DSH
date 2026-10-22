import test from 'node:test';
import assert from 'node:assert/strict';
import {businessColumns} from './business.js';
import {validate} from './model.js';
import {initial} from '../test-fixtures/workspace.mjs';
import {filterLedgerRows,columnValueCounts,filterError,sortLedgerRows} from './ledger-filter.js';
import {ledgerExportMatrix} from './ledger-export.js';
const columns=businessColumns('receipt');
const rows=[
 {id:'a',cells:{location:'教学楼一层',discipline:'电气',description:'照明配管',reported:'10.00000001',unit:'m',date:'2026-09-01'},files:[],notes:''},
 {id:'b',cells:{location:'教学楼二层',discipline:'电气',description:'照明配管',reported:'10.00000002',unit:'m',date:'2026-09-29'},files:['file'],notes:''},
 {id:'c',cells:{location:'教学楼二层',discipline:'给排水',description:'给水管',reported:'0',unit:'m',date:''},files:[],notes:''},
 {id:'d',cells:{location:'教学楼二层',discipline:'消防',reported:''},files:[],notes:''}
];
test('Excel selections intersect across columns, include blank and preserve contextual value counts',()=>{
 const filters={discipline:{selection:'include',values:['电气','给排水']},location:{selection:'include',values:['教学楼二层']}};
 const chosen=filterLedgerRows(rows,columns,'receipt',{filters});assert.deepEqual(chosen.map(r=>r.id),['b','c']);
 assert.deepEqual(columnValueCounts(filterLedgerRows(rows,columns,'receipt',{filters,omit:'discipline'}),columns.find(c=>c.id==='discipline'),'receipt'),[['电气',1],['给排水',1],['消防',1]]);
 assert.deepEqual(filterLedgerRows(rows,columns,'receipt',{filters:{reported:{selection:'include',values:['']}}}).map(r=>r.id),['d']);
 assert.equal(filterLedgerRows(rows,columns,'receipt',{filters:{unit:{selection:'include',values:[]}}}).length,0);
 assert.deepEqual(filterLedgerRows(rows,columns,'receipt',{query:'二层 电气',filters:{$attachments:{selection:'include',values:['有附件']}}}).map(r=>r.id),['b']);
 assert.equal(filterLedgerRows(rows,columns,'receipt',{filters:{deleted:{operator:'filled'}}}).length,0);
 assert.deepEqual(ledgerExportMatrix(chosen,columns,'receipt').slice(1).map(r=>r[3]),[10.00000002,0]);
});
test('numeric and date ranges distinguish empty from zero, keep precision, and reject invalid ranges',()=>{
 const select=(id,condition)=>filterLedgerRows(rows,columns,'receipt',{filters:{[id]:condition}}).map(r=>r.id);
 assert.deepEqual(select('reported',{operator:'gte',value:'10.00000002'}),['b']);
 assert.deepEqual(select('reported',{operator:'eq',value:'0',relation:'or',second:{operator:'gte',value:'10.00000002'}}),['b','c']);
 assert.deepEqual(select('location',{operator:'contains',value:'教学楼',relation:'and',second:{operator:'notContains',value:'一层'}}),['b','c','d']);
 assert.deepEqual(select('reported',{operator:'lte',value:'0'}),['c']);
 assert.deepEqual(select('date',{operator:'between',value:'2026-09-02',to:'2026-09-29'}),['b']);
 assert.deepEqual(select('reported',{selection:'exclude',values:[''],operator:'filled'}),['a','b','c']);
 const date=columns.find(c=>c.id==='date'),number=columns.find(c=>c.id==='reported');
 assert.ok(filterError(date,{operator:'eq',value:'2026-02-30'}));assert.ok(filterError(number,{operator:'between',value:'20',to:'10'}));
 assert.deepEqual(sortLedgerRows(rows,columns,'receipt','reported','desc').map(r=>r.id),['b','a','c','d']);
});
test('saved filters survive validation and legacy views remain valid',()=>{
 const data=initial(),filters={columnFilters:{reported:{operator:'between',value:'0',to:'10.00000002'},discipline:{selection:'exclude',values:['消防'],operator:'contains',value:'电',relation:'or',second:{operator:'contains',value:'水'}}},sortDirection:'desc'};
 data.projects[0].views=[{id:'new',name:'本层电气',query:'二层',status:'',sort:'reported',filters},{id:'old',name:'旧视图',query:'',status:'',sort:''}];
 const restored=validate(JSON.parse(JSON.stringify(data))).projects[0].views;assert.deepEqual(restored[0].filters,filters);assert.equal(restored[1].filters,undefined);
});
