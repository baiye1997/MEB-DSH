import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('isolated DSH homes use separate settings and credentials without touching the default home',async()=>{
 const root=await mkdtemp(join(tmpdir(),'meb-webdav-config-'));
 try{
  const script=`
   import assert from 'node:assert/strict';
   import {mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
   import {join} from 'node:path';
   import {homedir} from 'node:os';
   import {createHash} from 'node:crypto';
   import {loadWebDavSettings,updateWebDavBase,removeWebDavSettings,webDavCredentialAccount} from ${JSON.stringify(new URL('./webdav-config.js',import.meta.url).href)};
   const a=process.env.DSH_HOME,b=a+'-other',name='meb-webdav-sync.json';
   await mkdir(a,{recursive:true});await mkdir(b,{recursive:true});
   await writeFile(join(a,name),JSON.stringify({url:'invalid-test-address',username:'synthetic'}));
   await writeFile(join(b,name),'other-home-sentinel');
   await assert.rejects(loadWebDavSettings());
   const settings={url:'https://example.com/dav/workspace.json',username:'synthetic',baseHash:'before'};
   await updateWebDavBase(settings,'after');
   assert.equal(settings.baseHash,'after');assert.equal(JSON.parse(await readFile(join(a,name),'utf8')).baseHash,'after');
   await assert.rejects(access(join(homedir(),'.dsh',name)));
   const legacy=createHash('sha256').update(settings.url+'\\0'+settings.username).digest('hex');
   assert.equal(webDavCredentialAccount(settings.url,settings.username,join(homedir(),'.dsh')),legacy);
   assert.notEqual(webDavCredentialAccount(settings.url,settings.username),legacy);
   assert.notEqual(webDavCredentialAccount(settings.url,settings.username),webDavCredentialAccount(settings.url,settings.username,b));
   await removeWebDavSettings(null);
   await assert.rejects(access(join(a,name)));assert.equal(await readFile(join(b,name),'utf8'),'other-home-sentinel');
   await rm(a,{recursive:true});await writeFile(a,'cannot-create-directory');
   await assert.rejects(updateWebDavBase(settings,'not-persisted'));assert.equal(settings.baseHash,'after');
  `;
  const {stderr}=await promisify(execFile)(process.execPath,['--input-type=module','-e',script],{env:{...process.env,HOME:join(root,'home'),DSH_HOME:join(root,'isolated')}});
  assert.equal(stderr,'');
 }finally{await rm(root,{recursive:true,force:true});}
});
