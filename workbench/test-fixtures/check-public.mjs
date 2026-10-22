import {readFile,lstat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../../',import.meta.url));
// Fixed synthetic fixtures exercise old Excel formats; no arbitrary business workbook is allowed.
const fixtures=new Map([
 ['workbench/test-fixtures/import.xls','4deaf2bca813b8ce82034d8ad15f58be6480b786ea6261f413f5869e70d08fae'],
 ['workbench/test-fixtures/import.xlsx','2754fa8ef3438a54de1f64dc9c3241348bef19978f6d9aa6883e27040e18e024'],
]);
const findings=[];
const candidates=new Set(execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean));
for(const name of candidates){
 const path=resolve(root,name),stat=await lstat(path).catch(()=>null);
 if(!stat)continue;
 if(stat.isSymbolicLink()){findings.push(name+': unexpected symlink');continue;}
 const bytes=await readFile(path);
 if(fixtures.has(name)){
  if(createHash('sha256').update(bytes).digest('hex')!==fixtures.get(name))findings.push(name+': synthetic fixture changed; re-audit before allowing it');
  continue;
 }
 if(/\.(?:dwg|dxf|pdf|xlsx|xls|docx|zip|tgz|bundle|pyc)$/i.test(name))findings.push(name+': data/archive format must not be committed');
 if(/\.(?:png|jpe?g|woff2?|ttf|ico)$/i.test(name))continue;
 const text=bytes.toString('utf8');
 if(/\/Users\/|\/home\/|[A-Z]:\\Users\\/.test(text))findings.push(name+': personal home-directory path');
 if(/(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{40,}|sk-[A-Za-z0-9]{24,})/.test(text))findings.push(name+': credential-like value');
 if(new RegExp('-----BEGIN '+'(?:RSA |EC |OPENSSH )?PRIVATE KEY-----').test(text))findings.push(name+': private key');
}
if(findings.length)throw Error('Public source check failed:\n'+findings.join('\n'));
console.log(`Public source check passed (${candidates.size} files); synthetic workbook hashes verified.`);
