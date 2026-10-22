import {homedir} from 'node:os';
import {stat,realpath,readdir} from 'node:fs/promises';
import {isAbsolute,basename,extname,dirname,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function inspectReference(path){
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))throw Error('请填写本机文件的完整路径');
 let resolved,info;try{resolved=await realpath(path);info=await stat(resolved);}catch(error){if(['ENOENT','ENOTDIR'].includes(error.code))throw Error('原文件已移动或不存在，请在附件库重新定位');if(['EACCES','EPERM'].includes(error.code))throw Error('没有读取原文件的权限，请检查文件访问权限');throw Error('暂时无法读取原文件，请稍后重试');}if(!info.isFile())throw Error('请选择文件，不是文件夹');
 return {path:resolved,name:basename(resolved),size:info.size,modifiedAt:info.mtime.toISOString(),kind:'reference',mime:'application/octet-stream',data:''};
}
export async function openReference(path){
 const file=await inspectReference(path);
 if(!['.pdf','.xlsx','.xls','.csv','.tsv','.doc','.docx','.ppt','.pptx','.png','.jpg','.jpeg','.webp','.txt','.dwg','.dxf'].includes(extname(file.path).toLowerCase()))throw Error('此类型请复制路径后自行打开');
 if(process.platform!=='darwin')throw Error('当前仅支持在 Mac 上打开原文件，请复制路径');
 await run('/usr/bin/open',[file.path]);return true;
}

export async function listReferenceDirectory(path=homedir()){
 if(typeof path!=='string'||!isAbsolute(path)||path.includes('\0'))throw Error('文件夹路径无效');
 const resolved=await realpath(path);
 const entries=(await readdir(resolved,{withFileTypes:true})).filter(e=>!e.name.startsWith('.')&&(e.isDirectory()||e.isFile())).sort((a,b)=>Number(b.isDirectory())-Number(a.isDirectory())||a.name.localeCompare(b.name,'zh-CN'));
 return {path:resolved,parent:dirname(resolved),entries:entries.map(e=>({name:e.name,path:join(resolved,e.name),directory:e.isDirectory()}))};
}
