export async function workbenchRequest(endpoint,payload,send=fetch){
 let response;
 try{response=await send('/api/meb-workbench',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint:'meb/'+endpoint,payload})});}
 catch{throw Error('无法连接 DSH，请检查 DSH 是否仍在运行；未保存内容请先保留。');}
 if(response.status===401)throw Error('DSH 登录已失效。请从 DSH 当前启动入口重新登录后重试；未保存内容请先保留。');
 if(response.status===403)throw Error('DSH 拒绝了本次访问，请核对当前工作台地址和访问权限。');
 if(response.status===413)throw Error('请求数据过大；请将大附件改为本机引用后重试。');
 if(response.ok===false)throw Error(`DSH 请求未完成（${response.status}），请稍后重试。`);
 let result;
 try{result=await response.json();}catch{throw Error('DSH 返回内容无法读取，请检查服务状态后重试。');}
 if(!result?.ok)throw Error(result?.error?.message||'工作台操作未完成，请重试。');
 if(endpoint==='read'&&result.apiVersion!==8)throw Error('工作台已更新，DSH 服务尚未同步。请重启 DSH 后重新打开工作台；已有本机数据不会被清空。');
 return result.value;
}
