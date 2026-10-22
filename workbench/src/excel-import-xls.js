import CFB from 'cfb';
import codepage from 'codepage';
import SSF from 'ssf';
import {MAX_IMPORT_BYTES,checkImportShape} from './excel-import-format.js';

const MAX_IMPORT_ROWS=20_000,MAX_IMPORT_COLUMNS=200,MAX_IMPORT_TEXT_BYTES=40_000_000;
const u16=(b,o)=>b[o]|(b[o+1]<<8),u32=(b,o)=>(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0;
const i32=(b,o)=>u32(b,o)|0;
const text=value=>value===null||value===undefined?'':String(value);

function readBiffString(bytes,offset,codePage=1200,biff8=true){
 if(!biff8){const count=bytes[offset],raw=bytes.subarray(offset+1,offset+1+count);return {value:codepage.utils.decode(codePage,Array.from(raw)),offset:offset+1+count};}
 const count=u16(bytes,offset);let at=offset+2,flags=bytes[at++],wide=!!(flags&1);
 const rich=flags&8?u16(bytes,at):0;at+=flags&8?2:0;const ext=flags&4?u32(bytes,at):0;at+=flags&4?4:0;
 const size=wide?count*2:count,raw=bytes.subarray(at,at+size);at+=size+rich*4+ext;
 let value;if(wide)value=new TextDecoder('utf-16le').decode(raw);else{try{value=codepage.utils.decode(codePage,Array.from(raw));}catch{value=new TextDecoder().decode(raw);}}
 return {value,offset:at};
}
function readShortString(bytes,offset,codePage=1200,biff8=true){
 const count=bytes[offset];if(!biff8)return codepage.utils.decode(codePage,Array.from(bytes.subarray(offset+1,offset+1+count)));
 const wide=!!bytes[offset+1],at=offset+2,size=wide?count*2:count,raw=bytes.subarray(at,at+size);
 return wide?new TextDecoder('utf-16le').decode(raw):codepage.utils.decode(codePage,Array.from(raw));
}

function parseSharedStrings(records,codePage){
 const chunks=records.map(r=>r.payload),strings=[];let chunkIndex=0,offset=0;
 const byte=()=>{while(chunkIndex<chunks.length&&offset>=chunks[chunkIndex].length){chunkIndex++;offset=0;}if(chunkIndex>=chunks.length)throw Error('XLS 共享字符串损坏');return chunks[chunkIndex][offset++];};
 const bytes=count=>{const out=new Uint8Array(count);for(let i=0;i<count;i++)out[i]=byte();return out;};
 const header=new Uint8Array([byte(),byte(),byte(),byte(),byte(),byte(),byte(),byte()]),total=u32(header,0),unique=u32(header,4);
 for(let i=0;i<unique;i++){
  const cch=byte()|(byte()<<8),flags=byte();let rich=0,ext=0;if(flags&8)rich=byte()|(byte()<<8);if(flags&4)ext=byte()|(byte()<<8)|(byte()<<16)|(byte()<<24);let remain=cch,wide=!!(flags&1),parts=[];
  while(remain){let available=chunks[chunkIndex]?.length-(offset||0);if(!available){chunkIndex++;offset=0;continue;}const unit=wide?2:1;let n=Math.min(remain,Math.floor(available/unit));if(!n){if(wide){parts.push(String.fromCharCode(byte()));available--;continue;}n=1;}const raw=bytes(n*unit);parts.push(wide?new TextDecoder('utf-16le').decode(raw):codepage.utils.decode(codePage,Array.from(raw)));remain-=n;if(remain&&offset>=chunks[chunkIndex].length){chunkIndex++;offset=0;wide=!!byte();}}
  if(rich)bytes(rich*4);if(ext)bytes(ext);strings.push(parts.join(''));
 }
 return {total,strings};
}

function recordsOf(bytes,start=0,end=bytes.length){const out=[];for(let at=start;at+4<=end;){const id=u16(bytes,at),length=u16(bytes,at+2),next=at+4+length;if(next>end)throw Error('XLS 记录长度无效');out.push({id,offset:at,payload:bytes.subarray(at+4,next)});at=next;}return out;}
function cellString(payload,state){return readBiffString(payload,6,state.codePage,state.biff8).value;}
function rkNumber(payload,offset=0){const raw=u32(payload,offset),integer=raw&2,scaled=raw&1;if(integer){const n=i32(payload,offset)>>2;return scaled?n/100:n;}const bits=new Uint8Array([0,0,0,0,(raw&0xfc),payload[offset+1],payload[offset+2],payload[offset+3]]);const n=new DataView(bits.buffer).getFloat64(0,true);return scaled?n/100:n;}
function formatNumber(value,xf,formats,date1904){const id=xf?.numFmtId??0,format=formats[id]||SSF.get_table()[id];if(format&&SSF.is_date(format)){const date=SSF.parse_date_code(value,{date1904});if(date)return `${String(date.y).padStart(4,'0')}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`;}return text(value);}

function parseSheet(bytes,start,end,state,name){
 const cells=new Map(),records=recordsOf(bytes,start,end);let maxRow=-1,maxCol=-1,pendingFormula=null,textBytes=0;
 const put=(row,col,value)=>{if(row>=MAX_IMPORT_ROWS||col>=MAX_IMPORT_COLUMNS)throw Error(row>=MAX_IMPORT_ROWS?'导入表格最多支持 20000 行':'导入表格最多支持 200 列');const valueText=text(value);textBytes+=valueText.length*2;if(textBytes>MAX_IMPORT_TEXT_BYTES)throw Error('导入表格展开后超过 40 MB，请缩小文件后重试');cells.set(`${row}:${col}`,valueText);maxRow=Math.max(maxRow,row);maxCol=Math.max(maxCol,col);};
 for(const record of records){const p=record.payload;switch(record.id){
  case 0x0204:put(u16(p,0),u16(p,2),cellString(p,state));break;
  case 0x00fd:put(u16(p,0),u16(p,2),state.shared[u32(p,6)]??'');break;
  case 0x0203:put(u16(p,0),u16(p,2),formatNumber(new DataView(p.buffer,p.byteOffset+6,8).getFloat64(0,true),state.xfs[u16(p,4)],state.formats,state.date1904));break;
  case 0x027e:put(u16(p,0),u16(p,2),formatNumber(rkNumber(p,6),state.xfs[u16(p,4)],state.formats,state.date1904));break;
  case 0x00bd:{const row=u16(p,0),first=u16(p,2),last=u16(p,p.length-2);for(let at=4,col=first;col<=last;col++,at+=6)put(row,col,formatNumber(rkNumber(p,at+2),state.xfs[u16(p,at)],state.formats,state.date1904));break;}
  case 0x0205:put(u16(p,0),u16(p,2),p[7]===1?'#错误':p[6]?'TRUE':'FALSE');break;
  case 0x0006:{const value=new DataView(p.buffer,p.byteOffset+6,8).getFloat64(0,true);pendingFormula={row:u16(p,0),col:u16(p,2),xf:u16(p,4),value};if(Number.isFinite(value))put(pendingFormula.row,pendingFormula.col,formatNumber(value,state.xfs[pendingFormula.xf],state.formats,state.date1904));break;}
  case 0x0207:if(pendingFormula){put(pendingFormula.row,pendingFormula.col,readBiffString(p,0,state.codePage,state.biff8).value);pendingFormula=null;}break;
  default:break;
 }}
 const matrix=Array.from({length:Math.max(0,maxRow+1)},()=>Array(Math.max(0,maxCol+1)).fill(''));for(const [key,value] of cells){const [row,col]=key.split(':').map(Number);matrix[row][col]=value;}
 return {name,matrix:checkImportShape(matrix)};
}

export function parseLegacyWorkbook(buffer){
 if(buffer.byteLength>MAX_IMPORT_BYTES)throw Error(`导入表格不得超过 ${MAX_IMPORT_BYTES/1000000} MB`);
 const cfb=CFB.parse(new Uint8Array(buffer)),workbook=CFB.find(cfb,'R/Workbook')||CFB.find(cfb,'R/Book');if(!workbook?.content)throw Error('无法读取 XLS 工作簿');
 const bytes=workbook.content instanceof Uint8Array?workbook.content:new Uint8Array(workbook.content),records=recordsOf(bytes),bounds=[],formats={},xfs=[],state={codePage:1252,biff8:true,date1904:false,shared:[],formats,xfs};let sstRecords=[],readingSst=false;
 for(const record of records){const p=record.payload;if(record.id===0x00fc){sstRecords=[record];readingSst=true;continue;}if(record.id===0x003c&&readingSst){sstRecords.push(record);continue;}readingSst=false;switch(record.id){
  case 0x0042:state.codePage=u16(p,0);break;
  case 0x0809:state.biff8=u16(p,0)>=0x0600;break;
  case 0x0022:state.date1904=!!u16(p,0);break;
  case 0x0085:{const pos=u32(p,0),name=readShortString(p,6,state.codePage,state.biff8);bounds.push({pos,name});break;}
  case 0x00e0:xfs.push({numFmtId:u16(p,2)});break;
  case 0x041e:{const fmt=readBiffString(p,2,state.codePage,state.biff8);formats[u16(p,0)]=fmt.value;break;}
  default:break;
 }}
 if(sstRecords.length)state.shared=parseSharedStrings(sstRecords,state.codePage).strings;
 if(!bounds.length)bounds.push({pos:records.find(r=>r.id===0x000a)?.offset||0,name:'Sheet1'});
 return bounds.map((sheet,i)=>parseSheet(bytes,sheet.pos,bounds[i+1]?.pos||bytes.length,state,sheet.name||`Sheet${i+1}`));
}
