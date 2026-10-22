const KEY='meb-daily-intro-v1';
let shownInMemory='';

export function claimDailyIntro(storage,date=new Date()){
 const day=[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
 if(shownInMemory===day)return false;
 try{
  if(storage.getItem(KEY)===day)return false;
  storage.setItem(KEY,day);
 }catch{
  // Storage can be disabled; still avoid replay on every mount in this session.
 }
 shownInMemory=day;
 return true;
}
