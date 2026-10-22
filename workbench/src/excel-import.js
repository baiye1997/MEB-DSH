import workerSource from '../lib/excel-worker.html';
export {MAX_IMPORT_BYTES,MAX_IMPORT_ROWS,MAX_IMPORT_COLUMNS,parseDelimited} from './excel-import-format.js';
import {MAX_IMPORT_BYTES} from './excel-import-format.js';

export function importExcelWorkbook(buffer,format='xlsx'){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
  let worker,timer;
  const finish=(error,value)=>{clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);error?reject(error):resolve(value);};
  try{
   worker=new Worker(url);
   timer=setTimeout(()=>finish(Error('Excel 解析超时，请缩小文件后重试。')),60000);
   worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data.sheets);
   worker.onerror=()=>finish(Error('Excel 解析线程未能运行，请重新打开工作台后重试。'));
   worker.postMessage({kind:'import',format,buffer},[buffer]);
  }catch(error){finish(error);}
 });
}
