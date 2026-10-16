// 외부 이미지 프록시: 핫링크 차단을 피하고, 같은 도메인으로 내려서 PNG 저장에도 포함되게 한다.
const REF = h => /pstatic\.net|naver/.test(h) ? 'https://comic.naver.com/' : /namu/.test(h) ? 'https://namu.wiki/' : undefined;
export default async function handler(req,res){
  try{
    const u=new URL(String(req.query.u||''));
    if(!/^https?:$/.test(u.protocol)) return res.status(400).end();
    const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Referer':REF(u.hostname)||u.origin}});
    const type=r.headers.get('content-type')||'';
    if(!r.ok||!type.startsWith('image/')) return res.status(502).end();
    const buf=Buffer.from(await r.arrayBuffer());
    if(buf.length>5e6) return res.status(413).end();
    res.setHeader('Content-Type',type); res.setHeader('Cache-Control','public, max-age=604800, s-maxage=604800');
    res.end(buf);
  }catch{ res.status(400).end(); }
}
