import ExcelJS from 'exceljs';
import {ledgerExportMatrix} from './ledger-export.js';
import {ledgerDisplayColumns} from './ledger-layout.js';
import {sheetAlignment,sheetPaint} from './sheet-format.js';
const ink='FF243746',accent='FF254F60',rule='FFDDE5E9';
const quantityFormat=value=>{const [mantissa,exp='0']=String(value).split('e'),places=Math.max(0,(mantissa.split('.')[1]?.length||0)-Number(exp));return '#,##0'+(places?'.'+'0'.repeat(Math.min(15,places)):'');};
const textWidth=value=>[...String(value??'')].reduce((n,c)=>n+(c.charCodeAt(0)>255?2:1),0);
export async function createLedgerWorkbook({rows,columns,kind,title,projectName,format,scope='当前筛选结果',exportedAt=new Date().toISOString()}){
 const cols=ledgerDisplayColumns(columns,kind),matrix=ledgerExportMatrix(rows,cols,kind),headers=matrix[0];
 const workbook=new ExcelJS.Workbook();workbook.creator='MEB 工作台';workbook.created=new Date(exportedAt);
 const sheet=workbook.addWorksheet(title.slice(0,31),{properties:{defaultRowHeight:26},views:[{state:'frozen',xSplit:1,ySplit:3,showGridLines:false}],pageSetup:{paperSize:headers.length>12?8:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.25,right:.25,top:.45,bottom:.45,header:.2,footer:.2}}});
 const widths=headers.map((name,i)=>{
  const c=cols[i];if(c?.id==='unit'||name==='结果单位')return 9;
  if(c?.type==='date')return 14;if(name==='入账时间')return 23;
  if(['number','computed'].includes(c?.type)||name==='入账时计算结果')return 24;
  if(/说明|内容|备注|明细|参数|规则|算式|规格/.test(name))return 42;
  const longest=Math.max(textWidth(name)+4,...matrix.slice(1,201).map(r=>Math.max(...String(r[i]??'').split('\n').map(textWidth))+2));
  return Math.max(14,Math.min(30,longest));
 });
 sheet.columns=widths.map(width=>({width}));
 sheet.addRow([projectName+' · '+title]);sheet.mergeCells(1,1,1,headers.length);sheet.getRow(1).height=32;
 sheet.getCell('A1').font={name:'微软雅黑',size:16,bold:true,color:{argb:accent}};
 const stamp=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(exportedAt));
 sheet.addRow([`${scope} · ${rows.length} 条记录 · 导出于 ${stamp}（北京时间）`]);sheet.mergeCells(2,1,2,headers.length);sheet.getRow(2).height=25;
 sheet.getCell('A2').font={name:'微软雅黑',size:10,color:{argb:'FF657681'}};
 sheet.addRow(headers);const header=sheet.getRow(3);header.height=32;
 header.eachCell(cell=>{cell.font={name:'微软雅黑',size:11,bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:accent}};cell.alignment={vertical:'middle',wrapText:true};});
 for(let index=1;index<matrix.length;index++){
  const values=matrix[index].map((value,i)=>{
   if(cols[i]?.type==='date'&&/^\d{4}-\d{2}-\d{2}$/.test(value)){const d=new Date(value+'T00:00:00Z');if(Number.isFinite(+d)&&d.toISOString().slice(0,10)===value)return d;}
   if(headers[i]==='入账时间'&&value){const d=new Date(value);if(Number.isFinite(+d))return new Date(+d+8*3600000);}
   return value;
  });
  const row=sheet.addRow(values);let lines=1;
  row.eachCell({includeEmpty:true},(cell,i)=>{
   const value=values[i-1],c=cols[i-1];cell.font={name:'微软雅黑',size:11,color:{argb:ink}};
   const fallback=typeof value==='number'||['number','computed'].includes(c?.type)?'right':value instanceof Date||c?.id==='unit'?'center':'left';
   cell.alignment={vertical:'middle',wrapText:true,horizontal:c?sheetAlignment(format,rows[index-1].id,c.id,fallback):fallback};
   cell.border={bottom:{style:'hair',color:{argb:rule}}};
   if(index%2===0)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF3F7F8'}};
   if(c){const paint=sheetPaint(format,rows[index-1].id,c.id,matrix[index][i-1]);if(paint.fill)cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+paint.fill.slice(1).toUpperCase()}};if(paint.color)cell.font={...cell.font,color:{argb:'FF'+paint.color.slice(1).toUpperCase()}};}
   if(value instanceof Date)cell.numFmt=c?.type==='date'?'yyyy-mm-dd':'yyyy-mm-dd hh:mm';
   else if(typeof value==='number'&&c?.id==='amount'&&rows[index-1].source?.sheetId==='custom'){const precision=rows[index-1].source.customRule?.precision??2;cell.numFmt='#,##0'+(precision?'.'+'0'.repeat(precision):'');}
   else if(typeof value==='number')cell.numFmt=(c?.id==='amount'||['change','contract','output','materials'].includes(kind)&&['reported','verified','payable','unpaid','price'].includes(c?.id))?'#,##0.00':quantityFormat(value);
   else cell.numFmt='@';
   if(!(value instanceof Date))lines=Math.max(lines,...String(value??'').split('\n').map(line=>Math.max(1,Math.ceil(textWidth(line)/(widths[i-1]-3)))));
  });
  row.height=Math.min(409,Math.max(27,lines*17+10));
 }
 const last=sheet.getColumn(headers.length).letter;
 sheet.autoFilter=`A3:${last}${sheet.rowCount}`;
 sheet.pageSetup.printArea=`A1:${last}${sheet.rowCount}`;sheet.pageSetup.printTitlesRow='1:3';
 sheet.headerFooter.oddFooter='&LMEB 工作台&C第 &P 页 / 共 &N 页';
 return workbook.xlsx.writeBuffer({zip:{compression:'DEFLATE',compressionOptions:{level:6}}});
}
