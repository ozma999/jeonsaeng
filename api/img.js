// 외부 이미지 프록시: 핫링크 차단을 피하고, 같은 도메인으로 내려서 PNG 저장에도 포함되게 한다.
const REF = h => /pstatic\.net|naver/.test(h) ? 'https://comic.naver.com/' : /namu/.test(h) ? 'https://namu.wiki/' : undefined;
import fs from 'fs';
import path from 'path';
// 저장소에 포함된 캐릭터 이미지: data/imgpack_index.json(id→묶음 번호) + data/imgpack_1~3.json(id→webp base64)
let IDX=null; const PACKS={};
function packed(id){
  if(!IDX){ try{ IDX=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','imgpack_index.json'),'utf-8')); }catch{ IDX={}; } }
  const n=IDX[id]; if(!n) return null;
  if(!PACKS[n]){ try{ PACKS[n]=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data',`imgpack_${n}.json`),'utf-8')); }catch{ PACKS[n]={}; } }
  return PACKS[n][id] ? Buffer.from(PACKS[n][id],'base64') : null;
}
export default async function handler(req,res){
  if(req.query.id){
    const buf=/^[\w-]+$/.test(String(req.query.id)) && packed(String(req.query.id));
    if(!buf) return res.status(404).end();
    res.setHeader('Content-Type','image/webp'); res.setHeader('Cache-Control','public, max-age=31536000, s-maxage=31536000, immutable');
    return res.end(buf);
  }
  try{
    const u=new URL(String(req.query.u||''));
    if(!/^https?:$/.test(u.protocol)) return res.status(400).end();
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36','Accept':'image/avif,image/webp,image/*,*/*;q=0.8','Referer':REF(u.hostname)||u.origin}});
    const type=r.headers.get('content-type')||'';
    if(!r.ok||!type.startsWith('image/')) return res.status(502).end();
    const buf=Buffer.from(await r.arrayBuffer());
    if(buf.length>5e6) return res.status(413).end();
    res.setHeader('Content-Type',type); res.setHeader('Cache-Control','public, max-age=604800, s-maxage=604800');
    res.end(buf);
  }catch{ res.status(400).end(); }
}
