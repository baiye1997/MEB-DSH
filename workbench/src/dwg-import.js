import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {MAX_DWG_UPLOAD_BYTES} from './dwg-limits.js';

const run=promisify(execFile);
const bundledPython=resolve(fileURLToPath(new URL('../.venv/bin/python',import.meta.url)));
const extractor=fileURLToPath(new URL('./dwg-extract.py',import.meta.url));
const evidenceRenderer=fileURLToPath(new URL('./dwg-evidence.py',import.meta.url));
const conversionError='DWG 转换失败；请核对图纸版本或改用可读取的原文件';
const cadEnvironmentError='缺少 CAD 解析环境；请安装 LibreDWG 的 dwg2dxf，并让 Python 环境可导入 ezdxf（可用 MEB_PYTHON 指定 Python 路径）';

async function findPython(){
 const candidates=[process.env.MEB_PYTHON,bundledPython,join(homedir(),'.local/share/meb-cad/bin/python'),'python3','python'].filter(Boolean);
 for(const candidate of candidates)try{await run(candidate,['-c','import ezdxf'],{timeout:10000});return candidate;}catch{}
 throw Error(cadEnvironmentError);
}

async function convertDwg(dwg,dxf){
 // Finder-launched macOS apps may only inherit the system PATH.
 const converters=process.platform==='darwin'?['dwg2dxf','/opt/homebrew/bin/dwg2dxf','/usr/local/bin/dwg2dxf']:['dwg2dxf'];
 for(const converter of converters){
  try{
   await new Promise((resolve,reject)=>{
    // LibreDWG can print megabytes of harmless notices for large nested blocks.
    // Buffering stdout/stderr can reject a successful conversion before extraction.
    const child=spawn(converter,['-o',dxf,dwg],{stdio:'ignore',timeout:45000});
    child.once('error',reject);
    child.once('close',code=>code===0?resolve():reject(Error(conversionError)));
   });
   return;
  }catch(error){if(error.code!=='ENOENT')throw Error(conversionError);}
 }
 throw Error(cadEnvironmentError);
}

function uploadBytes(payload){
 const name=payload?.name;
 if(typeof name!=='string'||!name.toLowerCase().endsWith('.dwg')||name.length>255)throw Error('请选择 DWG 图纸');
 if(typeof payload.base64!=='string'||payload.base64.length>Math.ceil(MAX_DWG_UPLOAD_BYTES/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(payload.base64))throw Error('DWG 超过 25 MB 或文件格式无效');
 const bytes=Buffer.from(payload.base64,'base64');
 if(!bytes.length||bytes.length>MAX_DWG_UPLOAD_BYTES||!/^AC10/.test(bytes.subarray(0,6).toString('ascii')))throw Error('文件不是受支持的 DWG，或超过 25 MB');
 return {name,bytes,sha256:createHash('sha256').update(bytes).digest('hex')};
}

async function withConvertedDwg(bytes,job){
 const python=await findPython();
 const dir=await mkdtemp(join(tmpdir(),'meb-dwg-'));
 try{
  const dwg=join(dir,'source.dwg'),dxf=join(dir,'converted.dxf');await writeFile(dwg,bytes,{flag:'wx'});
  await convertDwg(dwg,dxf);
  return await job(dxf,python);
 }finally{await rm(dir,{recursive:true,force:true});}
}

export async function inspectDwgUpload(payload){
 const {name,bytes,sha256}=uploadBytes(payload);
 return withConvertedDwg(bytes,async(dxf,python)=>{
  const {stdout}=await run(python,[extractor,dxf],{timeout:45000,maxBuffer:12*1024*1024});
  const result=JSON.parse(stdout);
  const drawingUse=/立面|剖面|立剖|节点|详图|大样|楼梯|门窗|目录|设计说明|做法表|\b(?:elev|section|detail)\b/i.test(name)?'reference':'plan';
  return {...result,drawingUse,source:{name,sha256}};
 });
}

export async function renderDwgReviewEvidence(payload){
 const {name,bytes,sha256}=uploadBytes(payload);
 if(payload.sourceSha256!==sha256)throw Error('当前图纸与候选列表来源不一致，请重新上传');
 const numbers=payload.candidateNumbers;
 if(!Array.isArray(numbers)||!numbers.length||numbers.length>24||new Set(numbers).size!==numbers.length||numbers.some(n=>!Number.isInteger(n)||n<1||n>200))throw Error('请筛选 1–24 个候选轮廓生成审图板');
 return withConvertedDwg(bytes,async(dxf,python)=>{
  const {stdout}=await run(python,[evidenceRenderer,dxf,JSON.stringify(numbers),name],{timeout:60000,maxBuffer:16*1024*1024});
  const rendered=JSON.parse(stdout);
  if(rendered.pages?.length>4||rendered.pages?.some(page=>page.length>4*1024*1024))throw Error('审图板内容过大，请缩小候选范围');
  return {sourceSha256:sha256,...rendered};
 });
}
