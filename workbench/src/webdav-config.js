import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {webDavUrl} from './webdav-sync.js';

const dir=join(homedir(),'.dsh'),file=join(dir,'meb-webdav-sync.json');
const service='meb-workbench-webdav';
const account=(url,username)=>createHash('sha256').update(url+'\0'+username).digest('hex');

function keychain(args,input){
 return new Promise((resolve,reject)=>{
  const child=spawn('/usr/bin/security',args,{stdio:['pipe','pipe','pipe']});
  let out='';child.stdout.setEncoding('utf8');
  child.stdout.on('data',x=>out+=x);child.stderr.resume();
  const timer=setTimeout(()=>child.kill(),15000);
  child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);code===0?resolve(out.replace(/\r?\n$/,'')):reject(Error('macOS 钥匙串操作失败（'+code+'）'));});
  child.stdin.end(input||'');
 });
}

async function writeSettings(value){
 await mkdir(dir,{recursive:true,mode:0o700});
 const temp=file+'.tmp-'+process.pid;
 try{await writeFile(temp,JSON.stringify(value),{mode:0o600,flag:'wx'});await rename(temp,file);}catch(e){await rm(temp,{force:true});throw e;}
}

export async function loadWebDavSettings(){
 try{
  const value=JSON.parse(await readFile(file,'utf8'));
  if(!value?.url||!value?.username)return null;
  value.url=webDavUrl(value.url);
  if(process.platform!=='darwin')throw Error('当前版本的自动同步凭据存储需要 macOS 钥匙串');
  const password=await keychain(['find-generic-password','-a',account(value.url,value.username),'-s',service,'-w']);
  return {...value,password};
 }catch(e){if(e.code==='ENOENT')return null;throw e;}
}

export async function saveWebDavSettings({url,username,password},previous){
 url=webDavUrl(url);
 if(typeof username!=='string'||!username.trim()||/[:\r\n]/.test(username)||typeof password!=='string'||!password||/[\r\n]/.test(password))throw Error('请填写有效的 WebDAV 用户名和应用密码');
 if(process.platform!=='darwin')throw Error('当前版本的自动同步凭据存储需要 macOS 钥匙串');
 const id=account(url,username);
 await keychain(['add-generic-password','-a',id,'-s',service,'-U','-w'],password+'\n'+password+'\n');
 const value={url,username,baseHash:previous?.url===url&&previous?.username===username?previous.baseHash:null};
 await writeSettings(value);
 return {...value,password};
}

export async function updateWebDavBase(settings,hash){
 settings.baseHash=hash;
 await writeSettings({url:settings.url,username:settings.username,baseHash:hash});
}

export async function removeWebDavSettings(settings){
 await rm(file,{force:true});
 if(settings&&process.platform==='darwin')try{await keychain(['delete-generic-password','-a',account(settings.url,settings.username),'-s',service]);}catch{}
}
