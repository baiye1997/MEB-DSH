import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';

const run=promisify(execFile);
const manifest=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
assert.equal(manifest.private,undefined,'published package must not be private');
assert.equal(manifest.dsh?.bundle?.patch,'./dsh.bundle.patch');
const {stdout}=await run('npm',['pack','--dry-run','--ignore-scripts','--json'],{encoding:'utf8'});
const packed=JSON.parse(stdout)[0];
const paths=new Set(packed.files.map(file=>file.path));
const expected=['package.json','README.md','THIRD-PARTY-NOTICES.md','LICENSE','dsh.bundle.patch','lib/index.js','lib/client.js','lib/model-embed.html','lib/excel-worker.html','lib/dwg-extract.py','lib/dwg-evidence.py','src/rare-ui/LICENSE','src/rare-ui/README.md','src/daily-intro-font-license.txt'];
assert.deepEqual([...paths].sort(),expected.sort(),'npm package must contain only the reviewed runtime, documentation and license files');
const lock=JSON.parse(await readFile(new URL('../package-lock.json',import.meta.url),'utf8'));
assert.equal(lock.version,manifest.version,'lockfile version must match the package');
assert.equal(lock.packages[''].version,manifest.version,'lockfile root version must match the package');
assert([...paths].every(path=>!/__pycache__|\.pyc$/.test(path)),'npm package contains Python cache files');
for(const file of [...paths].filter(path=>/\.(?:js|html|py|json|md)$/.test(path))){
 const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
 assert(!/\/Users\/|\/home\/|[A-Z]:\\Users\\/.test(source),'package contains a personal build path: '+file);
 assert(!/(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9]{24,})/.test(source),'package contains a credential-like value: '+file);
 for(const marker of ['示例校园','示例楼栋 A','demo-project-','model-viewer/sample-model.json','referenceInputs'])assert(!source.includes(marker),'package must not bundle example project data: '+file);
}
console.log(`Package ${packed.name}@${packed.version}: ${paths.size} files`);
