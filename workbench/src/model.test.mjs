import test from 'node:test';
import assert from 'node:assert/strict';
import {claimDailyIntro} from './daily-intro-state.js';
test('daily intro runs once per local day',()=>{const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};assert.equal(claimDailyIntro(storage,new Date(2040,0,1)),true);assert.equal(claimDailyIntro(storage,new Date(2040,0,1)),false);assert.equal(claimDailyIntro(storage,new Date(2040,0,2)),true);});
import {makeDwgReviewRequest,makeDwgReferenceRequest,extractDwgReviewSuggestion,sharedPlanCandidateNumbers} from './dwg-assistant.js';
import {presentDshResponse,assistantScope,responseForCopy,replyForClipboard,sentMessageScope,mebAssistantSystemPrompt} from './dsh-response.js';
import {splitModelBuilding} from './model-split.js';
import {blankProject,validate,decimal,display,difference,pasteRows,columns,MAX_DOCUMENT_BYTES} from './model.js';
import {initial} from '../test-fixtures/workspace.mjs';
test('quantity decimal precision and missing values',()=>{assert.equal(display(decimal('0.1')+decimal('0.2')),'0.3');assert.equal(display(difference({cells:{reported:'12.3',verified:'12.1'}})),'-0.2');assert.equal(difference({cells:{reported:'1'}}),null);});
test('import and validation preserve original on error',()=>{const d=initial();const rows=pasteRows([['测试','2026-09-21','','','','管道','m','0.1','0.2']],columns);d.projects[0].rows=rows;assert.equal(validate(d).projects[0].rows.length,1);rows[0].cells.reported='错误';assert.throws(()=>validate(d),/请输入数字/);});
test('reject cross project attachment and negative quantities without reason',()=>{const d=initial();d.projects[0].rows=[{id:'test',cells:{reported:'-1'},files:[],notes:''}];assert.throws(()=>validate(d),/填写说明/);d.projects[0].rows[0].cells={};d.projects[0].rows[0].files=['missing'];assert.throws(()=>validate(d),/附件不存在/);});
import {ledgerBook,allRows,normalizeDate} from './model.js';
import {calculate,defaults} from './calculations.js';
test('backward-compatible ledgers isolate columns, records and validate attachments',()=>{const old=initial();const d=validate(old);const p=d.projects[0];ledgerBook(p,'contract').rows.push({id:'contract',cells:{title:'合同',reported:'100'},files:[],notes:''});assert.equal(p.rows.length,0);assert.equal(allRows(p).length,1);assert.equal(validate(d).projects[0].ledgers.contract.rows[0].cells.reported,'100');ledgerBook(p,'contract').rows[0].files=['missing'];assert.throws(()=>validate(d),/附件不存在/);});
test('date import supports common Chinese Excel text and rejects invalid calendar dates',()=>{assert.equal(normalizeDate('2026/9/1'),'2026-09-01');assert.equal(normalizeDate('2026年9月1日'),'2026-09-01');const d=initial();d.projects[0].rows=pasteRows([['a','2026-02-30']],columns);assert.throws(()=>validate(d),/日期/);});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('calculations reconcile with original workbook cached cells',()=>{near(calculate('cable',defaults('cable')).value,23792.90728944);near(calculate('bus',defaults('bus'),'section').value,13402.4463027);near(calculate('bus',{...defaults('bus'),current:'105740'},'direct').value,13575.780946);near(calculate('support',defaults('support'),'frame').value,754.047919);near(calculate('support',{...defaults('support'),width:'100',height:'100',length:'206.13',rods:'1',steelWeight:'1.373'},'single').value,128.1468984);});
test('adjustment thresholds, decreases and invalid inputs',()=>{const v={...defaults('cable'),base:'100',threshold:'3'};for(const current of ['97','100','103'])near(calculate('cable',{...v,current}).value,0);near(calculate('cable',{...v,current:'90'}).value,-.6793548*7);assert.throws(()=>calculate('cable',{...v,n1:'1.5'}),/整数/);assert.throws(()=>calculate('cable',{...v,length:''}),/长度/);assert.throws(()=>calculate('support',{...defaults('support'),spacing:'0'}),/大于/);});
test('overflow results cannot enter a ledger',()=>{assert.throws(()=>calculate('support',{...defaults('support'),length:'1e308',beam:'1e308'}),/超出范围/);assert.throws(()=>calculate('cable',{...defaults('cable'),length:'1e308'}),/超出范围/);});
import {pasteCalculationRows,emptySheet,newCalculationRow,resolveCalculation,snapshotRecord} from './calculation-sheet.js';
test('project calculation sheet parses specs, snapshots and keeps original inputs',()=>{
 const d=initial(),p=d.projects[0],s=emptySheet('cable');s.params.base='68740';s.params.current='105825';const r={...newCalculationRow(),specification:'YJV-3×400',length:'63.61'};s.rows.push(r);p.calculationSheets={cable:s};
 near(resolveCalculation('cable',s,r).result.value,23792.90728944);
 const record=snapshotRecord(p,'cable',s,r);ledgerBook(p,'calculation').rows.push(record);assert.equal(record.cells.reported,'23792.91');assert.equal(validate(d).projects[0].calculationSheets.cable.rows.length,1);
 s.params.current='90000';assert.equal(record.source.inputs.current,'105825');assert.notEqual(resolveCalculation('cable',s,r).signature,record.source.signature);
 assert.throws(()=>resolveCalculation('cable',s,{...r,specification:'1x10+1x20+1x30+1x40'}),/完整解析/);
 record.source.projectId='other';assert.throws(()=>validate(d),/不属于当前项目/);
});
test('sheet preset geometry and manual overrides are calculated per row',()=>{const s=emptySheet('support'),r={...newCalculationRow(),specification:'150×100',length:'795.64'};near(resolveCalculation('support',s,r).result.value,754.047919);r.overrides.steelWeight='3';assert.notEqual(resolveCalculation('support',s,r).result.value,754.047919);const bus=emptySheet('bus');bus.params.base='68740';bus.params.current='105825';near(resolveCalculation('bus',bus,{...newCalculationRow(),specification:'50×3×1+50×1.5×1',length:'63.7'}).result.value,13402.4463027);});
import {parseCableSpecification} from './calculation-sheet.js';
test('full cable names recognize conductor groups without needing calculation parameters',()=>{
 for(const raw of ['WDZ-BYJ-3*2.5','WDZ-BYJ-３＊２.５','WDZ-BYJ-3×2.5 mm²','WDZ-BYJ-3x2.5-0.45/0.75kV'])assert.deepEqual(parseCableSpecification(raw),{groups:[{count:3,area:2.5}],cores:3,area:7.5});
 const raw='电力电缆 WDZB1N-YJY-0.6/1kV-3×120+2×70 mm²';assert.equal(parseCableSpecification(raw).area,500);assert.equal(parseCableSpecification(raw).cores,5);
 for(const raw of ['YJV-0.6/1kV','BV-2.5','3x0','0x2.5','1.5x2.5','3x120+2x70+','3x120+2x70 另加1x16','1x10+1x20+1x30+1x40'])assert.throws(()=>parseCableSpecification(raw),raw);
 const sheet=emptySheet('cable');sheet.params.base='68740';sheet.params.current='105825';const row={...newCalculationRow(),specification:'WDZ-BYJ-3*2.5',length:'100'};const record=snapshotRecord({id:'p',name:'项目'},'cable',sheet,row);assert.equal(record.source.specification,row.specification);assert.equal(record.source.inputs.n1,'3');assert.equal(record.source.inputs.a1,'2.5');
});
import {calculationInputs,participatingFields,calculationEquations,parameterSource} from './calculation-sheet.js';
test('detail fields follow selected mode and display the actual source value',()=>{
 const s=emptySheet('bus'),r={...newCalculationRow(),specification:'50×3×1+50×1.5×1',length:'63.7'};s.params.base='68740';s.params.current='105825';
 let e=calculationInputs('bus',s,r);assert.equal(e.inputs.width,'50');assert.equal(parameterSource('bus',s,r,'base'),'本表共用参数');assert.ok(!participatingFields('bus',e.mode).some(f=>f[0]==='unitWeight'));
 r.overrides={mode:'direct',unitWeight:'6.1'};e=calculationInputs('bus',s,r);assert.ok(!participatingFields('bus',e.mode).some(f=>f[0]==='width'));assert.ok(participatingFields('bus',e.mode).some(f=>f[0]==='unitWeight'));assert.equal(parameterSource('bus',s,r,'unitWeight'),'本行填写');
 const lines=calculationEquations('bus',e.inputs,e.mode);near(lines.at(-1)[2],resolveCalculation('bus',s,r).result.value);assert.equal(lines[0][1],'采用本行填写的确认铜重');
 const support=emptySheet('support'),row={...newCalculationRow(),specification:'150×100',length:'795.64'};let a=calculationInputs('support',support,row);assert.equal(a.inputs.rods,'2');row.overrides.mode='single';a=calculationInputs('support',support,row);assert.equal(a.inputs.rods,'1');near(calculationEquations('support',a.inputs,a.mode).at(-1)[2],resolveCalculation('support',support,row).result.value);
 row.overrides.rods='3';assert.equal(calculationInputs('support',support,row).inputs.rods,'3');
 const incomplete=calculationInputs('cable',emptySheet('cable'),newCalculationRow());assert.ok(incomplete.parseError);assert.equal(incomplete.inputs.base,'');
});
import {migrateBusiness,businessColumns,outputAmounts,projectAmounts,discountAmount,parseTSV,toTSV,pasteCells,cellValue,setLedgerCell} from './business.js';
test('business migration preserves original rows, notes, custom columns and attachment links',()=>{const p={id:'old',name:'旧项目',columns:[...columns,{id:'custom',name:'自定义',type:'text',width:150}],rows:[{id:'r',cells:{title:'旧事项',building:'A',floor:'2F',reported:'12',custom:'原值'},files:['f'],notes:'旧备注'}],views:[],ledgers:{}};const d={projects:[p]};migrateBusiness(d);assert.equal(p.rows[0].cells.location,'A / 2F');assert.equal(p.rows[0].cells.title,'旧事项');assert.equal(p.rows[0].cells.remarks,'旧备注');assert.equal(p.rows[0].files[0],'f');assert.equal(p.columns.find(c=>c.id==='custom').hidden,false);assert.equal(p.columns.filter(c=>c.type==='approval').length,4);assert.equal(p.ledgers.output.rows.length,0);const once=JSON.stringify(d);migrateBusiness(d);assert.equal(JSON.stringify(d),once);});
test('payment and cascading discount amounts are explicit and decimal accurate',()=>{assert.deepEqual(outputAmounts({verified:'10000',paymentRate:'80',received:'3000'}),{payable:'8000.00',outstanding:'5000.00'});assert.equal(outputAmounts({verified:'',paymentRate:'80'}).payable,'');assert.equal(outputAmounts({verified:'10',paymentRate:'101'}).payable,'');assert.equal(discountAmount('10000','3.33'),'9667.00');const p={finance:{cleared:'1000000',ownerDiscount:'10',ourDiscount:'5'},ledgers:{change:{rows:[{cells:{reported:'10000'}}]}}};let a=projectAmounts(p);assert.equal(a.gc,'900000.00');assert.equal(a.our,'855000.00');p.finance.includeChanges='yes';assert.equal(projectAmounts(p).our,'863550.00');});
test('Excel rectangular paste follows visible row order, preserves rest, expands rows and roundtrips quoted cells',()=>{const matrix=[['SF-1','二层','电气','电缆\n含端头','001','电力电缆','1,200.5','m','签字+盖章','签字','','盖章','含"引号"备注'],['SF-2','三层','电气','桥架','','桥架','10','m','','','','','']];assert.deepEqual(parseTSV(toTSV(matrix)),matrix);const b={columns:businessColumns('receipt'),rows:[{id:'r',cells:{custom:'保留'},files:['f'],notes:''}]};pasteCells(b,b.rows,b.columns.filter(c=>!c.hidden),'r','number',matrix,'receipt');assert.equal(b.rows.length,2);assert.equal(b.rows[0].cells.reported,'1200.5');assert.equal(b.rows[0].cells.approval0,'签字+盖章');assert.equal(b.rows[0].notes,'含"引号"备注');assert.equal(b.rows[0].cells.custom,'保留');assert.deepEqual(b.rows[0].files,['f']);assert.throws(()=>pasteCells(b,b.rows,b.columns.filter(c=>!c.hidden),'r','remarks',[['a','b']],'receipt'),/超出/);});
test('editing or pasting remarks preserves independent import provenance',()=>{const row={id:'source',cells:{remarks:'待核对'},files:[],notes:'来源：原表清单合价仅供追溯'};setLedgerCell(row,'remarks','已复核期次');assert.equal(row.cells.remarks,'已复核期次');assert.equal(row.notes,'来源：原表清单合价仅供追溯');const book={columns:businessColumns('output'),rows:[row]};pasteCells(book,book.rows,book.columns,'source','remarks',[['补充合同说明']],'output');assert.equal(row.cells.remarks,'补充合同说明');assert.equal(row.notes,'来源：原表清单合价仅供追溯');const plain={id:'plain',cells:{remarks:'旧备注'},files:[],notes:'旧备注'};setLedgerCell(plain,'remarks','新备注');assert.equal(plain.notes,'新备注');});
import {quickResult} from './quick-tools.js';
test('simple quantity tools use explicit dimensions and reject missing inputs',()=>{assert.equal(quickResult('price',{quantity:'3',price:'12.5'}),'37.50');assert.equal(quickResult('price',{quantity:'1',price:'1.005'}),'1.01');assert.equal(quickResult('duct',{width:'500',height:'300',length:'10'}),'16.0000');assert.equal(quickResult('insulation',{diameter:'100',thickness:'50',length:'10'}),'0.2356');assert.throws(()=>quickResult('duct',{width:'500'}),/请填写/);});
test('business state serializes approvals, finance, price library and quick-tool provenance',()=>{const d=validate(initial()),p=d.projects[0];p.rows.push({id:'receipt',cells:{number:'SF-1',approval0:'签字+盖章',remarks:'原单备注'},files:[],notes:'原单备注'});p.finance={base:'contract',ownerDiscount:'10',ourDiscount:'5'};ledgerBook(p,'contract').rows.push({id:'c',cells:{category:'项下合同（与总包）',reported:'1000000'},files:[],notes:''});d.materials.rows.push({id:'m',cells:{title:'电缆',price:'125.5',date:'2026-09-22'},files:[],notes:''});p.quickTools=[{id:'q',cells:{kind:'price',quantity:'10',price:'125.5',materialId:'m',materialSnapshot:'{"price":"125.5"}'},files:[],notes:''}];const read=validate(JSON.parse(JSON.stringify(d)));assert.equal(read.projects[0].rows[0].cells.approval0,'签字+盖章');assert.equal(read.materials.rows[0].cells.price,'125.5');assert.equal(projectAmounts(read.projects[0]).our,'');read.projects[0].finance.contract='1000000';assert.equal(projectAmounts(read.projects[0]).our,'855000.00');assert.equal(read.projects[0].quickTools[0].cells.materialId,'m');read.projects[0].finance.ownerDiscount='101';assert.throws(()=>validate(read),/下浮率/);});

test('cross-project calculation snapshots retain source identity and separate quantity from amount',()=>{
 const d=initial(),target=blankProject('destination','目标项目');d.projects.push(target);
 const sheet=emptySheet('cable');sheet.params.base='68740';sheet.params.current='105825';
 const r={id:'source-row',name:'电缆',specification:'YJV-3×400',length:'63.61',overrides:{}};
 const record=snapshotRecord(d.projects[0],'cable',sheet,r,target);
 ledgerBook(target,'calculation').rows.push(record);
 const saved=validate(JSON.parse(JSON.stringify(d))).projects[1].ledgers.calculation.rows[0];
 assert.equal(saved.source.projectId,'sample');assert.equal(saved.source.targetProjectId,'destination');
 assert.equal(saved.cells.quantity,'63.61');assert.equal(saved.cells.unit,'m');assert.equal(saved.cells.amount,'23792.91');
 saved.source.targetProjectId='sample';assert.throws(()=>validate({...d,projects:[d.projects[0],{...target,ledgers:{calculation:{...target.ledgers.calculation,rows:[saved]}}}]}),/目标项目无效/);
});

test('legacy calculation migration is idempotent and preserves raw values and custom fields',()=>{
 const d=initial();d.projects[0].ledgers={calculation:{columns:[{id:'title',name:'计算名称',type:'text',width:200,hidden:false,options:[]},{id:'reported',name:'结果',type:'number',width:120,hidden:false,options:[]}],rows:[{id:'legacy',cells:{title:'旧计算',unit:'元',reported:'23735.16213144'},files:[],notes:'原式'}],views:[]}};
 const a=validate(d),b=validate(a),book=b.projects[0].ledgers.calculation;
 assert.deepEqual(a,b);assert.deepEqual(book.columns.filter(c=>!c.hidden).map(c=>c.name),['添加日期','计算明细','计算项目','规格参数','单位','数量','金额','备注']);assert.equal(book.rows[0].cells.reported,'23735.16213144');assert.equal(book.rows[0].cells.quantity,'');assert.equal(book.rows[0].notes,'原式');
});

 test('project cost dossier stays with its project and does not substitute subcontract totals',()=>{const d=initial();d.projects.push(blankProject('second','另一个项目'));d.projects[0].finance={contract:'2000000',cleared:'1800000',audit1:'1750000',ownerDiscount:'10',ourDiscount:'5',base:'contract'};const saved=validate(JSON.parse(JSON.stringify(d)));assert.equal(projectAmounts(saved.projects[0]).our,'1710000.00');assert.equal(projectAmounts(saved.projects[1]).our,'');assert.equal(saved.projects[1].finance.contract,undefined);assert.equal(saved.projects[0].finance.audit1,'1750000');});

import {auditAvailable,locateReceipt,ledgerTotals} from './project-overview.js';
import {inspectReference,listReferenceDirectory} from './file-reference.js';
import {mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('project stages keep future audit amounts optional and preserve existing amounts',()=>{
 assert.equal(auditAvailable({stage:'施工'},'audit1'),false);
 assert.equal(auditAvailable({stage:'一审'},'audit1'),true);
 assert.equal(auditAvailable({stage:'一审'},'audit2'),false);
 assert.equal(auditAvailable({stage:'施工',audit2:'0'},'audit2'),true);
 const d=initial();d.projects[0].finance={stage:'施工'};assert.equal(validate(d).projects[0].finance.stage,'施工');
});
test('receipt location requires an explicit unique building and recognizes floor',()=>{
 const at=location=>locateReceipt({cells:{location}});
 assert.deepEqual(at('原有教学楼 / 2F'),{building:'E',floor:2});
 assert.deepEqual(at('二期新建 A / 三层'),{building:'A',floor:3});
 assert.deepEqual(at('一期和B栋'),{building:null,floor:null});
 assert.deepEqual(at('给排水'),{building:null,floor:null});
});
test('ledger money totals separate contracts and cumulative snapshots',()=>{
 const rows=[{id:'1',cells:{category:'报业主产值',party:'甲',contractRef:'HT1',basis:'当期',reported:'100',verified:'80',paymentRate:'50'}},{id:'2',cells:{category:'报业主产值',party:'甲',contractRef:'HT1',basis:'当期',reported:'200',verified:'100',paymentRate:'50'}},{id:'3',cells:{category:'报业主产值',party:'甲',contractRef:'HT1',basis:'累计',reported:'300'}}];
 const total=ledgerTotals(rows,businessColumns('output'),'output');assert.equal(total.length,2);assert.equal(total[0].values.reported,'300.00');assert.equal(total[0].values.payable,'90.00');assert.equal(total[1].values.reported,'300.00');
 assert.deepEqual(ledgerTotals(rows.slice(0,1).map(r=>({...r,cells:{...r.cells,party:''}})),businessColumns('output'),'output'),[]);
 assert.deepEqual(ledgerTotals([{id:'blank',cells:{basis:'当期'}}],businessColumns('output'),'output'),[]);
 assert.deepEqual(ledgerTotals(rows,businessColumns('receipt'),'receipt'),[]);
});
test('file references retain only path metadata and preserve old embedded copies',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'meb-reference-'));try{const path=join(dir,'原件.txt');await writeFile(path,'local source');const listing=await listReferenceDirectory(dir);assert.equal(listing.entries[0].name,'原件.txt');assert.equal(listing.entries[0].directory,false);await assert.rejects(listReferenceDirectory('relative'));const f=await inspectReference(path);assert.equal(f.data,'');assert.equal(f.size,12);const d=initial();d.files.push({...f,id:'ref',projectId:'sample',createdAt:new Date().toISOString()});assert.equal(validate(d).files[0].path,await realpath(path));const remote=structuredClone(d);delete remote.files[0].path;assert.equal(validate(remote).files[0].path,undefined);d.files.push({id:'copy',projectId:'sample',name:'copy.txt',mime:'text/plain',size:1,data:'data:text/plain;base64,eA==',createdAt:new Date().toISOString()});assert.equal(validate(d).files[1].kind,'copy');await assert.rejects(inspectReference(join(dir,'missing.txt')));d.files[0].data='data:text/plain;base64,eA==';assert.throws(()=>validate(d),/引用附件/);}finally{await rm(dir,{recursive:true,force:true});}
});

import {receiptQuantityGroups} from './business.js';
test('receipt quantities group exact content and unit without mixing incomplete records',()=>{
 const row=(id,description,unit,reported)=>({id,cells:{description,unit,reported}});
 const groups=receiptQuantityGroups([row('1',' 管道 ','m','0.1'),row('2','管道','m','0.2'),row('3','管道','个','2'),row('4','管道','m',''),row('5','管道','','8'),row('6','','m','9'),row('7','','',''),row('8','电缆','m','0')]);
 assert.equal(groups.length,5);assert.equal(groups[0].total,'0.3');assert.equal(groups[0].missing,1);assert.equal(groups[0].rows.length,3);assert.equal(groups[1].total,'2');assert.equal(groups[2].total,'');assert.equal(groups[3].total,'');assert.equal(groups[4].total,'0');
});

import {filterReceiptRows} from './business.js';
test('receipt location and discipline filters recalculate summaries and location groups',()=>{
 const rows=[{id:'1',cells:{location:' A / 1F ',discipline:'给排水',description:'管道',unit:'m',reported:'1.2'}},{id:'2',cells:{location:'B / 2F',discipline:'给排水',description:'管道',unit:'m',reported:'2.3'}},{id:'3',cells:{location:'A / 1F',discipline:'电气',description:'管道',unit:'m',reported:'3.4'}}];
 const selected=filterReceiptRows(rows,{location:'A / 1F',discipline:'给排水',description:null});assert.deepEqual(selected.map(r=>r.id),['1']);assert.equal(receiptQuantityGroups(selected)[0].total,'1.2');
 assert.equal(receiptQuantityGroups(rows)[0].total,'6.9');const byPlace=receiptQuantityGroups(rows,'location');assert.equal(byPlace.length,2);assert.equal(byPlace[0].location,'A / 1F');assert.equal(byPlace[0].total,'4.6');assert.equal(byPlace[1].total,'2.3');assert.equal(filterReceiptRows(rows,{location:''}).length,0);
});

import {sendReviewPage,projectContext,projectRouteContext,queryProject,queryCalculation,sessionMessages,submitPrompt,uploadReviewFile,workbenchPrompt} from './dsh-bridge.js';
test('DSH context isolates project data, excludes attachments, bounds long snapshots',()=>{
 const p=blankProject('context-test','上下文验收');p.files=[{path:'/private/not-to-send',base64:'PRIVATE_FILE'}];
 p.modelConfig={mode:'imported',buildings:[{id:'a',number:'A',name:'教学楼',lot:'二标段',heights:[4.2,3.6],dwgSource:{name:'建筑总图.dwg',sha256:'a'.repeat(64),units:'mm'},cadLayer:'A-WALL',cadEntityIndex:106}]};
 p.rows=Array.from({length:80},(_,i)=>({id:String(i),cells:Object.fromEntries(p.columns.map(c=>[c.id,'长'.repeat(600)])),notes:'n',files:[]}));
 const text=projectContext(p,'table','receipt'),value=JSON.parse(text);
 assert.equal(value.project.id,p.id);assert.ok(value.rows.length<=50);assert.ok(text.length<=18000);assert.ok(!text.includes('PRIVATE_FILE'));assert.ok(!text.includes('/private/not-to-send'));assert.equal(value.totalRows,80);
 assert.deepEqual(value.model.buildings[0],{id:'a',number:'A',name:'教学楼',lot:'二标段',floors:2,totalHeight:7.8,sourceDrawing:'建筑总图.dwg',sourceLayer:'A-WALL',sourceEntity:106});assert.ok(!text.includes('a'.repeat(64)));
 const focused=JSON.parse(projectContext(p,'table','receipt',{selectedRowId:'79'}));assert.ok(JSON.stringify(focused).length<=18000);assert.equal(focused.focusedRow.id,'79');assert.equal(focused.truncated,true);assert.ok(focused.clippedFields>0);
});
test('DSH sees the current ledger view and focused row, but no unseen-row claim',()=>{
 const p=blankProject('dsh-view','当前项目');p.rows=Array.from({length:70},(_,i)=>({id:String(i),cells:{description:`记录 ${i}`},notes:'',files:[]}));
 const context=JSON.parse(projectContext(p,'table','receipt',{viewRows:p.rows.slice(60),selectedRowId:'68',unsaved:true}));
 assert.equal(context.totalRows,70);assert.equal(context.visibleRows,10);assert.deepEqual(context.rows.map(r=>r.id),p.rows.slice(60).map(r=>r.id));assert.equal(context.focusedRow.id,'68');assert.equal(context.truncated,false);
 assert.equal(context.dataState,'当前未保存编辑');
 const full=JSON.parse(projectContext(p,'table','receipt'));assert.equal(full.truncated,true);assert.ok(full.rows.length<=50);assert.ok(full.rows.length>0);
 const route=projectRouteContext(JSON.stringify(context));assert.equal(JSON.parse(route).focusedRowId,'68');assert.equal(JSON.parse(route).dataState,'当前未保存编辑');assert.ok(!route.includes('记录 68'));
 const prompt=workbenchPrompt('检查当前行',JSON.stringify(context));assert.match(prompt,/<project-data>/);assert.match(prompt,/当前只发送项目定位/);assert.doesNotMatch(prompt,/面向工程造价人员|meb_project_query|meb_calculation_query/);assert.match(prompt,/检查当前行$/);assert.ok(!prompt.includes('记录 68'));
 const snapshotPrompt=workbenchPrompt('检查当前行',JSON.stringify(context),true,true);assert.match(snapshotPrompt,/记录 68/);assert.match(snapshotPrompt,/truncated/);
 const methodPrompt=workbenchPrompt('  只问方法  ',JSON.stringify(context),false);assert.match(methodPrompt,/只问方法$/);assert.ok(!methodPrompt.includes('<project-data>'));assert.ok(!methodPrompt.includes('记录 68'));
 assert.match(sentMessageScope(snapshotPrompt),/已发送 10 条当前记录 · 含未保存内容/);
 assert.match(sentMessageScope(prompt),/项目定位已发送/);
 assert.match(sentMessageScope(methodPrompt),/未发送项目资料/);
 assert.equal(responseForCopy('结论：待核。\n```meb-change\n{"ops":[]}\n```'),'结论：待核。');
 assert.equal(replyForClipboard('## 结论\n**待核**\n\n| 单据 | 数量 |\n| --- | --- |\n| SF-002 | 12.5 m |\n\n```meb-change\n{"ops":[]}\n```'),'结论\n待核\n\n单据\t数量\nSF-002\t12.5 m');
});
test('MEB assistant rules live in one stable system prompt, not every user message',()=>{
 assert.match(mebAssistantSystemPrompt,/结论—依据—待核—下一步/);
 assert.match(mebAssistantSystemPrompt,/只读当前绑定项目/);
 assert.match(mebAssistantSystemPrompt,/meb-change/);
 assert.match(mebAssistantSystemPrompt,/全部值使用字符串/);
 assert.match(mebAssistantSystemPrompt,/字段和依据足够时，正文后必须附一份 meb-change/);
 const shortPrompt=workbenchPrompt('查缺项',JSON.stringify({project:{id:'p',name:'项目'},dataState:'已保存数据',page:'table',ledger:'receipt',totalRows:0,visibleRows:0,focusedRow:null}));
 assert.doesNotMatch(shortPrompt,/面向工程造价人员|meb_project_query|meb_calculation_query|没有实际执行/);
});
test('DSH read tool pages saved ledger data without attachment bytes or paths',()=>{
 const p=blankProject('dsh-query','查询项目');p.rows=Array.from({length:5},(_,i)=>({id:String(i),cells:{description:`管道 ${i}`},notes:'',files:['private-file']}));
 const data={projects:[p],files:[{id:'private-file',path:'/private/drawing.dwg',data:'PRIVATE_BYTES'}]};
 assert.equal(JSON.parse(queryProject(data)).projects[0].id,p.id);
 const first=JSON.parse(queryProject(data,{projectId:p.id,ledger:'receipt',limit:2}));assert.deepEqual(first.rows.map(r=>r.id),['0','1']);assert.equal(first.nextOffset,2);assert.equal(first.totalRows,5);assert.equal(first.omittedBefore,0);assert.equal(first.omittedAfter,3);assert.equal(first.clippedFields,0);
 const second=JSON.parse(queryProject(data,{projectId:p.id,ledger:'receipt',offset:first.nextOffset,limit:2}));assert.deepEqual(second.rows.map(r=>r.id),['2','3']);assert.equal(second.nextOffset,4);assert.equal(second.omittedBefore,2);assert.equal(second.omittedAfter,1);
 const last=JSON.parse(queryProject(data,{projectId:p.id,ledger:'receipt',offset:4,limit:2}));assert.deepEqual(last.rows.map(r=>r.id),['4']);assert.equal(last.nextOffset,null);assert.equal(last.omittedBefore,4);assert.equal(last.omittedAfter,0);assert.equal(last.clippedFields,0);assert.equal(last.truncated,true);
 const focused=queryProject(data,{projectId:p.id,ledger:'receipt',rowId:'4'});assert.equal(JSON.parse(focused).focusedRow.id,'4');assert.ok(!focused.includes('/private/drawing.dwg'));assert.ok(!focused.includes('PRIVATE_BYTES'));
 const filtered=JSON.parse(queryProject(data,{projectId:p.id,ledger:'receipt',query:'管道 4'}));assert.deepEqual(filtered.rows.map(r=>r.id),['4']);assert.equal(filtered.filterQuery,'管道 4');assert.equal(filtered.dataState,'已保存数据');
 const summary=JSON.parse(queryProject(data,{projectId:p.id,ledger:'receipt',query:'管道',summaryOnly:true}));assert.deepEqual(summary,{project:{id:p.id,name:p.name},dataState:'已保存数据',ledger:'receipt',query:'管道',totalRows:5,matchedRows:5,scope:'仅汇总，不含记录明细'});
 assert.ok(!JSON.stringify(summary).includes('rows'));assert.ok(JSON.stringify(summary).length<180);
 assert.throws(()=>queryProject(data,{projectId:p.id,ledger:'receipt',limit:51}),/查询范围无效/);
 assert.throws(()=>queryProject(data,{projectId:p.id,ledger:'receipt',offset:-1}),/查询范围无效/);
});
test('DSH material price query respects its filter and row offset',()=>{
 const p=blankProject('dsh-materials','材料查询项目');
 const data={projects:[p],materials:{columns:[{id:'name',name:'名称',type:'text'}],rows:[{id:'m1',cells:{name:'电缆'},notes:'',files:[]},{id:'m2',cells:{name:'桥架'},notes:'',files:[]},{id:'m3',cells:{name:'电缆终端'},notes:'',files:[]}]}};
 const first=JSON.parse(queryProject(data,{projectId:p.id,ledger:'materials',query:'电缆',limit:1}));
 assert.equal(first.totalRows,3);assert.equal(first.visibleRows,2);assert.deepEqual(first.rows.map(r=>r.id),['m1']);assert.equal(first.nextOffset,1);
 const second=JSON.parse(queryProject(data,{projectId:p.id,ledger:'materials',query:'电缆',offset:1,limit:1}));
 assert.deepEqual(second.rows.map(r=>r.id),['m3']);assert.equal(second.nextOffset,null);
});
test('DSH reads saved calculation steps and frozen history without changing either',()=>{
 const p=blankProject('dsh-calculation','计算依据项目'),sheet=emptySheet('cable');
 sheet.params.base='68740';sheet.params.current='105825';
 const row={id:'calc-row',name:'电缆调差',specification:'YJV-3×400',length:'63.61',overrides:{}};
 sheet.rows.push(row);p.calculationSheets={cable:sheet};
 const booked=snapshotRecord(p,'cable',sheet,row);ledgerBook(p,'calculation').rows.push(booked);
 const data={projects:[p],files:[]};
 const list=JSON.parse(queryCalculation(data,{projectId:p.id}));assert.equal(list.tools.find(t=>t.kind==='cable').rows,1);
 const detail=JSON.parse(queryCalculation(data,{projectId:p.id,kind:'cable',rowId:row.id}));
 assert.equal(detail.rows[0].result,'23792.91');assert.equal(detail.rows[0].mode,'按规格拆分芯线');assert.equal(detail.rows[0].hasOverrides,false);assert.ok(detail.formulaSource);assert.ok(detail.rows[0].steps.some(s=>s[0]==='调差金额'));assert.match(detail.scope,/正常展示舍入/);assert.equal(detail.dataState,'已保存数据');
 const history=JSON.parse(queryProject(data,{projectId:p.id,ledger:'calculation',rowId:booked.id}));
 assert.equal(history.focusedRow.calculationSource.inputs.current,'105825');
 sheet.params.current='90000';
 assert.equal(JSON.parse(queryProject(data,{projectId:p.id,ledger:'calculation',rowId:booked.id})).focusedRow.calculationSource.inputs.current,'105825');
 assert.notEqual(JSON.parse(queryCalculation(data,{projectId:p.id,kind:'cable',rowId:row.id})).rows[0].result,detail.rows[0].result);
 assert.throws(()=>queryCalculation(data,{projectId:p.id,kind:'cable',rowId:'missing'}),/计算行不存在/);
});
test('DSH transcript extracts only user and assistant text and streams live deltas',()=>{
 const entries=[{event:{seq:1,type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'hello'}]}}},{event:{seq:2,type:'assistant/message',data:{message:{content:[{type:'text',text:'reply'}]}}}},{event:{type:'assistant/live-chunk',data:{attemptId:'a',chunk:{type:'text-delta',text:'live'}}}}];
 assert.deepEqual(sessionMessages(entries).map(x=>x.text),['hello','reply','live']);
});
test('DSH submission correlates its echo and preserves failure for retry',async()=>{
 let abandoned=false,called;
 const session={beginSubmission:()=>({requestId:'r',abandon:()=>{abandoned=true;}}),prompt:async(...args)=>{called=args;return{ok:false,error:{message:'offline'}};}};
 await assert.rejects(()=>submitPrompt(session,'test'),/offline/);assert.equal(called[3],'r');assert.equal(abandoned,true);
});
test('DSH file receipt travels with the same prompt and failed source review cannot be adopted',async()=>{
 let sent;
 const session={beginSubmission:()=>({requestId:'upload-1',abandon:()=>{}}),prompt:async(...args)=>{sent=args;return{ok:true};}};
 await submitPrompt(session,'核对这张图',[{type:'file',receiptId:'receipt-1'}]);
 assert.deepEqual(sent[0],[{type:'text',text:'核对这张图'},{type:'file',receiptId:'receipt-1'}]);
 assert.equal(sent[3],'upload-1');
 const drawing={source:{name:'原图.dwg',sha256:'f'.repeat(64)},units:'mm',origin:[220000,225000],originalFile:{name:'原图.dwg'},candidates:[{index:1,layer:'A-WALL',sheetHint:'7 - 一层平面图',localAnnotations:[{text:'教学楼',layer:'A-ANNO',distance:2}],points:[[0,0],[10,0],[10,8],[0,8]],width:10,depth:8,area:80,gap:0,closed:true}]};
 const request=makeDwgReviewRequest(drawing,[{i:0,c:drawing.candidates[0]}]);
 assert.equal(request.requiresSourceFile,true);
 assert.match(request.text,/"relativeBoundsOriginMeters":\[220000,225000\]/);
 assert.match(request.text,/"absoluteBoundsMeters":\[220000,225000,220010,225008\]/);
 assert.match(request.text,/块插入点或整块中心不能直接与候选中心比较/);
 const related={drawingUse:'plan',source:{name:'教学楼平面图.dwg',sha256:'b'.repeat(64)},units:'mm',unitsConfirmed:true,origin:[220000,225000],candidates:[{layer:'A-WALL',points:[[0,0],[10,0],[10,8],[0,8]],area:80,localAnnotations:[{text:'教学楼'}]}]};
 const sibling={drawingUse:'plan',origin:[219990,224990],candidates:[{points:[[10,10],[20,10],[20,18],[10,18]],area:80}]};
 assert.deepEqual(sharedPlanCandidateNumbers(related,[related,sibling]),[]);
 assert.deepEqual(sharedPlanCandidateNumbers(related,[related,{...sibling,candidates:[{...sibling.candidates[0],area:81}]}]),[]);
 const repeated={...related,candidates:[...related.candidates,...related.candidates.map((c,i)=>({...c,points:c.points.map(([x,y])=>[x+20*(i+1),y])})),{...related.candidates[0],points:related.candidates[0].points.map(([x,y])=>[x+40,y])}]};
 const repeatedPeer={...sibling,candidates:repeated.candidates.map(c=>({...c,points:c.points.map(([x,y])=>[x+10,y+10])})),origin:[219990,224990]};
 assert.deepEqual(sharedPlanCandidateNumbers(repeated,[repeated,repeatedPeer]),[1,2,3]);
 const cross=makeDwgReviewRequest(drawing,[{i:0,c:drawing.candidates[0]}],{relatedDrawings:[related],relatedVisualPages:1});
 assert.match(cross.text,/"drawing":"教学楼平面图.dwg"/);
 const elevation={...related,drawingUse:'reference',source:{name:'立面图.dwg',sha256:'c'.repeat(64)}};
 const focused=makeDwgReviewRequest(drawing,[{i:0,c:drawing.candidates[0]}],{relatedDrawings:[related,elevation]});
 assert.doesNotMatch(focused.text,/立面图[.]dwg/);
 assert.match(cross.text,/"absoluteBoundsMeters":\[220000,225000,220010,225008\]/);
 assert.match(cross.text,/共享底图里的同形轮廓不能算独立证据/);
 assert.match(cross.text,/关联平面图的编号 PNG/);
 assert.match(cross.text,/编号只在各自 DWG 内有效/);
 const crossAnswer={sourceSha256:drawing.source.sha256,sourceInspected:true,sourceEvidence:'已读当前原图及关联教学平面',candidateNumbers:[1],drawingMatches:[{candidateNumber:1,relatedSourceSha256:related.source.sha256,relatedCandidateNumber:1,buildingName:'教学楼',evidence:'总平位置与首层平面轴网和入口方向一致'}]};
 const crossBlock=data=>"```meb-model-review\n"+JSON.stringify(data)+"\n```";
 assert.equal(extractDwgReviewSuggestion(crossBlock(crossAnswer),cross).drawingMatches[0].relatedDrawing,'教学楼平面图.dwg');
 assert.throws(()=>extractDwgReviewSuggestion(crossBlock({...crossAnswer,drawingMatches:[{...crossAnswer.drawingMatches[0],relatedCandidateNumber:99}]}),cross),/跨图对应/);
 const answer=data=>`\`\`\`meb-model-review\n${JSON.stringify(data)}\n\`\`\``;
 assert.throws(()=>extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,sourceInspected:false,candidateNumbers:[1]}),request),/缺少可核对/);
 assert.equal(extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,sourceInspected:false,candidateNumbers:[],reason:'图面未可靠解码'}),request).unverified,true);
 const parsed=extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,sourceInspected:false,evidenceBasis:'parsed',sourceEvidence:'候选 #1 的 7 - 一层平面图、教学楼，仍需人工核对',candidateNumbers:[1]}),request);
 assert.equal(parsed.unverified,true);assert.equal(parsed.evidenceBasis,'parsed');assert.deepEqual(parsed.candidateNumbers,[1]);
 assert.throws(()=>extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,sourceInspected:false,evidenceBasis:'parsed',sourceEvidence:'只有 A-WALL 图层',candidateNumbers:[1]}),request),/缺少与本地解析标注对应/);
 const visualRequest=makeDwgReviewRequest(drawing,[{i:0,c:drawing.candidates[0]}],{visualPages:1});
 assert.deepEqual(visualRequest.visualCandidateNumbers,[1]);
 const visual=extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,sourceInspected:false,evidenceBasis:'visual',sourceEvidence:'编号审图图像 #1 红色轮廓与周围线条相交，需要人工核对',candidateNumbers:[1]}),visualRequest);
 assert.equal(visual.unverified,true);assert.equal(visual.evidenceBasis,'visual');
 assert.throws(()=>extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,sourceInspected:false,evidenceBasis:'visual',sourceEvidence:'编号审图图像 #1 红色轮廓与周围线条相交，需要人工核对',candidateNumbers:[1]}),request),/缺少对应的编号图像依据/);
 assert.deepEqual(extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,sourceInspected:true,sourceEvidence:'A-WALL 图层及原图标注',candidateNumbers:[1]}),request).candidateNumbers,[1]);
});

test('elevation handoff stages source and bounded clues without silently adopting heights',()=>{
 const reference={drawingUse:'reference',source:{name:'教学楼立面图.dwg',sha256:'a'.repeat(64)},originalFile:{name:'教学楼立面图.dwg'},candidates:[],referenceHints:[{text:'建筑高度 22.30m',layer:'A-TEXT',sheetHint:'立面图'}],scanned:9267,unitsConfirmed:false,skippedBlocks:188};
 const request=makeDwgReferenceRequest(reference,{buildings:[{lot:'二期',number:'A',name:'教学楼'}]});
 assert.equal(request.kind,'reference');assert.equal(request.requiresSourceFile,true);
 assert.match(request.text,/建筑高度 22.30m/);assert.match(request.text,/188/);
 assert.match(request.text,/已从 DXF 解出 9267 个/);assert.match(request.text,/"unitsConfirmed":false/);
 assert.match(request.text,/不要凭总高均分每层/);
 assert.match(request.text,/结论.*下一步/);
 assert.throws(()=>makeDwgReferenceRequest({...reference,drawingUse:'plan'}),/立面或剖面/);
});

test('DSH elevation failures show the outcome before technical logs',()=>{
 const reply='## 一、是否实际读到原图：没有\n- 用 LibreDWG 0.14 解码，DXF 没有 ENTITIES 段；SHA-256 = '+ 'a'.repeat(64)+'\n- 无法确认立面标高。';
 const view=presentDshResponse(reply);
 assert.match(view.summary,/没有读到立面图原图/);
 assert.match(view.detail,/不能据此判断原图没有标高/);
 assert.equal(view.collapsed,true);
 assert.equal(view.raw,reply);
 const technical=presentDshResponse('结论：已读到 2 条。\n技术诊断：projectId=p；returnedRows=2。\n查询参数：ledger=receipt。');
 assert.equal(technical.markdown,'结论：已读到 2 条。');assert.equal(technical.collapsed,true);
 assert.equal(presentDshResponse('## 结论\n- 已找到 2 个待核轮廓').summary,'结论\n• 已找到 2 个待核轮廓');
});

import {detectFloorMatrix,detectOutputValuation,detectReceiptForm,floorMatrixImport,importGuess,mappedImport,matchColumns,materialPriceCandidates,outputValuationDraft,receiptFormImport,usefulMapping} from './sheet-import.js';
import {prepareChanges,extractChanges,hasChanges} from './assistant-changes.js';
test('Excel title rows, ambiguous price basis and explicit totals remain controlled',()=>{
 const d=validate(initial()),book=ledgerBook(d.projects[0],'change');
 const matrix=[['签证变更汇总表'],['编号','签证内容','未下浮金额（元）','下浮后金额（元）'],['Q-1','管道',100,90],['合计（元）','','100','90']];
 const config=importGuess(matrix,book.columns);assert.equal(config.headerRow,1);
 const amount=book.columns.findIndex(c=>c.name==='签证金额');assert.ok(amount>=0);assert.equal(config.mapping[amount],-1);
 config.mapping[amount]=3;const result=mappedImport(matrix,book.columns,{...config,source:'测试样本'});
 assert.equal(result.rows.length,1);assert.equal(result.skipped,1);assert.equal(result.rows[0].cells[book.columns[amount].id],'90');assert.match(result.rows[0].notes,/未下浮金额/);
 book.rows=result.rows;validate(d);
 assert.equal(matchColumns(['名称','名称'],[{id:'title',name:'名称'}])[0],-1);
});
test('Excel quantity cannot auto-match a payment amount',()=>{assert.deepEqual(matchColumns(['工程量'],[{id:'reported',name:'报送金额',type:'number'}]),[-1]);});
test('an output summary with only remarks mapped cannot append blank business rows',()=>{
 const columns=businessColumns('output');
 const matrix=[['项目名称','本月送审金额（元）','备注'],['一标安装',100,'以审定为准']];
 const config=importGuess(matrix,columns);
 assert.equal(usefulMapping(config.mapping,columns),false);
 assert.throws(()=>mappedImport(matrix,columns,config),/只有备注等辅助字段不能导入/);
 const reported=columns.findIndex(c=>c.id==='reported');config.mapping[reported]=1;
 assert.equal(mappedImport(matrix,columns,config).rows[0].cells.reported,'100');
});
test('material price import recognizes specification standard as specification',()=>{
 const columns=businessColumns('materials'),matrix=[['材料名称','规格标准','单位','单价（元）','品牌'],['电缆','WDZ-BYJ-3*2.5','m',25.8,'样本']];
 const config=importGuess(matrix,columns),specification=columns.findIndex(c=>c.id==='specification');
 assert.equal(config.mapping[specification],1);
 assert.equal(mappedImport(matrix,columns,config).rows[0].cells.specification,'WDZ-BYJ-3*2.5');
});
test('material quote with ambiguous adjustment price needs an explicit basis',()=>{
 const columns=businessColumns('materials'),matrix=[['工料机汇总表'],['序号','材料名称','','规格、型号','单位','调价(元)','备注'],[131,'电力电缆','','NG-A-0.6/1KV-4*50+1*25','m',198.55,'待核对']];
 const config=importGuess(matrix,columns),spec=columns.findIndex(c=>c.id==='specification'),price=columns.findIndex(c=>c.id==='price');
 assert.equal(config.headerRow,1);assert.equal(config.mapping[spec],3);assert.equal(config.mapping[price],-1);
 assert.deepEqual(materialPriceCandidates(matrix,config.headerRow,config.startRow),[{column:5,label:'调价(元)',filled:1}]);
 assert.throws(()=>mappedImport(matrix,columns,{...config,kind:'materials'}),/尚未匹配单价/);
 const unpriced=mappedImport(matrix,columns,{...config,kind:'materials',allowUnpriced:true});assert.equal(unpriced.rows[0].cells.price,'');assert.match(unpriced.rows[0].notes,/调价\(元\)：198.55/);
 assert.throws(()=>mappedImport(matrix,columns,{...config,kind:'materials',allowUnpriced:true,keepExtra:false}),/保留未匹配内容/);
 config.mapping[price]=5;const priced=mappedImport(matrix,columns,{...config,kind:'materials'});assert.equal(priced.rows[0].cells.price,'198.55');assert.equal(priced.rows[0].cells.taxBasis,'');
});
test('floor quantity matrix expands to unsigned receipt drafts with explicit building and source positions',()=>{
 const matrix=[['主体强电拆除收方台账'],['序号','清单项','清单总量','一层','二层','屋面层','合计','差值'],[1,'配电箱',67,19,15,'',34,33],[2,'电缆',12,0,'2.5',3,5.5,6.5],['','合计','','','','','','']];
 const plan=detectFloorMatrix(matrix);assert.equal(plan.headerRow,1);assert.equal(plan.floors.length,3);
 assert.throws(()=>floorMatrixImport(matrix,{plan}),/请选择/);
 const result=floorMatrixImport(matrix,{plan,building:'一期 · 原有教学楼',discipline:'电气',source:'收方单台账.xlsx / 主体强电拆除'});
 assert.equal(result.rows.length,4);assert.equal(result.items,2);
 assert.deepEqual(result.rows.map(r=>r.cells.reported),['19','15','2.5','3']);
 assert.equal(result.rows[0].cells.location,'一期 · 原有教学楼 / 一层');
 assert.equal(result.rows[0].cells.unit,undefined);assert.equal(result.rows[0].cells.status,'草稿');assert.equal(result.rows[0].cells.number,undefined);
 assert.match(result.rows[0].notes,/第 3 行 · 一层列/);assert.match(result.rows[0].notes,/清单总量：67/);
 assert.deepEqual(locateReceipt(result.rows[0]),{building:'E',floor:1});
 assert.throws(()=>floorMatrixImport([...matrix.slice(0,2),[1,'配电箱',67,-1]],{plan,building:'一期 · 原有教学楼'}),/不是有效的非负数/);
});
test('row-shaped implementation list maps content and skips section-only headings',()=>{
 const columns=businessColumns('receipt');
 const matrix=[['已实施清单'],['序号','施工内容','规格参数','单位','工程量','备注'],['一','合同范围内','','','',''],['','土建','','','',''],[1,'新建围挡','3m高','m',186.9,'已实施']];
 const config=importGuess(matrix,columns);assert.equal(config.headerRow,1);
 const result=mappedImport(matrix,columns,{...config,source:'已实施清单.xlsx',kind:'receipt'});
 assert.equal(result.rows.length,1);assert.equal(result.skipped,2);
 assert.equal(result.rows[0].cells.description,'新建围挡');assert.equal(result.rows[0].cells.reported,'186.9');
 assert.equal(result.rows[0].cells.status,'草稿');assert.match(result.rows[0].notes,/签认状态未核对/);
});
test('document-style receipt imports one unsigned record without inventing measured quantities',()=>{
 const matrix=[['现  场  收  方  单'],['工程名称','示例学校','分包单位','某施工方'],['工程部位','二期 · 体育场周边','日期','2025.8.1'],['工程内容(文字叙述或附图表示)','新建围挡：53+10.5=63.5m'],['分包单位','','施工单位','']];
 const plan=detectReceiptForm(matrix);assert.equal(plan.content.row,3);
 const result=receiptFormImport(matrix,{plan,source:'现场收方单.xlsx / 现场收方单'});
 assert.equal(result.rows.length,1);assert.deepEqual(result.rows[0].cells,{description:'新建围挡：53+10.5=63.5m',location:'二期 · 体育场周边',date:'2025-08-01',status:'草稿'});
 assert.match(result.rows[0].notes,/原文件未自动关联/);assert.equal(result.rows[0].files.length,0);
 assert.equal(detectReceiptForm([['现 场 收 方 单'],['工程内容','']]),null);
 assert.throws(()=>receiptFormImport([matrix[0],matrix[1],['工程部位','体育场','日期','2025.2.30'],matrix[3]]),/日期无效/);
});
test('multi-period valuation BOQ reports leaf total but blocks double-counted output ledger import',()=>{
 const row=(entries)=>{const a=Array(20).fill('');for(const [i,v] of entries)a[i]=v;return a;};
 const matrix=[row([[18,'本期分部分项合价']]),row([[1,'项目编码'],[2,'项目名称'],[13,'第六期']]),row([]),row([]),row([[0,'综合楼'],[18,30],[19,30]]),row([[0,'1'],[1,'0101'],[2,'管道'],[18,10]]),row([[0,'2'],[1,'0102'],[2,'阀门'],[18,20]])];
 const plan=detectOutputValuation(matrix);assert.equal(plan.amount,'30');assert.equal(plan.count,2);assert.equal(plan.nonzero,2);assert.equal(plan.summaries.length,1);assert.equal(plan.summaries[0].matches,true);
 assert.throws(()=>mappedImport(matrix,businessColumns('output'),{...importGuess(matrix,businessColumns('output')),kind:'output'}),/不能逐行导入/);
 const draft=outputValuationDraft(plan,{source:'第六期.xlsx / 汇总',category:'报总包额度产值',period:'第六期'});
 assert.equal(draft.cells.reported,undefined);assert.equal(draft.cells.verified,undefined);assert.equal(draft.cells.basis,'当期');assert.match(draft.notes,/分部分项清单行合价.*30 元/);assert.match(draft.notes,/原表期次提示：第六期/);
 const saved=initial();ledgerBook(saved.projects[0],'output').rows.push(draft);assert.equal(validate(saved).projects[0].ledgers.output.rows.length,1);
 assert.throws(()=>outputValuationDraft(plan,{source:'第六期.xlsx',category:'',period:'第六期'}),/产值口径/);
 assert.throws(()=>outputValuationDraft({...plan,invalid:1},{category:'报总包额度产值',period:'第六期'}),/未能唯一核对/);
});
test('DSH changes are atomic, scoped, conflict checked and replay protected',()=>{
 const data=validate(initial()),project=data.projects[0];project.rows.push({id:'r',cells:{description:'原内容'},notes:'',files:[]});
 const proposal={version:1,id:'acceptance-1',projectId:project.id,ledger:'receipt',operations:[{type:'update',rowId:'r',before:{description:'原内容'},cells:{description:'新内容'}},{type:'append',cells:{description:'新增内容'}}]};
 const result=prepareChanges(data,proposal,project.id);assert.equal(result.next.projects[0].rows.length,2);assert.equal(data.projects[0].rows[0].cells.description,'原内容');
 assert.throws(()=>prepareChanges(data,proposal,'other'),/其他项目/);
 assert.throws(()=>prepareChanges(result.next,proposal,project.id),/已发生变化/);
 const invalid=structuredClone(proposal);invalid.operations[1].cells={unknown:'坏字段'};assert.throws(()=>prepareChanges(data,invalid,project.id),/未知/);assert.equal(data.projects[0].rows.length,1);
 const append={...proposal,operations:[proposal.operations[1]]};const once=prepareChanges(data,append,project.id);assert.throws(()=>prepareChanges(once.next,append,project.id),/已经添加/);
 assert.deepEqual(extractChanges('```meb-change\n'+JSON.stringify(proposal)+'\n```'),proposal);
 assert.deepEqual(extractChanges('```meb-change json\r\n'+JSON.stringify(proposal)+'\r\n```'),proposal);
 assert.equal(hasChanges('```meb-change json\n{}\n```'),true);
 assert.throws(()=>extractChanges('```meb-change\ninvalid\n```'),/格式/);
});
test('DSH receipt draft fields render as one reviewable append',()=>{
 const data=validate(initial()),project=data.projects[0];
 const proposal={version:1,id:'SF-2026-006',projectId:project.id,ledger:'receipt',summary:'现场收方单 2026-10-07',operations:[{type:'append',cells:{number:'SF-2026-006',location:'1号楼 / 3F',description:'桥架安装',reported:'36',unit:'m',boqCode:'DQ-03-008',remarks:'现场收方单 2026-10-07'}}]};
 const result=prepareChanges(data,proposal,project.id);assert.equal(result.changes.length,1);assert.deepEqual(result.next.projects[0].rows[0].cells,proposal.operations[0].cells);assert.match(result.changes[0].label,/SF-2026-006 · 1号楼 \/ 3F · 桥架安装/);
});
test('DSH can propose confirmed material-library changes without touching project rows',()=>{
 const data=validate(initial()),project=data.projects[0];
 const proposal={version:1,id:'material-1',projectId:project.id,ledger:'materials',operations:[{type:'append',cells:{title:'电缆',unit:'m',price:'125.5',source:'供应商报价'}}]};
 const result=prepareChanges(data,proposal,project.id);assert.equal(result.next.materials.rows.length,1);assert.equal(result.next.materials.rows[0].cells.price,'125.5');assert.equal(result.next.projects[0].rows.length,0);assert.equal(data.materials.rows.length,0);
});

test('project model generation preserves CAD polygons and custom floor elevations',async()=>{
 const {initialModelConfig,generateModel,modelDocument}=await import('./model-generation.js');
 const cad={site:[[0,0],[20,0],[20,20],[0,20]],buildings:[{id:'E',name:'旧楼',floors:2,height:7,polygon:[[1,1],[10,1],[10,10],[1,10]]}]};
 const original=JSON.stringify(cad),c=initialModelConfig(cad);c.buildings[0].name='教学楼';c.buildings[0].number='01';c.buildings[0].heights=[4.5,3.2,3.3];
 const generated=generateModel(c,cad);assert.equal(generated.buildings[0].height,11);assert.equal(generated.buildings[0].floors,3);assert.deepEqual(generated.buildings[0].polygon,cad.buildings[0].polygon);assert.equal(JSON.stringify(cad),original);
 const state=initial();state.projects[0].modelConfig=c;assert.deepEqual(validate(JSON.parse(JSON.stringify(state))).projects[0].modelConfig,c);
 c.buildings[0].name='</script>';assert.ok(!modelDocument('<head></head>',c,cad).includes('"name":"</script>"'));
 assert.throws(()=>generateModel({mode:'blocks',buildings:[{id:'x',number:'1',name:'楼',width:20,depth:10,x:0,y:0,heights:[0]}]},cad));
 const block=generateModel({mode:'blocks',buildings:[{id:'x',number:'1',name:'楼',width:20,depth:10,x:5,y:6,heights:[3,4]}]},cad);assert.deepEqual(block.buildings[0].polygon,[[5,6],[25,6],[25,16],[5,16]]);
});

test('custom model receipt locations are unambiguous and isolated after serialization',async()=>{
 const {validateModelConfig}=await import('./model-generation.js');
 const building=(id,number,name)=>({id,number,name,width:20,depth:10,x:0,y:0,heights:[4.5,3.2,3.3]});
 const config={mode:'blocks',buildings:[building('one','1','办公楼'),building('eleven','11','教学楼')]};
 assert.deepEqual(locateReceipt({cells:{location:'11栋 / 2F'}},config),{building:'eleven',floor:2});
 const numberedNames={...config,buildings:[building('one','01','1号楼'),building('eleven','11','11号楼')]};
 assert.deepEqual(locateReceipt({cells:{location:'二标段 · 11号楼 / 2F'}},numberedNames),{building:'eleven',floor:2});
 assert.deepEqual(locateReceipt({cells:{location:'1号楼与11号楼 / 2F'}},numberedNames),{building:null,floor:null});
 assert.deepEqual(locateReceipt({cells:{location:'1栋 / 4F'}},config),{building:null,floor:null});
 assert.deepEqual(locateReceipt({cells:{location:'11栋 / 2F-3F'}},config),{building:null,floor:null});
 assert.deepEqual(locateReceipt({cells:{location:'一期原有教学楼'}},{...config,buildings:[config.buildings[0]]}),{building:null,floor:null});
 assert.deepEqual(locateReceipt({cells:{location:'一期 / 2F'}},{...config,mode:'imported'}),{building:null,floor:null});
 const state=initial();state.projects.push(blankProject('other','独立项目'));state.projects[0].modelConfig=config;
 const restored=validate(JSON.parse(JSON.stringify(state)));assert.equal(restored.projects[1].modelConfig,undefined);assert.deepEqual(restored.projects[0].modelConfig,config);
 assert.throws(()=>validateModelConfig({mode:'cad',buildings:[building('missing','1','楼')]}),/CAD/);
 const duplicate=structuredClone(config);duplicate.buildings[1].number='1';assert.throws(()=>validateModelConfig(duplicate),/不重复/);
});

test('DWG candidate needs confirmed floor heights and survives project save without source bytes',async()=>{
 const {generateModel,validateModelConfig}=await import('./model-generation.js');
 const {inspectDwgUpload}=await import('./dwg-import.js');
 const cad={site:[],buildings:[]};
 const c={mode:'imported',source:{name:'总图.dwg',sha256:'a'.repeat(64),units:'mm'},buildings:[{id:'dwg-1',number:'A',name:'教学楼',polygon:[[0,0],[20,0],[20,12],[0,12]],cadLayer:'A-WALL',closureGap:0,heights:[]}]};
 assert.throws(()=>validateModelConfig(c),/层高/);
 c.buildings[0].heights=[4.2,3.6];const model=generateModel(c,cad);assert.ok(Math.abs(model.buildings[0].height-7.8)<1e-8);assert.deepEqual(model.buildings[0].polygon,c.buildings[0].polygon);
 const data=initial();data.projects[0].modelConfig=c;const restored=validate(JSON.parse(JSON.stringify(data)));assert.deepEqual(restored.projects[0].modelConfig,c);assert.equal(JSON.stringify(restored).includes('base64'),false);
 await assert.rejects(inspectDwgUpload({name:'wrong.dwg',base64:Buffer.from('not a DWG').toString('base64')}),/不是受支持/);
});

test('a drawn cut previews and saves separate buildings without changing the source footprint',async()=>{
 const {generateModel}=await import('./model-generation.js');
 const cad={site:[],buildings:[]},source={id:'whole',number:'A',name:'教学楼',lot:'一期',polygon:[[0,0],[10,0],[10,10],[0,10]],holes:[[[3,3],[7,3],[7,7],[3,7]]],heights:[4.2,3.6],cadLayer:'A-WALL',dwgSource:{name:'总图.dwg',sha256:'a'.repeat(64),units:'m'}};
 const config={mode:'imported',buildings:[source]},snapshot=structuredClone(config);
 const result=splitModelBuilding(config,cad,'whole',[[5,1],[5,9]]);
 assert.equal(result.children.length,2);assert.deepEqual(result.areas.map(Math.round),[42,42]);assert.equal(result.sourceArea,84);
 assert.deepEqual(config,snapshot);assert.deepEqual(result.children.map(b=>b.number),['A-1','A-2']);assert.deepEqual(result.children.map(b=>b.heights),[[4.2,3.6],[4.2,3.6]]);
 const state=initial();state.projects[0].modelConfig=result.config;
 const restored=validate(JSON.parse(JSON.stringify(state))).projects[0].modelConfig;
 assert.deepEqual(restored,result.config);assert.equal(generateModel(restored,cad).buildings.length,2);
 assert.equal(restored.buildings[0].dwgSource.name,'总图.dwg');
 const awaiting={...config,buildings:[{...source,heights:[]}]};assert.deepEqual(splitModelBuilding(awaiting,cad,'whole',[[5,1],[5,9]]).children.map(b=>b.heights),[[],[]]);
 assert.throws(()=>splitModelBuilding(config,cad,'whole',[[-5,0],[-5,10]]),/没有穿过/);
 assert.throws(()=>splitModelBuilding(config,cad,'whole',[[5,5],[5.01,5.01]]),/太短/);
});

test('CAD and parameter buildings can be split into editable polygons',()=>{
 const cad={site:[[-2,-2],[22,-2],[22,12],[-2,12]],buildings:[{id:'E',name:'原楼',polygon:[[0,0],[20,0],[20,10],[0,10]],floors:2,height:7}]};
 const original=structuredClone(cad),config={mode:'cad',buildings:[{id:'E',number:'1',name:'原楼',heights:[3.5,3.5]}]};
 const result=splitModelBuilding(config,cad,'E',[[10,0],[10,10]]);
 assert.equal(result.config.mode,'imported');assert.deepEqual(result.config.site,cad.site);assert.equal(result.config.buildings.length,2);assert.deepEqual(cad,original);
 const blocks={mode:'blocks',buildings:[{id:'b',number:'1',name:'新楼',width:20,depth:10,x:0,y:0,heights:[3]}]};
 assert.deepEqual(splitModelBuilding(blocks,cad,'b',[[10,0],[10,10]]).areas,[100,100]);
});

test('several DWGs append by lot without losing provenance or shared CAD positions',async()=>{
 const {addDwgContours}=await import('./dwg-model.js');
 const {generateModel}=await import('./model-generation.js');
 const cad={site:[[0,0],[100,0],[100,80],[0,80]],buildings:[]};
 const source=(name,origin)=>({units:'m',origin,source:{name,sha256:(name==='一标段.dwg'?'a':'b').repeat(64)},candidates:[{index:9,layer:'A-WALL',points:[[0,0],[20,0],[20,12],[0,12]],gap:0}]});
 assert.throws(()=>addDwgContours({mode:'blocks',buildings:[]},cad,{...source('立剖面.dwg',[0,0]),drawingUse:'reference'},[0],{units:'m',lot:'一标段'}),/不能作为楼栋平面轮廓/);
 const first=addDwgContours({mode:'blocks',buildings:[]},cad,source('一标段.dwg',[100,200]),[0],{units:'m',lot:'一标段',append:false,x:0,y:0});
 assert.deepEqual(first.coordinateOrigin,[100,200]);assert.deepEqual(first.buildings[0].polygon[0],[0,0]);
 first.buildings[0].heights=[3.6,3.6];
 const second=addDwgContours(first,cad,source('二标段.dwg',[150,200]),[0],{units:'m',lot:'二标段',append:true,alignment:'shared'});
 assert.equal(second.buildings.length,2);assert.deepEqual(second.buildings[1].polygon[0],[50,0]);assert.equal(second.buildings[0].dwgSource.name,'一标段.dwg');assert.equal(second.buildings[1].lot,'二标段');
 assert.throws(()=>addDwgContours(second,cad,{...source('一标段.dwg',[100,200]),source:{name:'另一张图.dwg',sha256:'c'.repeat(64)}},[0],{units:'m',lot:'一标段',append:true,alignment:'shared'}),/重合/);
 assert.throws(()=>addDwgContours(second,cad,source('一标段.dwg',[100,200]),[0],{units:'m',lot:'三标段',append:true,x:300}),/已采用/);
 const nested={...source('内外轮廓.dwg',[0,0]),candidates:[{index:1,layer:'外墙',points:[[0,0],[30,0],[30,30],[0,30]],gap:0},{index:2,layer:'内墙',points:[[3,3],[27,3],[27,27],[3,27]],gap:0}]};
 assert.throws(()=>addDwgContours({mode:'blocks',buildings:[]},cad,nested,[0,1],{units:'m',lot:'一标段'}),/套叠/);
 second.buildings[1].heights=[4,4];const saved=initial();saved.projects[0].modelConfig=second;
 const restored=validate(JSON.parse(JSON.stringify(saved))).projects[0].modelConfig;
 assert.deepEqual(restored,second);const model=generateModel(restored,cad);assert.deepEqual(model.buildings.map(b=>b.lot),['一标段','二标段']);assert.equal(model.buildings[1].dwgSource.name,'二标段.dwg');assert.equal(model.buildings[1].cadEntityIndex,9);assert.equal(model.buildings[1].cadLayer,'A-WALL');
});

test('lots may reuse building numbers while receipt location stays unambiguous',async()=>{
 const {addDwgContours}=await import('./dwg-model.js');
 const {generateModel,validateModelConfig}=await import('./model-generation.js');
 const cad={site:[],buildings:[]};
 const drawing=(name,origin)=>({units:'m',origin,source:{name,sha256:(name==='一标段.dwg'?'a':'b').repeat(64)},candidates:[{index:1,layer:'A-WALL',points:[[0,0],[12,0],[12,10],[0,10]],gap:0}]});
 const first=addDwgContours({mode:'blocks',buildings:[]},cad,drawing('一标段.dwg',[0,0]),[0],{units:'m',lot:'一标段'});
 const second=addDwgContours(first,cad,drawing('二标段.dwg',[0,0]),[0],{units:'m',lot:'二标段',append:true,x:30});
 assert.deepEqual(second.buildings.map(b=>b.number),['1','1']);
 for(const b of second.buildings){b.name='1号楼';b.heights=[3.6,3.6];}
 validateModelConfig(second);assert.equal(generateModel(second,cad).buildings.length,2);
 const saved=initial();saved.projects[0].modelConfig=second;
 const restored=validate(JSON.parse(JSON.stringify(saved))).projects[0].modelConfig;
 assert.deepEqual(restored.buildings.map(b=>b.number),['1','1']);
 assert.deepEqual(locateReceipt({cells:{location:'二标段 / 1号楼 / 2F'}},restored),{building:second.buildings[1].id,floor:2});
 assert.deepEqual(locateReceipt({cells:{location:'1号楼 / 2F'}},restored),{building:null,floor:null});
 const duplicate=structuredClone(second);duplicate.buildings[1].lot='一标段';assert.throws(()=>validateModelConfig(duplicate),/不重复/);
});

test('appending a new lot to existing CAD preserves its original site and courtyards',async()=>{
 const {addDwgContours}=await import('./dwg-model.js');
 const {generateModel}=await import('./model-generation.js');
 const cad={site:[[0,0],[100,0],[100,80],[0,80]],buildings:[{id:'E',polygon:[[0,0],[20,0],[20,20],[0,20]],holes:[[[5,5],[10,5],[10,10],[5,10]]]}]};
 const existing={mode:'cad',buildings:[{id:'E',number:'E',name:'原教学楼',heights:[4,4]}]};
 const drawing={units:'m',origin:[200,300],source:{name:'二标段.dwg',sha256:'c'.repeat(64)},candidates:[{index:3,layer:'SITE-BLD',points:[[0,0],[15,0],[15,10],[0,10]],gap:0}]};
 const merged=addDwgContours(existing,cad,drawing,[0],{units:'m',lot:'二标段',append:true,x:40,y:0});
 merged.buildings[1].heights=[3.5,3.5];const model=generateModel(merged,cad);
 assert.deepEqual(model.site,cad.site);assert.deepEqual(model.buildings[0].holes,cad.buildings[0].holes);assert.deepEqual(model.buildings[1].polygon[0],[40,0]);
});

test('DSH DWG review only accepts suggestions for the sent drawing and visible candidates',()=>{
 const drawing={source:{name:'二期平面.dwg',sha256:'f'.repeat(64)},units:'mm',candidates:[{index:106,layer:'A-WALL',points:[[0,0],[10,0],[10,8],[0,8]],width:10,depth:8,area:80,gap:0,closed:true},{index:200,layer:'A-Road',points:[[40,0],[60,0],[60,10],[40,10]],width:20,depth:10,area:200,gap:0,closed:true}]};
 const request=makeDwgReviewRequest(drawing,[{i:0,c:drawing.candidates[0]}],{units:'mm',lot:'二标段'});
 assert.deepEqual(request.allowedNumbers,[1]);assert.match(request.text,/A-WALL/);assert.doesNotMatch(request.text,/A-Road/);assert.match(request.text,/不是 DWG handle/);
 const answer=content=>`建议：\n\`\`\`meb-model-review\n${JSON.stringify(content)}\n\`\`\``;
 assert.deepEqual(extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,candidateNumbers:[1],reason:'需核对外墙'}),request).candidateNumbers,[1]);
 assert.throws(()=>extractDwgReviewSuggestion(answer({sourceSha256:'a'.repeat(64),candidateNumbers:[1]}),request),/不属于当前图纸/);
 assert.throws(()=>extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,candidateNumbers:[2]}),request),/未发送/);
 assert.throws(()=>extractDwgReviewSuggestion(answer({sourceSha256:drawing.source.sha256,candidateNumbers:[1,1]}),request),/重复/);
 assert.throws(()=>makeDwgReviewRequest(drawing,Array.from({length:81},()=>({i:0,c:drawing.candidates[0]}))),/80 个以内/);
});


test('business review scope follows selections and drafts and warns about incomplete evidence',()=>{
 const base={dataState:'已保存数据',visibleRows:80,totalRows:80,returnedRows:50,truncated:true};
 assert.equal(assistantScope(JSON.stringify(base)).snapshot,false);
 const selected=assistantScope(JSON.stringify({...base,selectedCount:60,visibleRows:60}));
 assert.equal(selected.snapshot,true);assert.equal(selected.attached,50);assert.equal(selected.partial,true);assert.match(selected.label,/60 条/);
 assert.equal(assistantScope(JSON.stringify({...base,dataState:'当前未保存编辑'})).snapshot,true);
 assert.equal(assistantScope(JSON.stringify({...base,visibleRows:0,returnedRows:0})).attached,0);
 assert.equal(assistantScope(JSON.stringify(base),'none').snapshot,false);
 const response='## 结论\n数量 12.5 m；JSON 对照仅供复核。\n\n## 下一步\n请核对报审单。';
 assert.equal(presentDshResponse(response).markdown,response);
});

test('calculator review reports its own scope and does not attach unrelated receipt rows',()=>{
 const p=validate(initial()).projects[0];
 p.rows=[{id:'receipt-private',cells:{description:'无关收方记录'},files:[],notes:''}];
 p.calculationSheets={cable:{params:{},rows:Array.from({length:60},(_,i)=>({id:'c'+i,name:'测试计算',length:'1',specification:'YJV-3x4',overrides:{}}))}};
 const text=projectContext(p,'calculator','receipt',{calcTool:'cable',unsaved:true}),context=JSON.parse(text);
 assert.equal(context.rows.length,0);assert.ok(!text.includes('无关收方记录'));
 assert.equal(context.calculationTotalRows,60);assert.equal(context.calculationReturnedRows,50);assert.equal(context.truncated,true);
 const scope=assistantScope(text);assert.equal(scope.attached,50);assert.match(scope.label,/计算表 60/);
 assert.equal(JSON.parse(projectRouteContext(text)).tool,'cable');
 assert.match(sentMessageScope(workbenchPrompt('核对',text,true,true)),/已发送 50 条当前记录/);
});

test('batched review covers every selected record once and retries the same failed page',async()=>{
 const p=blankProject('batch','分批项目');p.rows=Array.from({length:65},(_,i)=>({id:String(i),cells:{description:'收方内容'.repeat(80),number:'SF-'+i},notes:'',files:[]}));
 const page=offset=>projectContext(p,'table','receipt',{viewRows:p.rows,offset,unsaved:true});
 const received=[];let fail=false;
 const session={beginSubmission:()=>({requestId:'batch',abandon(){}}),prompt:async(parts)=>{
  if(fail)return {ok:false,error:{message:'连接中断'}};
  const payload=JSON.parse(parts[0].text.match(/<project-data>\s*([\s\S]*?)<\/project-data>/)[1]);received.push(...payload.rows.map(r=>r.id));return {ok:true};
 }};
 let result=await sendReviewPage(session,page,0,'查缺项');assert.ok(result.sent<65);
 fail=true;await assert.rejects(()=>sendReviewPage(session,page,result.next,'查缺项'),/连接中断/);const before=received.length;
 fail=false;while(result.next!==null)result=await sendReviewPage(session,page,result.next,'查缺项');
 assert.equal(before,new Set(received.slice(0,before)).size);assert.equal(result.sent,65);assert.deepEqual(received,p.rows.map(r=>r.id));
 await assert.rejects(()=>sendReviewPage(session,()=>JSON.stringify({rowOffset:0,returnedRows:0,visibleRows:65}),0,'查缺项'),/无法附带记录/);
});

test('calculation paste is atomic and preserves Excel empty and quoted cells',()=>{
 const sheet=emptySheet('cable');sheet.rows=[{id:'one',name:'旧事项',specification:'旧规格',length:'99',overrides:{density:'0.0089'}}];
 const original=structuredClone(sheet);
 const pasted=pasteCalculationRows(sheet,'one','name','"教学楼\n一层"\tWDZ-BYJ-3*2.5\t\r\n二层\tYJV-3*4\t1,200\r\n');
 assert.equal(pasted.count,2);assert.equal(pasted.sheet.rows[0].name,'教学楼\n一层');assert.equal(pasted.sheet.rows[0].length,'');assert.equal(pasted.sheet.rows[1].length,'1200');assert.deepEqual(pasted.sheet.rows[0].overrides,original.rows[0].overrides);assert.deepEqual(sheet,original);
 assert.throws(()=>pasteCalculationRows(sheet,'one','specification','新规格\t10\t多余列'),/最多可粘贴 2 列/);
 assert.throws(()=>pasteCalculationRows(sheet,'one','name','"未闭合\t10'),/引号不完整/);assert.deepEqual(sheet,original);
});

import {evaluateFormula,validateRule,resolveCustom,customSnapshot,pasteCustomRows,customTotal,customSummary} from './custom-calculation.js';
const customExample=()=>({id:'rule-1',name:'保温展开量',formula:'长度 × 宽度 × (1 + 损耗率 / 100)',unit:'m²',precision:4,note:'自行约定的示例',variables:[{id:'v1',name:'长度',unit:'m',fixed:false,value:''},{id:'v2',name:'宽度',unit:'m',fixed:false,value:''},{id:'v3',name:'损耗率',unit:'%',fixed:true,value:'3'}],rows:[{id:'row-custom',name:'教学楼',values:{v1:'10',v2:'2'},note:''}]});
test('custom arithmetic handles named variables, functions and rejects executable expressions',()=>{
 assert.equal(resolveCustom(customExample(),customExample().rows[0]).display,'20.6000');
 assert.equal(evaluateFormula('最大值(2, 3) + 四舍五入(1.234, 2) + 10%',{}).value,4.33);
 assert.equal(evaluateFormula('-2^2 + 2^-2',{}).value,-3.75);
 for(const expr of ['globalThis.alert(1)','constructor(1)','1/0','长度 +','2(3)','2^99999'])assert.throws(()=>evaluateFormula(expr,{长度:1}));
 assert.throws(()=>validateRule({...customExample(),formula:'未知量+1'}),/未定义/);
 assert.throws(()=>validateRule({...customExample(),variables:[...customExample().variables,{id:'v4',name:'长度',fixed:false,value:'',unit:'m'}]}),/重名/);
});
test('custom rules persist, paste is atomic, snapshots stay frozen and DSH queries actual saved values',()=>{
 const d=initial(),p=d.projects[0],rule=customExample();p.customCalculations=[rule];
 const rows=pasteCustomRows(rule,'row-custom','name','一层\t10\t2\t\n二层\t20\t3\t说明');assert.equal(rows.length,2);assert.equal(rows[1].values.v2,'3');assert.equal(rule.rows.length,1);
 assert.throws(()=>pasteCustomRows(rule,'row-custom','v2','2\t备注\t多余'),/超出/);
 const record=customSnapshot(p,rule,rule.rows[0]);ledgerBook(p,'calculation').rows.push(record);
 const restored=validate(JSON.parse(JSON.stringify(d)));assert.equal(restored.projects[0].customCalculations[0].variables[2].value,'3');assert.equal(restored.projects[0].ledgers.calculation.rows[0].source.customRule.formula,rule.formula);
 rule.variables[2].value='5';assert.equal(record.source.inputs.损耗率,'3');assert.equal(record.source.result,20.6);assert.notEqual(resolveCustom(rule,rule.rows[0]).signature,record.source.signature);
 const read=JSON.parse(queryCalculation(d,{projectId:p.id,kind:'custom',rowId:'row-custom'}));assert.equal(read.rows[0].result,'21.0000');assert.equal(read.rows[0].inputs.损耗率,5);assert.equal(read.dataState,'已保存数据');
 const context=JSON.parse(projectContext(p,'calculator','receipt',{calcTool:'custom',unsaved:true}));assert.equal(context.calculationReturnedRows,1);assert.equal(context.customRules[0].name,rule.name);
});

test('custom totals use displayed decimals without binary rounding drift',()=>{
 assert.deepEqual(customTotal([{display:'0.10'},{display:'0.20'},{error:'待填'}],2),{count:2,display:'0.30'});
 assert.equal(customTotal([{display:'-1.25'},{display:'0.20'}],2).display,'-1.05');
 const rows=[{id:'1'},{id:'2'}],resolved=row=>row.id==='1'?{display:'0.10'}:{error:'待填'};
 assert.deepEqual(customSummary(rows,2,resolved),{count:1,errors:1,display:'0.10'});
});

import {clearSavedDraft,draftSnapshot,restoreDraft} from './save-draft.js';
test('browser drafts exclude attachment bytes and restore only live matching files',()=>{
 const data=validate(initial()),file={id:'f',projectId:data.projects[0].id,name:'secret.pdf',mime:'application/pdf',kind:'copy',size:3,data:'data:application/pdf;base64,eA==',createdAt:'2026-10-07T00:00:00Z'};
 data.files.push(file);const draft=draftSnapshot(data);assert.deepEqual(draft.files,[]);assert.deepEqual(draft.draftFileIds,['f']);assert.ok(!JSON.stringify(draft).includes('eA=='));
 const restored=restoreDraft(data,draft);assert.deepEqual(restored.files,[file]);assert.deepEqual(restoreDraft(data,draftSnapshot(draft)).files,[file]);
});
test('saved documents reject aggregate attachment payloads above the host limit',()=>{
 const data=initial(),payload='data:application/octet-stream;base64:'+'A'.repeat(13_333_336);
 for(let i=0;i<4;i++)data.files.push({id:`cap-${i}`,projectId:data.projects[0].id,name:`cap-${i}.bin`,mime:'application/octet-stream',kind:'copy',size:10_000_000,data:payload,createdAt:'2026-10-07T00:00:00Z'});
 assert.ok(JSON.stringify(data).length>MAX_DOCUMENT_BYTES);assert.throws(()=>validate(data),/45 MB/);
});
test('successful saves preserve other drafts and tolerate unavailable browser storage',()=>{
 const snapshot={revision:1,projects:[]};let raw=JSON.stringify(snapshot),removed=0;
 const storage={getItem:()=>raw,removeItem:()=>{removed++;raw=null;}};
 assert.equal(clearSavedDraft(()=>storage,snapshot).cleared,true);assert.equal(removed,1);
 raw=JSON.stringify({...snapshot,revision:2});assert.equal(clearSavedDraft(()=>storage,snapshot).cleared,false);assert.equal(removed,1);
 assert.match(clearSavedDraft(()=>{throw Error('blocked');},snapshot).message,/草稿未能清理/);
 raw=JSON.stringify(snapshot);assert.equal(clearSavedDraft(()=>({...storage,removeItem(){throw Error('blocked');}}),snapshot).cleared,false);
});

import {apply as applyWorkbench,inject as workbenchInject} from './index.js';
test('host save handler serializes conflicts, survives failed writes and preserves project isolation',async()=>{
 let stored=validate(initial()),route,fail=false;const promptSections=[];
 const ctx={systemPrompt:{getSectionOrder:()=>0,section:value=>{promptSections.push(value);return()=>{};}},storageDomain:{open:async()=>({close(){},global:{get:()=>structuredClone(stored),set:async value=>{await new Promise(resolve=>setTimeout(resolve,5));if(fail){fail=false;throw Error('模拟磁盘写入失败');}stored=structuredClone(value);}}})},effect:fn=>fn(),tools:{register:()=>()=>{}},connection:{fetch:{register:value=>{route=value.fetch;return()=>{};}}}};
 await applyWorkbench(ctx);
 assert.ok(workbenchInject.includes('systemPrompt'));assert.equal(promptSections[0].name,'meb:assistant');assert.match(promptSections[0].text,/工程造价项目助手/);
 const rpc=async(endpoint,payload)=>(await route(new Request('http://fixture/api/meb-workbench',{method:'POST',body:JSON.stringify({endpoint:'meb/'+endpoint,payload})}))).json();
 const first=structuredClone(stored);first.projects.push(blankProject('save-test','保存验收示例'));const otherBefore=JSON.stringify(first.projects[0]);
 const competing=structuredClone(first);competing.projects.at(-1).name='冲突写入不应生效';
 const [a,b]=await Promise.all([rpc('save',first),rpc('save',competing)]);
 assert.equal(a.ok,true);assert.equal(b.ok,false);assert.match(b.error.message,/其他窗口/);
 assert.equal(stored.revision,first.revision+1);assert.equal(JSON.stringify(stored.projects[0]),otherBefore);
 const next=structuredClone(stored);next.projects.at(-1).name='重试后保存';fail=true;
 const failed=await rpc('save',next);assert.equal(failed.ok,false);assert.equal(stored.projects.at(-1).name,'保存验收示例');
 assert.equal((await rpc('save',next)).ok,true);
 const read=await rpc('read');assert.equal(read.value.projects.at(-1).name,'重试后保存');assert.equal(JSON.stringify(read.value.projects[0]),otherBefore);
 const withRule=structuredClone(stored);withRule.projects.at(-1).customCalculations=[{id:'legacy-guard',name:'固定计算',formula:'2 * 3',unit:'m²',precision:2,note:'',variables:[],rows:[]}];
 assert.equal((await rpc('save',withRule)).ok,true);
 const previous=structuredClone(stored),oldClient=structuredClone(stored);delete oldClient.projects.at(-1).customCalculations;
 const rejected=await rpc('save',oldClient);assert.equal(rejected.ok,false);assert.match(rejected.error.message,/页面版本过旧/);assert.deepEqual(stored,previous);
 const explicit=structuredClone(stored);explicit.projects.at(-1).customCalculations=[];assert.equal((await rpc('save',explicit)).ok,true);assert.deepEqual(stored.projects.at(-1).customCalculations,[]);
});

import {workbenchRequest} from './workbench-request.js';
test('host authentication and connection failures use actionable messages without parsing auth pages',async()=>{
 let parsed=false;
 await assert.rejects(workbenchRequest('read',null,async()=>({status:401,json(){parsed=true;throw Error('unauthorized');}})),/登录已失效/);assert.equal(parsed,false);
 await assert.rejects(workbenchRequest('save',{},async()=>({status:403})),/访问权限/);
 await assert.rejects(workbenchRequest('read',null,async()=>{throw Error('network');}),/无法连接 DSH/);
 await assert.rejects(workbenchRequest('read',null,async()=>({ok:true,json:async()=>{throw Error('HTML');}})),/返回内容无法读取/);
 await assert.rejects(workbenchRequest('save',{},async()=>({ok:true,json:async()=>({ok:false,error:{message:'其他窗口已经修改数据'}})})),/其他窗口/);
 assert.equal(await workbenchRequest('read',null,async(path,options)=>{assert.equal(path,'/api/meb-workbench');assert.equal(options.credentials,'same-origin');assert.equal(JSON.parse(options.body).endpoint,'meb/read');return {ok:true,json:async()=>({ok:true,apiVersion:8,value:42})};}),42);
});

test('DSH upload receipts are cached by File identity and session',async()=>{
 let calls=0;const service={upload:async()=>({ok:true,value:{receiptId:'r'+(++calls)}})},cache=new WeakMap(),a={name:'same.dwg'},b={name:'same.dwg'};
 assert.equal(await uploadReviewFile(service,'s',a,cache),'r1');
 assert.equal(await uploadReviewFile(service,'s',a,cache),'r1');
 assert.equal(await uploadReviewFile(service,'s',b,cache),'r2');
 assert.equal(await uploadReviewFile(service,'t',a,cache),'r3');
});

import {exportRows,ledgerExportMatrix} from './ledger-export.js';
test('ledger export follows visible scope and explicit selection, preserves frozen business parameters',()=>{
 const rows=[{id:'a',cells:{reported:'1'},notes:'',files:[]},{id:'b',cells:{reported:'2'},notes:'',files:[]}];
 const scope={rowIds:['b'],selectedIds:[]};assert.deepEqual(exportRows(rows,scope).map(r=>r.id),['b']);assert.deepEqual(exportRows(rows,scope,true),[]);assert.deepEqual(exportRows(rows,{rowIds:[],selectedIds:[]}),[]);
 const sheet=emptySheet('cable');sheet.params.base='68740';sheet.params.current='105825';const r={...newCalculationRow(),specification:'3×2.5',length:'100'},record=snapshotRecord({id:'p',name:'测试项目'},'cable',sheet,r);
 const matrix=ledgerExportMatrix([record],[{id:'amount',name:'金额',type:'number'}],'calculation');
 assert.ok(matrix[1][3].includes('施工月均铜价'));assert.ok(matrix[1][3].includes('105825'));assert.equal(matrix[1][5],record.source.result);assert.ok(!JSON.stringify(matrix).includes(record.source.rowId));assert.ok(!JSON.stringify(matrix).includes('signature'));
});
test('saved business and calculation filters survive validation and legacy views remain valid',()=>{
 const d=initial(),p=d.projects[0];p.views=[{id:'v',name:'一层给排水',query:'管',status:'',sort:'reported',filters:{summaryFilters:{location:'教学楼一层',discipline:'给排水',description:null},summaryMode:'location',receiptFilter:null,category:''}},{id:'old',name:'旧视图',query:'',status:'',sort:''}];
 ledgerBook(p,'calculation').views=[{id:'calc',name:'本月调差',query:'',status:'',sort:'',filters:{kind:'电线电缆铜价调差',from:'2026-09-01',to:'2026-09-30'}}];
 const restored=validate(JSON.parse(JSON.stringify(d)));assert.deepEqual(restored.projects[0].views,p.views);assert.deepEqual(restored.projects[0].ledgers.calculation.views,p.ledgers.calculation.views);
});
test('custom paste respects filtered rows without overwriting hidden entries',()=>{
 const rule={variables:[{id:'n',fixed:false}],rows:[{id:'a',name:'A',values:{n:'1'},note:''},{id:'hidden',name:'隐藏',values:{n:'99'},note:''},{id:'b',name:'B',values:{n:'2'},note:''}]};
 const result=pasteCustomRows(rule,'a','n','10\n20\n30',[rule.rows[0],rule.rows[2]]);
 assert.deepEqual(result.map(r=>r.values.n),['10','99','20','30']);assert.deepEqual(rule.rows.map(r=>r.values.n),['1','99','2']);
});
test('missing local reference provides a relocation instruction',async()=>{
 const {inspectReference}=await import('./file-reference.js');
 await assert.rejects(inspectReference('/__meb_missing_delivery_file__/original.txt'),/重新定位/);
 await assert.rejects(inspectReference('relative.txt'),/完整路径/);
});

test('updated client refuses an older running host before editing',async()=>{await assert.rejects(workbenchRequest('read',null,async()=>({ok:true,json:async()=>({ok:true,apiVersion:2,value:{}})})),/请重启 DSH/);await assert.rejects(workbenchRequest('read',null,async()=>({ok:true,json:async()=>({ok:true,value:{}})})),/请重启 DSH/);});

import {calculationSummary} from './calculation-sheet.js';
test('currency totals add visible cents for all and selected calculation rows without changing snapshots',()=>{
 const sheet=emptySheet('cable');Object.assign(sheet.params,{base:'60000',current:'70000'});
 sheet.rows=[['WDZ-BYJ-3*2.5','100'],['YJV-5*10','80'],['YJV-4*25+1*16','60'],['YJV-3*50+2*25','35'],['YJV-3*95+2*50','20']].map(([specification,length])=>({...newCalculationRow(),specification,length}));
 const resolve=row=>resolveCalculation('cable',sheet,row),frozen=snapshotRecord({id:'total-test',name:'汇总验收'},'cable',sheet,sheet.rows[0]),original=JSON.stringify(frozen);
 assert.equal(calculationSummary(sheet.rows,'元',resolve).display,'1,927.41');
 assert.equal(calculationSummary(sheet.rows.slice(0,3),'元',resolve).display,'854.60');
 assert.equal(JSON.stringify(frozen),original);near(frozen.source.result,54.735);
 assert.deepEqual(calculationSummary([1.005,-1.005,null],'元',value=>value===null?{error:'待补全'}:{result:{value}}),{count:2,errors:1,display:'0.00'});
 assert.equal(calculationSummary([1e15,1e15,.01],'元',value=>({result:{value}})).display,'2,000,000,000,000,000.01');
 assert.equal(calculationSummary([],'元',resolve).display,'0.00');
});
