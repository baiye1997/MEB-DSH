import {ledgerBook} from './model.js';
export function businessWorksheets(project,kind){return [{id:'',kind,name:'工作表 1'},...(project.businessWorksheets||[]).filter(s=>s.kind===kind)].map(({id,kind,name})=>({id,kind,name}));}
export function addBusinessWorksheet(project,kind,name,id=crypto.randomUUID()){
 name=String(name).trim();if(!name||name.length>60)throw Error('工作表名称须为1至60个字');
 if(!['receipt','change','output','contract','calculation'].includes(kind))throw Error('台账类型无效');
 if((project.businessWorksheets?.length||0)>=100)throw Error('一个项目最多100张附加工作表');
 if(businessWorksheets(project,kind).some(s=>s.name===name)||project.businessWorksheets?.some(s=>s.id===id))throw Error('工作表名称或编号已存在');
 const base=ledgerBook(project,kind),sheet={id,kind,name,columns:structuredClone(base.columns),rows:[],views:[]};
 // Column definitions travel to the new empty sheet; records, row formats and views do not.
 project.businessWorksheets??=[];project.businessWorksheets.push(sheet);return sheet;
}
export function renameBusinessWorksheet(project,kind,id,name){name=String(name).trim();const sheet=project.businessWorksheets?.find(s=>s.id===id&&s.kind===kind);if(!sheet)throw Error('工作表不存在');if(!name||name.length>60||businessWorksheets(project,kind).some(s=>s.id!==id&&s.name===name))throw Error('工作表名称为空、过长或重复');sheet.name=name;}
export function businessRows(project,kind){return [...(kind==='receipt'?project.rows:project.ledgers?.[kind]?.rows)||[],...(project.businessWorksheets||[]).filter(s=>s.kind===kind).flatMap(s=>s.rows)];}
