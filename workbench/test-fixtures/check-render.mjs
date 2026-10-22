import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const directory=await mkdtemp(join(tmpdir(),'meb-render-'));
try{
 const outfile=join(directory,'check.mjs');
 await build({entryPoints:['test-fixtures/check-custom-render.jsx'],outfile,bundle:true,platform:'node',format:'esm',loader:{'.css':'text'},banner:{js:"import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"}});
 await import(pathToFileURL(outfile));
}finally{await rm(directory,{recursive:true,force:true});}
