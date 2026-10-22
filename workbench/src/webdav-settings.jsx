import React,{useState} from 'react';

const labels={disabled:'未连接',idle:'待检查',pending:'正在同步',synced:'已同步',conflict:'同步冲突',error:'同步未完成'};

export default function WebDavSettings({status,onStatus,rpc,dirty}){
 const [url,setUrl]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(endpoint,payload){setBusy(true);setError('');try{const result=await rpc(endpoint,payload);if(endpoint==='sync-use-remote'){location.reload();return;}onStatus(endpoint==='sync-use-local'?await rpc('sync-status'):result);if(endpoint==='sync-configure')setPassword('');}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="webdav-settings" aria-label="WebDAV 自动同步">
  <h2>WebDAV 自动同步</h2>
  <p>本机仍是主库。保存后上传，打开时检查远端；双端同时修改会停下等待核对。同步数据包含项目、模型参数和附件副本，不包含本机引用的原文件或绝对路径，也不包含 DSH 对话。</p>
  <p role="status">{labels[status?.kind]||'读取状态中'}{status?.url?' · '+status.url:''}{status?.message?' · '+status.message:''}</p>
  {status?.configured?<div className="webdav-actions"><button disabled={busy||dirty} onClick={()=>act('sync-check')}>立即检查</button><button disabled={busy||dirty} onClick={()=>act('sync-disconnect')}>断开此电脑</button></div>:<div className="webdav-fields"><label>WebDAV 文件地址<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/dav/MEB.json"/></label><label>用户名<input value={username} onChange={e=>setUsername(e.target.value)}/></label><label>应用密码<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy||!url||!username||!password} onClick={()=>act('sync-configure',{url,username,password})}>连接并检查</button><small>密码保存在 macOS 钥匙串；远端地址及同步标记保存在本机 DSH 配置目录。</small></div>}
  {status?.kind==='conflict'&&<div className="webdav-conflict"><p>请先导出本机 JSON 备份，再选择保留哪一端。操作时会额外将被替换的一端保存到本机 exports 目录。</p><button disabled={busy||dirty} onClick={()=>act('sync-use-remote')}>备份本机并使用远端</button><button disabled={busy||dirty} onClick={()=>act('sync-use-local')}>备份远端并使用本机</button></div>}
  {dirty&&<p>有未保存编辑；请先保存或导出草稿，再操作同步。</p>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
