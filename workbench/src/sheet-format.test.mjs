import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSheetAlignment,sheetAlignment,setSheetAlignment} from './sheet-format.js';
import {validate,ledgerBook} from './model.js';
import {initial} from '../test-fixtures/workspace.mjs';

test('alignment precedence uses stable row and column IDs without mutating undo snapshots',()=>{
 const column=setSheetAlignment(undefined,{scope:'column',columnId:'quantity'},'right');
 const row=setSheetAlignment(column,{scope:'row',rowId:'r2'},'center');
 const cell=setSheetAlignment(row,{scope:'cell',rowId:'r2',columnId:'quantity'},'left');
 assert.equal(sheetAlignment(cell,'r2','quantity'),'left');
 assert.equal(sheetAlignment(cell,'r2','other'),'center');
 assert.equal(sheetAlignment(cell,'r1','quantity'),'right');
 assert.equal(sheetAlignment(column,'r2','quantity'),'right');
 assert.equal(sheetAlignment(row,'r2','quantity'),'center');
 assert.equal(column.rows,undefined);assert.equal(row.cells,undefined);
 assert.deepEqual(['other','quantity'].map(id=>sheetAlignment(cell,'r2',id)),['center','left']);
 assert.equal(defaultSheetAlignment('computed'),'right');assert.equal(defaultSheetAlignment('date'),'center');assert.equal(defaultSheetAlignment('text','unit'),'center');assert.equal(defaultSheetAlignment('text'),'left');
 assert.equal(sheetAlignment({columns:{}},'r','constructor','right'),'right');
 assert.throws(()=>setSheetAlignment(cell,{scope:'cell',columnId:'quantity'},'left'),/选择/);
 assert.throws(()=>setSheetAlignment(cell,{scope:'column',columnId:'quantity'},'justify'),/无效/);
});

test('the latest row or column action replaces overrides only within its range',()=>{
 const original={columns:{quantity:'center',note:'right'},rows:{r1:'left',r3:'center'},cells:{r1:{quantity:'center',note:'right'},r2:{quantity:'left',note:'center'},r3:{other:'right'}}},snapshot=structuredClone(original);
 const column=setSheetAlignment(original,{scope:'column',columnId:'quantity'},'right');
 for(const row of ['r1','r2','r3','new'])assert.equal(sheetAlignment(column,row,'quantity'),'right');
 assert.equal(column.cells.r2.quantity,undefined);assert.equal(column.cells.r1.quantity,'right');assert.equal(column.cells.r3.quantity,'right');
 assert.equal(sheetAlignment(column,'r1','note'),'right');assert.equal(sheetAlignment(column,'r2','note'),'center');assert.equal(sheetAlignment(column,'r3','other'),'right');
 assert.deepEqual(column.rows,original.rows);assert.equal(column.columns.note,'right');assert.deepEqual(original,snapshot);
 const columnSnapshot=structuredClone(column),row=setSheetAlignment(column,{scope:'row',rowId:'r1'},'center');
 for(const field of ['quantity','note','new'])assert.equal(sheetAlignment(row,'r1',field),'center');
 assert.equal(row.cells.r1,undefined);assert.equal(sheetAlignment(row,'r2','quantity'),'right');assert.equal(sheetAlignment(row,'r2','note'),'center');assert.deepEqual(column,columnSnapshot);
 const rowSnapshot=structuredClone(row),cell=setSheetAlignment(row,{scope:'cell',rowId:'r1',columnId:'quantity'},'left');
 assert.equal(sheetAlignment(cell,'r1','quantity'),'left');assert.equal(sheetAlignment(cell,'r1','note'),'center');assert.deepEqual(row,rowSnapshot);
 const resetColumn=setSheetAlignment(cell,{scope:'column',columnId:'quantity'},'center');
 for(const id of ['r1','r2','r3'])assert.equal(sheetAlignment(resetColumn,id,'quantity'),'center');
 assert.equal(sheetAlignment(resetColumn,'r2','note'),'center');assert.equal(sheetAlignment(resetColumn,'r3','other'),'right');assert.equal(sheetAlignment(cell,'r1','quantity'),'left');
});

test('old projects load unchanged and formatting survives validation and JSON reload for every sheet owner',()=>{
 const data=validate(initial()),project=data.projects[0];
 assert.equal(project.format,undefined);assert.equal(project.quickToolFormats,undefined);
 const format=setSheetAlignment(undefined,{scope:'column',columnId:'reported'},'center');
 project.format=format;data.materials.format=format;
 ledgerBook(project,'change').format=format;
 project.calculationSheets.cable={params:{},rows:[],format};
 project.quickToolFormats={price:format};
 project.customCalculations=[{id:'custom',name:'自定义',formula:'2 * 3',unit:'m²',precision:2,variables:[],rows:[],format}];
 const loaded=validate(JSON.parse(JSON.stringify(data)));
 for(const value of [loaded.projects[0].format,loaded.materials.format,loaded.projects[0].ledgers.change.format,loaded.projects[0].calculationSheets.cable.format,loaded.projects[0].quickToolFormats.price,loaded.projects[0].customCalculations[0].format])assert.deepEqual(value,format);
 const invalid=structuredClone(data);invalid.projects[0].format.columns.reported='justify';assert.throws(()=>validate(invalid));
});

import {sheetPaint,setSheetPaint,conditionMatches,removeExtraColumn} from './sheet-format.js';
import {removeUserField} from './sheet-fields.js';
import {initial as emptyWorkspace} from './model.js';
test('new installations contain no built-in project, model, rows or attachment data',()=>{
 const value=validate(emptyWorkspace());assert.deepEqual(value.projects,[]);assert.deepEqual(value.files,[]);assert.deepEqual(value.materials.rows,[]);
 const restored=validate(JSON.parse(JSON.stringify(value)));assert.deepEqual(restored.projects,[]);
 const existing=initial();assert.equal(validate(existing).projects[0].id,'sample');
});
test('paint range actions preserve independent properties, undo state and explicit resets',()=>{
 const column=setSheetPaint(undefined,{scope:'column',columnId:'reported'},'fill','#faf1d9');
 const row=setSheetPaint(column,{scope:'row',rowId:'r1'},'color','#a23f39');
 const cell=setSheetPaint(row,{scope:'cell',rowId:'r1',columnId:'reported'},'fill','#e9effb'),before=structuredClone(cell);
 assert.deepEqual(sheetPaint(cell,'r1','reported','20'),{fill:'#e9effb',color:'#a23f39'});
 const all=setSheetPaint(cell,{scope:'column',columnId:'reported'},'fill','#eaf2eb');
 assert.equal(sheetPaint(all,'r1','reported','20').fill,'#eaf2eb');assert.equal(sheetPaint(all,'r1','reported','20').color,'#a23f39');assert.deepEqual(cell,before);
 const reset=setSheetPaint(all,{scope:'cell',rowId:'r1',columnId:'reported'},'fill',null);
 assert.equal(sheetPaint(reset,'r1','reported','20').fill,null);assert.equal(sheetPaint(reset,'r2','reported','20').fill,'#eaf2eb');
 assert.throws(()=>setSheetPaint(all,{scope:'cell',rowId:'r1',columnId:'reported'},'fill','url(fake)'),/无效/);
});
test('conditional formats compare displayed numeric values without treating blanks as zero or executing input',()=>{
 const rule={columnId:'amount',operator:'gt',value:'1000',fill:'#faf1d9'};
 assert.equal(conditionMatches(rule,'1,000.01'),true);assert.equal(conditionMatches(rule,''),false);assert.equal(conditionMatches({...rule,operator:'lt',value:'1'},''),false);
 assert.equal(conditionMatches({...rule,operator:'eq',value:'0'},'0'),true);
 assert.equal(conditionMatches({...rule,operator:'contains',value:'dn'},'DN50'),true);
 assert.equal(conditionMatches({...rule,operator:'filled'},'  '),false);
 assert.equal(conditionMatches({...rule,value:'globalThis.invalid()'},'30'),false);
 const format={paint:{columns:{amount:{color:'#315da8',fill:'#e9effb'}}},rules:[rule,{...rule,id:'later',fill:'#f9e9e7'}]};
 assert.deepEqual(sheetPaint(format,'r','amount','2000'),{color:'#315da8',fill:'#f9e9e7'});
 assert.equal(sheetPaint(format,'r','other','2000').fill,undefined);
});
test('colors, conditional rules, hidden and added calculation columns survive all owner schemas',()=>{
 const data=validate(initial()),p=data.projects[0],format={paint:{cells:{r:{reported:{fill:'#faf1d9',color:'#a23f39'}}}},rules:[{id:'r1',columnId:'reported',operator:'gt',value:'10',fill:'#f9e9e7'}],hiddenColumns:['reported'],extraColumns:[{id:'extra:note',name:'复核意见',type:'text'}],extraValues:{r:{'extra:note':'待核'}}};
 p.format=format;p.quickToolFormats={price:format};p.calculationSheets.cable={params:{},rows:[],format};p.calculationWorksheets=[{id:'second',kind:'cable',name:'另一期',params:{},rows:[],format}];ledgerBook(p,'calculation').format=format;
 const loaded=validate(JSON.parse(JSON.stringify(data))).projects[0];
 for(const value of [loaded.format,loaded.quickToolFormats.price,loaded.calculationSheets.cable.format,loaded.calculationWorksheets[0].format,loaded.ledgers.calculation.format])assert.deepEqual(value,format);
 const invalid=structuredClone(data);invalid.projects[0].format.rules[0].fill='red;position:fixed';assert.throws(()=>validate(invalid));
});
test('custom field removal isolates values and formatting, protects built-ins and keeps prior snapshots intact',()=>{
 const original={columns:[{id:'reported'},{id:'custom'}],rows:[{id:'r',cells:{reported:'10',custom:'待复核'}}],format:{rules:[{id:'rule',columnId:'custom',operator:'empty',value:'',fill:'#faf1d9'}],extraValues:{r:{custom:'text'}},paint:{columns:{custom:{fill:'#faf1d9'}}}}},before=structuredClone(original);
 assert.throws(()=>removeUserField(original,'reported',new Set(['reported'])),/内置/);
 const next=removeUserField(original,'custom',new Set(['reported']));assert.equal(next.rows[0].cells.reported,'10');assert.equal(next.rows[0].cells.custom,undefined);assert.deepEqual(next.format.rules,[]);assert.deepEqual(original,before);
 const extra=removeExtraColumn({extraColumns:[{id:'x',name:'备注',type:'text'}],extraValues:{r:{x:'a',other:'b'}},hiddenColumns:['x']},'x');assert.equal(extra.extraValues.r.other,'b');assert.equal(extra.extraValues.r.x,undefined);assert.deepEqual(extra.hiddenColumns,[]);
});
