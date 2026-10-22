import test from 'node:test';
import assert from 'node:assert/strict';
import {WebDavSync,mergeReferencePaths,syncSnapshot,webDavUrl} from './webdav-sync.js';
import {readBoundedText} from './bounded-text.js';

test('WebDAV sync uploads, pulls, and stops divergent writes',async()=>{
 let local={version:1,revision:1,projects:[{id:'a'}]},remote=null,etag=0,baseHash;
 const config=()=>({url:'https://example.test/meb.json',username:'u',password:'p',baseHash});
 const request=async(_url,options)=>{
  if(options.method==='GET')return remote===null?new Response('',{status:404}):new Response(JSON.stringify(remote),{headers:{etag:'"'+etag+'"'}});
  if(remote===null&&options.headers['If-None-Match']!=='*'||remote!==null&&options.headers['If-Match']!=='"'+etag+'"')return new Response('',{status:412});
  remote=JSON.parse(options.body);etag++;return new Response(null,{status:204});
 };
 const sync=new WebDavSync({request,config,readLocal:()=>local,writeLocal:async value=>{local=value;},validate:x=>x,saveBase:async hash=>{baseHash=hash;}});
 assert.equal((await sync.run()).kind,'synced');assert.deepEqual(remote,local);
 local={...local,revision:2};assert.equal((await sync.run()).kind,'synced');assert.equal(remote.revision,2);
 remote={...remote,revision:3};etag++;assert.equal((await sync.run()).kind,'synced');assert.equal(local.revision,3);
 local={...local,revision:4};remote={...remote,revision:5};etag++;
 assert.equal((await sync.run()).kind,'conflict');assert.equal(local.revision,4);assert.equal(remote.revision,5);
});

test('WebDAV requires HTTPS and a strong ETag before replacing a backup',async()=>{
 assert.throws(()=>webDavUrl('http://example.test/meb.json'),/HTTPS/);
 let local={version:1,revision:1},baseHash;
 const remote={...local};
 const request=async(_url,options)=>options.method==='GET'?new Response(JSON.stringify(remote),{headers:{etag:'W/"weak"'}}):new Response(null,{status:204});
 const sync=new WebDavSync({request,config:()=>({url:'https://example.test/meb.json',username:'u',password:'p',baseHash}),readLocal:()=>local,writeLocal:async()=>{},validate:x=>x,saveBase:async hash=>{baseHash=hash;}});
 assert.equal((await sync.run()).kind,'error');local={...local,revision:2};
 const result=await sync.run();assert.equal(result.kind,'error');assert.match(result.message,/强 ETag/);
});

test('an existing different backup needs an explicit choice and offline leaves local data intact',async()=>{
 let local={version:1,revision:2},written=false;
 const sync=new WebDavSync({request:async()=>new Response(JSON.stringify({version:1,revision:3}),{headers:{etag:'"3"'}}),config:()=>({url:'https://example.test/meb.json',username:'u',password:'p'}),readLocal:()=>local,writeLocal:async()=>{written=true;},validate:x=>x,saveBase:async()=>{}});
 assert.equal((await sync.run()).kind,'conflict');assert.equal(written,false);assert.equal(local.revision,2);
 sync.request=async()=>{throw Error('offline');};assert.equal((await sync.run()).kind,'error');assert.equal(local.revision,2);
});

test('a pull cannot overwrite a local save made while WebDAV was being read',async()=>{
 let local={version:1,revision:1},baseHash;
 const first=new WebDavSync({request:async()=>new Response(JSON.stringify(local),{headers:{etag:'"1"'}}),config:()=>({url:'https://example.test/meb.json',username:'u',password:'p',baseHash}),readLocal:()=>local,writeLocal:async()=>{},validate:x=>x,saveBase:async hash=>{baseHash=hash;}});
 await first.run();
 const sync=new WebDavSync({request:async()=>{local={version:1,revision:2};return new Response(JSON.stringify({version:1,revision:3}),{headers:{etag:'"3"'}});},config:()=>({url:'https://example.test/meb.json',username:'u',password:'p',baseHash}),readLocal:()=>local,writeLocal:async(_remote,expected)=>{if(local!==expected)throw Error('本机在同步期间已修改');},validate:x=>x,saveBase:async()=>{}});
 const state=await sync.run();assert.equal(state.kind,'error');assert.equal(local.revision,2);
});

test('choosing a remote snapshot rechecks it before replacing local data',async()=>{
 let local={version:1,revision:1},remote={version:1,revision:2},gets=0;
 const sync=new WebDavSync({request:async(_url,options)=>{
  assert.equal(options.method,'GET');gets++;
  return new Response(JSON.stringify(remote),{headers:{etag:'"'+remote.revision+'"'}});
 },config:()=>({url:'https://example.test/meb.json',username:'u',password:'p'}),readLocal:()=>local,writeLocal:async value=>{local=value;},validate:x=>x,saveBase:async()=>{}});
 await assert.rejects(()=>sync.useRemote(async()=>{remote={version:1,revision:3};}),/远端在选择期间已更新/);
 assert.equal(gets,2);assert.equal(local.revision,1);
});

test('WebDAV snapshots omit local reference paths and restore matching local paths on pull',async()=>{
 const local={version:1,revision:1,files:[{id:'f',projectId:'p',kind:'reference',path:'/tmp/meb-test/secret.pdf',name:'secret.pdf',mime:'application/pdf',size:1,data:'',createdAt:'x'}],projects:[{id:'p'}]};
 let remote=null,uploaded='';
 const request=async(_url,options)=>{
  if(options.method==='GET')return remote?new Response(JSON.stringify(remote),{headers:{etag:'"1"'}}):new Response('',{status:404});
  uploaded=options.body;remote=JSON.parse(uploaded);return new Response(null,{status:204});
 };
 const sync=new WebDavSync({request,config:()=>({url:'https://example.test/meb.json',username:'u',password:'p'}),readLocal:()=>local,writeLocal:async()=>{},validate:x=>x,saveBase:async()=>{}});
 assert.equal((await sync.run()).kind,'synced');assert.equal(uploaded.includes('/tmp/meb-test/secret.pdf'),false);assert.equal(remote.files[0].path,undefined);
 assert.equal(mergeReferencePaths(remote,local).files[0].path,'/tmp/meb-test/secret.pdf');
});

test('WebDAV snapshots strip paths from every attachment kind',()=>{
 const snapshot=syncSnapshot({files:[{id:'copy',kind:'copy',path:'/tmp/meb-test/old-copy.pdf',data:'data:application/pdf;base64,eA=='}]});
 assert.equal(snapshot.files[0].path,undefined);
});

test('bounded text rejects oversized chunked responses before JSON parsing',async()=>{
 const body=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{"x":"1234'));controller.enqueue(new TextEncoder().encode('5678"}'));controller.close();}});
 await assert.rejects(readBoundedText(new Response(body),10,'too big'),error=>error.status===413&&error.message==='too big');
 assert.equal(await readBoundedText(new Response('你好'),6,'too big'),'你好');
});
