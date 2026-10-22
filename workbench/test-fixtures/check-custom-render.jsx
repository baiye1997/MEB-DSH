// Run by bundling with esbuild (platform=node, CSS=text), then execute the bundle.
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import CalculationRecords from '../src/calculation-records.jsx';
import CustomCalculator from '../src/custom-calculator.jsx';
import {SnapshotDetail} from '../src/calculation-detail.jsx';
import AssistantReading from '../src/assistant-reading.jsx';
import {customSnapshot} from '../src/custom-calculation.js';
const rule={id:'r',name:'展开量',formula:'长度 * 系数',unit:'m²',precision:4,note:'按约定计算',variables:[{id:'length',name:'长度',unit:'m',fixed:false,value:''},{id:'factor',name:'系数',unit:'m',fixed:true,value:'2'}],rows:[{id:'line',name:'教学楼',values:{length:'10'},note:''}]};
const project={id:'test',name:'隔离测试',customCalculations:[rule]};
const html=renderToStaticMarkup(<CustomCalculator project={project} onChange={()=>{}} onPublish={()=>{}} focus={{kind:'custom',ruleId:'r',rowId:'line'}}/>);
assert.match(html,/20\.0000/);assert.match(html,/系数 = 2 m/);assert.match(html,/自定义第1行长度/);assert.doesNotMatch(html,/自定义第1行系数/);
const snap=customSnapshot(project,rule,rule.rows[0]);rule.variables[1].value='3';const frozen=renderToStaticMarkup(<SnapshotDetail source={snap.source}/>);assert.match(frozen,/20\.0000/);assert.doesNotMatch(frozen,/30\.0000/);
const links=renderToStaticMarkup(<AssistantReading text={'[原文](https://www.shmet.com/)\n[恶意](javascript:alert(1))'}/>);assert.match(links,/href="https:\/\/www.shmet.com\/"/);assert.doesNotMatch(links,/href="javascript:/);
console.log('Custom calculation and historical result rendering passed.');

const locked=renderToStaticMarkup(<CalculationRecords busy book={{columns:[{id:'title',name:'事项',type:'text'},{id:'quantity',name:'数量',type:'number'}],rows:[snap]}} rows={[snap]}/>);
assert.match(locked,/<button[^>]*disabled=""[^>]*>＋ 添加行<\/button>/);
assert.match(locked,/<button[^>]*disabled=""[^>]*>删除 1 行<\/button>/);
assert.match(locked,/<(?:input|div)[^>]*(?:disabled=""|aria-disabled="true")[^>]*aria-label="1行计算明细"/);

// A large table must never instantiate one editor per offscreen record.
import SheetTable,{sheetCellKeyDown} from '../src/sheet-table.jsx';
let editorRows=0;
const large=Array.from({length:20000},(_,i)=>({id:String(i)}));
const lazy=renderToStaticMarkup(<SheetTable dataRows={large} renderDataRow={(row,i)=>{editorRows++;return <tr data-business-row={row.id}><td><input aria-label={'row '+i}/></td></tr>;}}><thead><tr><th>编号</th></tr></thead></SheetTable>);
assert.ok(editorRows>0&&editorRows<100,`Created ${editorRows} editor rows for a virtual table`);
assert.ok((lazy.match(/data-business-row=/g)||[]).length<100);
console.log('Large table creates only visible editors.');

// A selected grid cell must route native paste into its existing editable field.
for(const modifier of ['metaKey','ctrlKey']){
 const calls=[],editor={focus:()=>calls.push('focus'),select:()=>calls.push('select')};
 const target={matches:selector=>selector==='[role=gridcell]',querySelector:()=>editor};
 sheetCellKeyDown(null,{key:'v',[modifier]:true,target,preventGridDefault:()=>calls.push('grid')});
 assert.deepEqual(calls,['grid','focus','select']);
}
for(const key of ['v','ArrowRight']){
 let queried=false;
 sheetCellKeyDown(null,{key,target:{matches:selector=>selector==='[role=gridcell]',querySelector:()=>{queried=true;}},preventGridDefault:()=>assert.fail('Plain keys retain grid navigation')});
 assert.equal(queried,false);
}
sheetCellKeyDown(null,{key:'v',metaKey:true,target:{matches:selector=>selector==='[role=gridcell]',querySelector:()=>null},preventGridDefault:()=>assert.fail('Read-only and utility cells cannot be edited')});
let editing=false;
sheetCellKeyDown(null,{target:{matches:()=>true},preventGridDefault:()=>editing=true});
assert.equal(editing,true);
console.log('Selected-cell paste focuses editable fields for both platform shortcuts; utility cells stay protected.');

// React rewrites child keys; saved formats must still find the original business IDs.
const tbodyFormat={cells:{'saved:row=1':{name:'right'}},rows:{'saved:row=2':'center'}};
const tbodyHtml=renderToStaticMarkup(<SheetTable format={tbodyFormat} onFormatChange={()=>{}}><thead><tr><th data-column-key="name">事项</th></tr></thead><tbody><tr key="react-key-1" data-business-row="saved:row=1"><td><input readOnly value="原始单元格格式"/></td></tr><tr key="react-key-2" data-sheet-row="saved:row=2"><td><input readOnly value="原始整行格式"/></td></tr></tbody></SheetTable>).replace(/<style>[\s\S]*?<\/style>/g,'');
assert.match(tbodyHtml,/data-sheet-row="saved:row=1"/);
assert.match(tbodyHtml,/data-sheet-row="saved:row=2"/);
assert.match(tbodyHtml,/data-format-column="name" data-align="right"/);
assert.match(tbodyHtml,/data-format-column="name" data-align="center"/);
console.log('Legacy tbody rows retain saved cell and row alignment through original business IDs.');

import './check-calculator-render.jsx';

import './check-model-editor-render.jsx';

// Consolidated receipt actions keep file tools and row actions reachable without duplicate add buttons.
import BusinessGrid from '../src/business-grid.jsx';
const receiptBook={columns:[{id:'number',name:'收方单编号',type:'text'}],rows:[],views:[]};
const receiptToolbar=renderToStaticMarkup(<BusinessGrid kind="receipt" book={receiptBook} heading={<span>收方台账</span>} menuItems={<button>导入 Excel</button>}/>);
assert.match(receiptToolbar,/<h1 class="ledger-heading">/);
assert.match(receiptToolbar,/aria-label="更多台账操作"/);
assert.match(receiptToolbar,/导入 Excel/);
assert.match(receiptToolbar,/复制本视图（含表头）/);
assert.equal((receiptToolbar.match(/>添加行<\/button>/g)||[]).length,1);
const otherToolbar=renderToStaticMarkup(<BusinessGrid kind="change" book={receiptBook}/>);
assert.doesNotMatch(otherToolbar,/ledger-heading|更多台账操作/);
assert.match(otherToolbar,/aria-label="行操作"/);
assert.equal((otherToolbar.match(/>添加行<\/button>/g)||[]).length,1);
console.log('Receipt menu consolidation preserves file and row actions; other ledgers retain their toolbar.');
