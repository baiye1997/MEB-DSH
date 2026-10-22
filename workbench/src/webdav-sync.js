import {createHash} from 'node:crypto';
import {readBoundedText} from './bounded-text.js';

const digest=value=>createHash('sha256').update(JSON.stringify(syncSnapshot(value))).digest('hex');

export function syncSnapshot(value){
 const snapshot={...value};
 if(Array.isArray(value?.files))snapshot.files=value.files.map(file=>{
  if(!file||!Object.hasOwn(file,'path'))return file;
  const {path,...safe}=file;return safe;
 });
 return snapshot;
}
export function mergeReferencePaths(remote,current){
 const paths=new Map((current?.files||[]).filter(file=>file?.kind==='reference'&&typeof file.path==='string').map(file=>[file.id,file]));
 return {...remote,files:(remote?.files||[]).map(file=>{const saved=paths.get(file.id);return file?.kind==='reference'&&!file.path&&saved?.projectId===file.projectId&&saved.name===file.name&&saved.size===file.size?{...file,path:saved.path}:file;})};
}

export function webDavUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('WebDAV 地址须使用 HTTPS');
 if(url.username||url.password||url.hash||!url.pathname.endsWith('.json'))throw Error('请填写不含密码、以 .json 结尾的 WebDAV 文件地址');
 return url.toString();
}

export class WebDavSync{
 constructor({request=fetch,readLocal,writeLocal,validate,config,saveBase}){Object.assign(this,{request,readLocal,writeLocal,validate,config,saveBase});this.state={kind:'idle'};}
 async remote(){
  const {url,username,password}=this.config();
  const headers={Authorization:'Basic '+Buffer.from(username+':'+password).toString('base64')};
  const response=await this.request(url,{method:'GET',headers,redirect:'error',signal:AbortSignal.timeout(20000)});
  if(response.status===404)return {missing:true,headers};
  if(!response.ok)throw Error('WebDAV 读取失败（HTTP '+response.status+'）');
  const body=await readBoundedText(response,50000000,'WebDAV 备份超过 50 MB');
  const data=this.validate(syncSnapshot(JSON.parse(body)));
  return {data,hash:digest(data),etag:response.headers.get('etag'),headers};
 }
 async put(data,remote){
  const {url}=this.config(),headers={...remote.headers,'Content-Type':'application/json'};
  const body=JSON.stringify(syncSnapshot(data));
  if(Buffer.byteLength(body)>50000000)throw Error('WebDAV 备份超过 50 MB；请将大附件改为本机引用');
  if(remote.missing)headers['If-None-Match']='*';
  else if(remote.etag&&!remote.etag.startsWith('W/'))headers['If-Match']=remote.etag;
  else throw Error('WebDAV 服务未提供强 ETag，无法安全自动写入');
  const response=await this.request(url,{method:'PUT',headers,body,redirect:'error',signal:AbortSignal.timeout(30000)});
  if(response.status===412)throw Error('远端已由另一台电脑更新，请先核对同步冲突');
  if(!response.ok)throw Error('WebDAV 上传失败（HTTP '+response.status+'）');
  const check=await this.remote();
  if(check.hash!==digest(data))throw Error('WebDAV 上传后校验失败，请检查服务是否支持条件写入');
  await this.saveBase(check.hash);
  this.state=check.etag&&!check.etag.startsWith('W/')?{kind:'synced',revision:data.revision}:{kind:'error',message:'远端未提供强 ETag，后续修改无法安全自动上传'};
 }
 async run(){
  if(!this.config())return this.state={kind:'disabled'};
  try{
   const local=this.readLocal(),localHash=digest(local),remote=await this.remote(),base=this.config().baseHash;
   if(remote.missing){if(base)throw Error('远端备份消失，请核对地址；本机数据已保留');await this.put(local,remote);return this.state;}
   if(remote.hash===localHash){await this.saveBase(remote.hash);return this.state=remote.etag&&!remote.etag.startsWith('W/')?{kind:'synced',revision:local.revision}:{kind:'error',message:'远端未提供强 ETag，后续修改无法安全自动上传'};}
   if(!base){return this.state={kind:'conflict',message:'远端已有不同数据，请在设置中选择恢复或保留本机'};}
   if(remote.hash===base){await this.put(local,remote);return this.state;}
   if(localHash===base){await this.writeLocal(remote.data,local);await this.saveBase(remote.hash);return this.state={kind:'synced',revision:this.readLocal().revision};}
   return this.state={kind:'conflict',message:'本机和远端都已修改，请先导出两端备份后核对'};
  }catch(error){return this.state={kind:'error',message:error.message};}
 }
 async useRemote(backup){
  const remote=await this.remote();if(remote.missing)throw Error('远端备份不存在');
  const local=this.readLocal();
  await backup(local);
  const latest=await this.remote();
  if(latest.missing||latest.hash!==remote.hash||(remote.etag&&latest.etag&&remote.etag!==latest.etag))throw Error('远端在选择期间已更新，请重新选择远端版本');
  await this.writeLocal(remote.data,local);
  await this.saveBase(latest.hash);
  return this.state={kind:'synced',revision:this.readLocal().revision};
 }
 async useLocal(backup){
  const remote=await this.remote();
  if(!remote.missing)await backup(remote.data);
  await this.put(this.readLocal(),remote);
  return this.state;
 }
}
