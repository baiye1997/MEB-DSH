import workerSource from '../lib/excel-worker.html';
// Parsing the export library, formatting cells and ZIP compression run off the UI thread.
export function exportLedgerExcel(payload){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(new Blob([workerSource],{type:'text/javascript'}));
  let worker,timer;
  const finish=(error,value)=>{clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);error?reject(error):resolve(value);};
  try{
   worker=new Worker(url);
   timer=setTimeout(()=>finish(Error('导出超时，请缩小筛选范围后重试。')),180000);
   worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data.base64);
   worker.onerror=()=>finish(Error('Excel 导出线程未能运行，请重新打开工作台后重试。'));
   worker.postMessage(payload);
  }catch(error){finish(error);}
 });
}
