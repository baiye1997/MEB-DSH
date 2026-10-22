export const MAX_IMPORT_BYTES=20_000_000;
export const MAX_IMPORT_ROWS=20_000;
export const MAX_IMPORT_COLUMNS=200;

export function checkImportShape(rows){
 if(rows.length>MAX_IMPORT_ROWS)throw Error(`导入表格最多支持 ${MAX_IMPORT_ROWS} 行`);
 if(rows.some(row=>row.length>MAX_IMPORT_COLUMNS))throw Error(`导入表格最多支持 ${MAX_IMPORT_COLUMNS} 列`);
 return rows;
}

export function parseDelimited(text,delimiter=','){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'&&(quoted||cell==='')){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;continue;}
  if(!quoted&&ch===delimiter){row.push(cell);cell='';continue;}
  if(!quoted&&(ch==='\n'||ch==='\r')){row.push(cell);cell='';rows.push(row);row=[];if(ch==='\r'&&text[i+1]==='\n')i++;if(rows.length>MAX_IMPORT_ROWS)throw Error(`导入表格最多支持 ${MAX_IMPORT_ROWS} 行`);continue;}
  cell+=ch;
  if(row.length>MAX_IMPORT_COLUMNS)throw Error(`导入表格最多支持 ${MAX_IMPORT_COLUMNS} 列`);
 }
 if(quoted)throw Error('导入表格引号不完整');
 if(cell||row.length)rows.push([...row,cell]);
 return checkImportShape(rows);
}
