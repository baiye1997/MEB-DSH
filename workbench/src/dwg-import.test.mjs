import assert from 'node:assert/strict';
import test from 'node:test';
import childProcess from 'node:child_process';
import {EventEmitter} from 'node:events';
import {syncBuiltinESMExports} from 'node:module';
import {mkdtemp,writeFile,readFile,stat,rm,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectDwgUpload,renderDwgReviewEvidence} from './dwg-import.js';

test('DWG parsing and evidence use the selected Python and clean temporary files',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'meb-cad-runtime-'));
 const python=join(dir,'python'),converter=join(dir,'dwg2dxf'),log=join(dir,'calls.jsonl');
 const previous={PATH:process.env.PATH,MEB_PYTHON:process.env.MEB_PYTHON};
 try{
  const header=`#!${process.execPath}\nconst fs=require('node:fs');const args=process.argv.slice(2);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({tool:process.argv[1],args})+'\\n');\n`;
  await writeFile(python,header+`if(args[0]==='-c')process.exit(0);
fs.accessSync(args[1]);
if(args[0].endsWith('dwg-extract.py'))console.log(JSON.stringify({units:'m',candidates:[]}));
else if(args[0].endsWith('dwg-evidence.py'))console.log(JSON.stringify({candidateNumbers:JSON.parse(args[2]),pages:['<svg/>']}));
else process.exit(1);
`,{mode:0o700});
  await writeFile(converter,header+`fs.writeFileSync(args[1],'synthetic DXF');\n`,{mode:0o700});
  process.env.MEB_PYTHON=python;process.env.PATH=dir;
  const bytes=Buffer.from('AC1032 synthetic DWG');
  const payload={name:'示例平面.dwg',base64:bytes.toString('base64')};
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const parsed=await inspectDwgUpload(payload);
  assert.equal(parsed.units,'m');assert.equal(parsed.drawingUse,'plan');
  assert.deepEqual(parsed.source,{name:payload.name,sha256});
  const evidence=await renderDwgReviewEvidence({...payload,sourceSha256:sha256,candidateNumbers:[1]});
  assert.deepEqual(evidence.pages,['<svg/>']);assert.equal(evidence.sourceSha256,sha256);
  const calls=(await readFile(log,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(calls.filter(call=>call.tool===python&&call.args[0]!=='-c').length,2);
  for(const call of calls.filter(call=>call.tool===converter))await assert.rejects(stat(call.args[1]),{code:'ENOENT'});
  await rename(converter,converter+'.disabled');
  const missing=t.mock.method(childProcess,'spawn',()=>{const child=new EventEmitter();queueMicrotask(()=>child.emit('error',Object.assign(Error('missing converter'),{code:'ENOENT'})));return child;});
  syncBuiltinESMExports();
  try{
   await assert.rejects(inspectDwgUpload(payload),/缺少 CAD 解析环境/);
   assert.deepEqual(missing.mock.calls.map(call=>call.arguments[0]),process.platform==='darwin'?['dwg2dxf','/opt/homebrew/bin/dwg2dxf','/usr/local/bin/dwg2dxf']:['dwg2dxf']);
  }finally{missing.mock.restore();syncBuiltinESMExports();}
 }finally{
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await rm(dir,{recursive:true,force:true});
 }
});
