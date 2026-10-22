import ExcelJS from 'exceljs';
import {createLedgerWorkbook} from './excel-workbook.js';
import {parseLegacyWorkbook} from './excel-import-xls.js';
const MAX_IMPORT_BYTES=20_000_000,MAX_IMPORT_ROWS=20_000,MAX_IMPORT_COLUMNS=200,MAX_IMPORT_TEXT_BYTES=40_000_000;
const cellText=value=>{
 if(value===null||value===undefined)return '';
 if(value instanceof Date)return value.toISOString().slice(0,10);
 if(typeof value==='object'){
  if('result' in value)return cellText(value.result);
  if(Array.isArray(value.richText))return value.richText.map(part=>part.text||'').join('');
  if('text' in value)return String(value.text||'');
 }
 return String(value);
};
async function importWorkbook(buffer,format='xlsx'){
 if(buffer.byteLength>MAX_IMPORT_BYTES)throw Error(`导入表格不得超过 ${MAX_IMPORT_BYTES/1000000} MB`);
 if(format==='xls')return parseLegacyWorkbook(buffer);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(buffer);
 return workbook.worksheets.map(sheet=>{
  if(sheet.rowCount>MAX_IMPORT_ROWS)throw Error(`导入表格最多支持 ${MAX_IMPORT_ROWS} 行`);
  if(sheet.columnCount>MAX_IMPORT_COLUMNS)throw Error(`导入表格最多支持 ${MAX_IMPORT_COLUMNS} 列`);
  const matrix=[];let textBytes=0;sheet.eachRow({includeEmpty:true},row=>{const values=Array.from({length:sheet.columnCount},(_,i)=>cellText(row.getCell(i+1).value));textBytes+=values.reduce((n,value)=>n+value.length*2,0);if(textBytes>MAX_IMPORT_TEXT_BYTES)throw Error('导入表格展开后超过 40 MB，请缩小文件后重试');matrix.push(values);});
  return {name:sheet.name,matrix};
 });
}
self.onmessage=async({data})=>{
 try{
  if(data.kind==='import'){self.postMessage({sheets:await importWorkbook(data.buffer,data.format)});return;}
  const bytes=new Uint8Array(await createLedgerWorkbook(data));
  const chunks=[];for(let i=0;i<bytes.length;i+=24576)chunks.push(String.fromCharCode(...bytes.subarray(i,i+24576)));
  self.postMessage({base64:btoa(chunks.join(''))});
 }catch(error){self.postMessage({error:error.message||'无法生成 Excel'});}
};
