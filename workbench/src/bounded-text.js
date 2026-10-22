// Count wire bytes before decoding or parsing, including responses without Content-Length.
export async function readBoundedText(source,maxBytes,message){
 const tooLarge=()=>Object.assign(Error(message),{status:413});
 if(Number(source.headers?.get?.('content-length'))>maxBytes){await source.body?.cancel().catch(()=>{});throw tooLarge();}
 if(!source.body)return '';
 const reader=source.body.getReader(),decoder=new TextDecoder(),parts=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes)throw tooLarge();parts.push(decoder.decode(value,{stream:true}));}
  parts.push(decoder.decode());return parts.join('');
 }catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
}
