import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardSummary,projectSummary} from './dashboard-summary.js';

test('dashboard counts incomplete records without mixing quantities or including blank input rows',()=>{
 const complete={id:'signed',cells:{number:'SF-001',location:'示例部位',description:'示例工作',unit:'m',reported:'0',approval0:'签字',approval1:'盖章',approval2:'签字',approval3:'签字'}};
 const pending={id:'pending',cells:{...complete.cells,number:'SF-002',unit:'m²',reported:'100',approval3:''}};
 const summary=projectSummary({rows:[complete,pending,{id:'blank',cells:{}}]});
 assert.deepEqual(summary,{receipts:2,pending:1,calculations:0});
 assert.equal(complete.cells.reported,'0');
});

test('dashboard totals are scoped to current projects and distinguish calculations from business ledgers',()=>{
 const a={id:'a',rows:[],model:true,ledgers:{calculation:{rows:[{},{}]},contract:{rows:[{},{}]}}};
 const b={id:'b',rows:[{cells:{number:'draft'}}],model:false};
 const summary=dashboardSummary([a,b]);
 assert.equal(summary.projects,2);assert.equal(summary.pending,1);assert.equal(summary.receipts,1);assert.equal(summary.calculations,2);assert.equal(summary.withModel,1);
 assert.deepEqual(dashboardSummary([]),{summaries:[],projects:0,pending:0,receipts:0,calculations:0,withModel:0});
});
