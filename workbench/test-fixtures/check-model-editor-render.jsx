import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import assert from 'node:assert/strict';
import ModelEditor,{parseModelNumber,validateModelNumberInput} from '../src/model-editor.jsx';

const coordinate={min:-1000,max:1000};
for(const value of ['', ' ', '-', '+', '.', '-.', '1e', 'Infinity', 'NaN', '0x10'])assert.equal(parseModelNumber(value,coordinate),null,`${value} is an unfinished or invalid numeric draft`);
assert.equal(parseModelNumber('-12.5',coordinate),-12.5);
assert.equal(parseModelNumber('0',coordinate),0);
assert.equal(parseModelNumber('1000',coordinate),1000);
assert.equal(parseModelNumber('-1000',coordinate),-1000);
assert.equal(parseModelNumber('-1000.01',coordinate),null);
assert.equal(parseModelNumber('6',{min:1,max:60,integer:true}),6);
for(const value of ['0','61','1.5'])assert.equal(parseModelNumber(value,{min:1,max:60,integer:true}),null);
assert.equal(parseModelNumber('3.65',{min:1,max:20}),3.65);
assert.equal(parseModelNumber('20.01',{min:1,max:20}),null);
const numericInput={value:'99999',validationMessage:'',setCustomValidity(message){this.validationMessage=message;}};
assert.equal(validateModelNumberInput(numericInput,{...coordinate,label:'X 位置'}),null);
assert.equal(numericInput.value,'99999','Rejected drafts stay visible instead of silently reverting to the saved coordinate');
assert.match(numericInput.validationMessage,/X 位置需填写 -1000–1000/,'Native validity blocks generation until the draft is corrected');
for(const draft of ['-','-.','']){
 numericInput.value=draft;
 assert.equal(validateModelNumberInput(numericInput,{...coordinate,label:'X 位置'}),null);
 assert.equal(numericInput.value,draft);
 assert.ok(numericInput.validationMessage);
}
numericInput.value='-12.5';
assert.equal(validateModelNumberInput(numericInput,{...coordinate,label:'X 位置'}),-12.5);
assert.equal(numericInput.validationMessage,'','Correcting an invalid draft allows a normal retry');
const project={id:'numeric-editor',modelConfig:{mode:'blocks',buildings:[{id:'building',number:'1',name:'输入验收',width:30,depth:18,x:-12.5,y:0,heights:[3.6,3.6]}]}};
const markup=renderToStaticMarkup(<ModelEditor project={project} cad={{buildings:[],site:[]}} busy onGenerate={()=>{}}/>);
assert.match(markup,/<input[^>]*type="text"[^>]*inputMode="decimal"[^>]*aria-label="X 位置"[^>]*value="-12.5"/);
assert.match(markup,/<input[^>]*type="text"[^>]*inputMode="numeric"[^>]*aria-label="楼层数"[^>]*value="2"/);
assert.match(markup,/<input[^>]*disabled=""[^>]*aria-label="1栋 1层层高"/);
assert.doesNotMatch(markup,/type="number"/,'Model controls must preserve text drafts while editing');
console.log('Model numeric drafts preserve invalid edits, expose native validity, recover after correction, and retain model bounds.');
