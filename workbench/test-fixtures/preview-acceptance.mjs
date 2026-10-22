// Isolated browser acceptance. All workbench requests are handled by the fixture.
import {build} from 'esbuild';
import {createServer} from 'node:http';
const result=await build({entryPoints:['test-fixtures/assistant-acceptance.jsx'],bundle:true,write:false,format:'iife',loader:{'.css':'text','.html':'text'}});
const script=result.outputFiles[0].contents;
const page='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MEB 隔离验收</title><style>html,body,#root{height:100%;overflow:hidden}body{margin:0}</style><div id="root"></div><script src="/app.js"></script></html>';
const port=Number(process.env.MEB_ACCEPTANCE_PORT||4187);
createServer((request,response)=>{
 const path=new URL(request.url,'http://127.0.0.1').pathname;
 if(!['/','/app.js'].includes(path)){response.writeHead(404);response.end();return;}
 response.writeHead(200,{'Content-Type':path==='/app.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-store'});
 response.end(path==='/app.js'?script:page);
}).listen(port,'127.0.0.1',()=>console.log(`Isolated acceptance: http://127.0.0.1:${port}/ (5000 rows: /?rows=5000)`));
