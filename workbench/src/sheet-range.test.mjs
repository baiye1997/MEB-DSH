import test from 'node:test';
import assert from 'node:assert/strict';
import {rangeBetween,changeRangeFormat,copyCellFormat} from './sheet-range.js';
import {sheetPaint,sheetAlignment,sheetFormatSchema} from './sheet-format.js';
test('ranges follow visible row and column order, support whole rows/columns and are atomic',()=>{
 const rows=['r3','r1','r4'].map(id=>({id})),cols=['b','a','c'].map(id=>({id}));
 const selected=rangeBetween(rows,cols,{rowId:'r3',columnId:'a'},{rowId:'r4',columnId:'c'});
 assert.deepEqual(selected.rowIds,['r3','r1','r4']);assert.deepEqual(selected.columnIds,['a','c']);
 assert.deepEqual(rangeBetween(rows,cols,{rowId:'r3',columnId:'a'},{rowId:'r1',columnId:'a'},'row').columnIds,['b','a','c']);
 const previous={paint:{cells:{r2:{a:{color:'#123456'}}}}},next=changeRangeFormat(previous,selected,'cell',{type:'paint',property:'fill',value:'#e9effb'});
 assert.equal(sheetPaint(next,'r1','c').fill,'#e9effb');assert.equal(sheetPaint(next,'r2','a').fill,undefined);assert.deepEqual(previous,{paint:{cells:{r2:{a:{color:'#123456'}}}}});
 assert.throws(()=>changeRangeFormat(next,{...selected,columnIds:['__proto__']},'cell',{type:'paint',property:'fill',value:'#ffffff'}));
});
test('clear and format brush isolate selected cells from conditional rules without affecting other rows',()=>{
 const format={columns:{a:'center'},rules:[{id:'rule',columnId:'a',operator:'gt',value:'10',fill:'#faf1d9'}],paint:{columns:{a:{color:'#a23f39'}}}};
 const selection={rowId:'r1',columnId:'a',rowIds:['r1','r3'],columnIds:['a'],defaults:{a:'right'}};
 const cleared=changeRangeFormat(format,selection,'cell',{type:'clear'});assert.deepEqual(sheetPaint(cleared,'r1','a','20'),{fill:null,color:null});assert.equal(sheetPaint(cleared,'r2','a','20').fill,'#faf1d9');assert.equal(sheetAlignment(cleared,'r1','a'),'right');
 const brush=copyCellFormat(format,{rowId:'source',columnId:'a',defaultAlignment:'left'},'20');const painted=changeRangeFormat(cleared,selection,'cell',brush);assert.equal(sheetPaint(painted,'r3','a','0').fill,'#faf1d9');assert.equal(sheetAlignment(painted,'r3','a'),'center');assert.equal(sheetFormatSchema.safeParse(JSON.parse(JSON.stringify(painted))).success,true);
});
test('formatting an empty column applies to later rows without requiring an existing cell',()=>{
 const selection=rangeBetween([],['quantity'],{rowId:'',columnId:'quantity'},{rowId:'',columnId:'quantity'},'column');
 const next=changeRangeFormat({},selection,'column',{type:'paint',property:'fill',value:'#e9effb'});
 assert.equal(sheetPaint(next,'future-row','quantity').fill,'#e9effb');assert.equal(sheetFormatSchema.safeParse(next).success,true);
});
