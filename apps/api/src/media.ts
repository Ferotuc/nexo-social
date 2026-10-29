import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { PoolClient } from 'pg';
export type Upload={originalname:string;mimetype:string;buffer:Buffer;size:number};
export function validateFile(file:Upload|undefined){
  if(!file?.size)throw new BadRequestException('Selecciona un archivo.');
  if(file.size>2097152)throw new PayloadTooLargeException('Máximo 2 MB por archivo.');
  const b=file.buffer, ext=file.originalname.split('.').pop()?.toLowerCase();
  const png=b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg=b.length>4&&b[0]===255&&b[1]===216&&b[2]===255&&b[b.length-2]===255&&b[b.length-1]===217;
  const webp=b.length>=16&&b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
  const pdf=b.toString('ascii',0,5)==='%PDF-';
  let text=false;try{new TextDecoder('utf-8',{fatal:true}).decode(b);text=!b.includes(0);}catch{}
  const mime=png&&ext==='png'?'image/png':jpeg&&['jpg','jpeg'].includes(ext||'')?'image/jpeg':webp&&ext==='webp'?'image/webp':pdf&&ext==='pdf'?'application/pdf':text&&ext==='txt'?'text/plain':null;
  if(!mime)throw new BadRequestException('Admite PNG, JPG, WebP, PDF o TXT UTF-8. El contenido debe coincidir con la extensión.');
  if(png&&(b.readUInt32BE(16)>8192||b.readUInt32BE(20)>8192))throw new BadRequestException('La imagen supera 8192 píxeles.');
  const name=file.originalname.replace(/[^a-zA-Z0-9._ -]/g,'_').slice(-120)||'archivo';
  return {name,mime};
}
export const attachmentJson=(alias:string)=>`json_build_object('id',${alias}.id,'name',${alias}.name,'mime',${alias}.mime,'size',${alias}.size)`;
export async function claimAttachments(c:PoolClient,owner:string,ids:string[],parent:'post_id'|'message_id',id:string){
  if(!ids.length)return;
  const result=await c.query(`UPDATE attachments SET ${parent}=$3 WHERE id=ANY($1::uuid[]) AND owner_id=$2 AND post_id IS NULL AND message_id IS NULL RETURNING id`,[ids,owner,id]);
  if(result.rowCount!==ids.length)throw new BadRequestException('Uno de los archivos ya fue utilizado o no te pertenece. Vuelve a adjuntarlo.');
}
