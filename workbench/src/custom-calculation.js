import {z} from 'zod';
import {parseTSV} from './business.js';
const value=z.string().max(20000);
export const customDefinition=z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(100),formula:z.string().min(1).max(2000),unit:z.string().min(1).max(20),precision:z.number().int().min(0).max(8),note:z.string().max(2000).default(''),variables:z.array(z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(30),unit:z.string().max(20),fixed:z.boolean(),value:z.string().max(100)})).max(30)});
export const customSheet=customDefinition.extend({rows:z.array(z.object({id:z.string().min(1).max(100),name:z.string().max(200),values:z.record(z.string(),z.string().max(100)),note:z.string().max(2000).default('')})).max(20000)});
const functions={最小值:Math.min,最大值:Math.max,绝对值:Math.abs,向上取整:Math.ceil,向下取整:Math.floor,四舍五入:(n,d=0)=>{if(!Number.isInteger(d)||d<0||d>8)throw Error('小数位数须为0至8');return Number(n.toFixed(d));}};
const identifier=/^[\p{L}_][\p{L}\p{N}_]*$/u;
export function numeric(raw,label){const text=String(raw??'').trim().replace(/[，,]/g,'');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)||!Number.isFinite(Number(text)))throw Error('请填写有效的'+label);return Number(text);}
// Arithmetic grammar only. No eval, property access, or executable user code.
export function evaluateFormula(formula,values,{syntaxOnly=false}={}){
 const text=formula.normalize('NFKC').replace(/[×]/g,'*').replace(/÷/g,'/').replace(/−/g,'-');
 if(text.length>2000)throw Error('公式过长');
 const tokens=[];let offset=0;
 while(offset<text.length){const rest=text.slice(offset),m=rest.match(/^(\s+|(?:\d+(?:\.\d*)?|\.\d+)|[\p{L}_][\p{L}\p{N}_]*|[+\-*/^()% ,])/u);if(!m)throw Error('公式含不支持的符号：'+rest[0]);if(m[0].trim())tokens.push(m[0]);offset+=m[0].length;if(tokens.length>256)throw Error('公式过长，请拆分计算');}
 let at=0;const used=new Set(),take=()=>tokens[at++],peek=()=>tokens[at];
 const finite=n=>{if(!syntaxOnly&&!Number.isFinite(n))throw Error('计算结果超出范围');return syntaxOnly?1:n;};
 function atom(){let t=take(),n;if(t==='('){n=expression();if(take()!==')')throw Error('请检查公式括号');}else if(t&&/^(?:\d|\.)/.test(t)){n=Number(t);}else if(t&&identifier.test(t)){
  if(peek()==='('){if(!Object.hasOwn(functions,t))throw Error('不支持的函数：'+t);take();const args=[expression()];while(peek()===','){take();args.push(expression());}if(take()!==')')throw Error('请检查函数括号');if((['最小值','最大值'].includes(t)?args.length<1:t==='四舍五入'?args.length<1||args.length>2:args.length!==1))throw Error(t+'的参数数量不正确');n=syntaxOnly?1:functions[t](...args);}
  else{if(!Object.hasOwn(values,t))throw Error('公式中未定义：'+t);used.add(t);n=values[t];}
 }else throw Error('请补全公式中的数字或参数');
 while(peek()==='%'){take();n/=100;}return finite(n);}
 function power(){let n=atom();if(peek()==='^'){take();n=finite(n**unary());}return n;}
 function unary(){if(peek()==='+'){take();return unary();}if(peek()==='-'){take();return -unary();}return power();}
 function product(){let n=unary();while(['*','/'].includes(peek())){const op=take(),r=unary();if(!syntaxOnly&&op==='/'&&r===0)throw Error('除数不能为零');n=finite(op==='*'?n*r:n/r);}return n;}
 function expression(){let n=product();while(['+','-'].includes(peek())){const op=take(),r=product();n=finite(op==='+'?n+r:n-r);}return n;}
 const result=expression();if(at!==tokens.length)throw Error('参数之间请填写运算符');if(!syntaxOnly&&Math.abs(result)>1e15)throw Error('计算结果超出范围');
 return {value:result,used:[...used],expression:tokens.map(t=>Object.hasOwn(values,t)&&used.has(t)?`(${values[t]})`:t).join(' ')};
}
export function validateRule(input){
 const rule=customDefinition.parse(input),names=new Set(),ids=new Set();
 for(const v of rule.variables){if(!identifier.test(v.name)||Object.hasOwn(functions,v.name))throw Error('参数名使用中文、字母或数字，不能以数字开头或与函数同名');if(['name','note'].includes(v.id))throw Error('参数编号无效');if(names.has(v.name)||ids.has(v.id))throw Error('参数不能重名');names.add(v.name);ids.add(v.id);if(v.fixed)numeric(v.value,v.name);}
 evaluateFormula(rule.formula,Object.fromEntries(rule.variables.map(v=>[v.name,1])),{syntaxOnly:true});return rule;
}
export function resolveCustom(rule,row,definition=validateRule(rule)){
 const values=Object.fromEntries(definition.variables.map(v=>[v.name,numeric(v.fixed?v.value:row.values[v.id],v.name)]));
 const result=evaluateFormula(definition.formula,values);return {...result,display:result.value.toFixed(definition.precision),unit:definition.unit,values,definition,signature:JSON.stringify({definition,values,name:row.name,note:row.note})};
}
export function customSnapshot(project,rule,row){
 const r=resolveCustom(rule,row),time=new Date().toISOString();
 return {id:crypto.randomUUID(),cells:{title:row.name||rule.name,date:new Date().toLocaleDateString('sv-SE'),description:rule.name,specification:rule.formula,unit:rule.unit,quantity:rule.unit==='元'?'':r.display,amount:rule.unit==='元'?r.display:'',reported:r.display,remarks:row.note||'',status:'草稿'},files:[],notes:rule.note||'用户自定义计算规则',source:{projectId:project.id,projectName:project.name,targetProjectId:project.id,targetProjectName:project.name,sheetId:'custom',rowId:row.id,ruleId:rule.id,customRule:r.definition,expression:r.expression,specification:rule.formula,formulaVersion:'custom-1',capturedAt:time,inputs:Object.fromEntries(Object.entries(r.values).map(([k,v])=>[k,String(v)])),mode:'custom',signature:r.signature,result:r.value,unit:rule.unit,formula:rule.formula,workbook:rule.note||'用户自定义计算规则'}};
}
export function pasteCustomRows(rule,rowId,key,text,visibleRows=rule.rows){
 const keys=['name',...rule.variables.filter(v=>!v.fixed).map(v=>v.id),'note'],start=keys.indexOf(key),index=visibleRows.findIndex(r=>r.id===rowId),matrix=parseTSV(text);
 if(start<0||index<0||!matrix.length)throw Error('请重新选择粘贴位置');if(matrix.some(r=>r.length>keys.length-start))throw Error('粘贴列数超出当前输入区域；结果列由公式计算');
 const rows=structuredClone(rule.rows),byId=new Map(rows.map(r=>[r.id,r]));
 for(const [i,cells] of matrix.entries()){let row=byId.get(visibleRows[index+i]?.id);if(!row){row={id:crypto.randomUUID(),name:'',values:{},note:''};rows.push(row);}for(const [j,v] of cells.entries()){const field=keys[start+j];if(field==='name'||field==='note')row[field]=v;else row.values[field]=v.trim().replace(/[，,]/g,'');}}
 if(rows.length>20000)throw Error('每张计算表最多20000行');return rows;
}

function scaledDisplay(sum,precision){const negative=sum<0n,digits=(negative?-sum:sum).toString().padStart(precision+1,'0');return (negative?'-':'')+(precision?digits.slice(0,-precision)+'.'+digits.slice(-precision):digits);}
export function customTotal(results,precision){
 const valid=results.filter(r=>!r.error),sum=valid.reduce((total,r)=>total+BigInt(r.display.replace('.','')),0n);
 return {count:valid.length,display:scaledDisplay(sum,precision)};
}
export function customSummary(rows,precision,resolve){let count=0,errors=0,sum=0n;for(const row of rows){const result=resolve(row);if(result.error){errors++;continue;}count++;sum+=BigInt(result.display.replace('.',''));}return {count,errors,display:scaledDisplay(sum,precision)};}
