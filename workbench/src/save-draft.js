// Browser drafts keep edits and file ids, never attachment bytes or local paths.
export function draftSnapshot(value) {
 const snapshot=structuredClone(value);
 snapshot.draftFileIds=Array.isArray(value?.files)&&value.files.length?value.files.map(file=>file.id):Array.isArray(value?.draftFileIds)?value.draftFileIds:[];
 snapshot.files=[];
 return snapshot;
}

export function readDraft(raw) {
 const parsed=JSON.parse(raw);
 return draftSnapshot(parsed);
}

export function restoreDraft(current,draft) {
 const ids=new Set(Array.isArray(draft?.draftFileIds)?draft.draftFileIds:(draft?.files||[]).map(file=>file.id));
 const next={...draft,files:(current.files||[]).filter(file=>ids.has(file.id))};
 delete next.draftFileIds;
 return next;
}

// Saving host data has already succeeded; browser cleanup must not change that result.
export function clearSavedDraft(getStorage, snapshot) {
 try {
  const storage=getStorage(),raw=storage.getItem('meb-draft-v1');
  if(raw===null)return {cleared:true};
  if(raw!==JSON.stringify(draftSnapshot(snapshot))&&raw!==JSON.stringify(snapshot))return {cleared:false,message:'已保留另一份未保存草稿。'};
  storage.removeItem('meb-draft-v1');
  return {cleared:true};
 } catch {
  return {cleared:false,message:'浏览器草稿未能清理；重新打开时请核对草稿。'};
 }
}
