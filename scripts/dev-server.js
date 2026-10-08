// 로컬 확인용 서버 (Vercel 없이). node scripts/dev-server.js → http://localhost:3000
import http from 'http'; import fs from 'fs'; import { URL } from 'url';
const { default: handler } = await import('../api/game.js');
http.createServer(async (req,res)=>{
  const u=new URL(req.url,'http://x');
  if (u.pathname==='/api/game'){
    let body=''; for await (const ch of req) body+=ch;
    const r={ method:req.method, query:Object.fromEntries(u.searchParams), body:body?JSON.parse(body):{} };
    const out={ status(c){res.statusCode=c;return out;}, json(j){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(j));} };
    return handler(r,out);
  }
  res.setHeader('Content-Type','text/html; charset=utf-8'); res.end(fs.readFileSync('index.html'));
}).listen(process.env.PORT||3000,()=>console.log('http://localhost:'+(process.env.PORT||3000)));
