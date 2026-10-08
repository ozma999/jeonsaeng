// Upstash Redis REST. 환경변수가 없으면 메모리 저장(로컬 테스트용)으로 동작한다.
// Vercel 마켓플레이스 연동 시 KV_REST_API_* 이름으로 들어오는 경우도 지원
const URL=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL, TOKEN=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
// 배포 환경에서 Redis가 빠지면 메모리 저장(데이터 유실, demo 코드 허용)으로 돌지 않도록 막는다
export const misconfigured=!!process.env.VERCEL && !URL;
const mem=globalThis.__mem||(globalThis.__mem=new Map());
export const usingMemory=!URL;

export async function cmd(...args){
  if (!URL) return memCmd(args);
  const r=await fetch(URL,{method:'POST',headers:{Authorization:`Bearer ${TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(args)});
  const j=await r.json(); if(j.error) throw new Error(j.error); return j.result;
}
function memCmd([op,k,...rest]){
  op=op.toUpperCase();
  if(op==='GET') return mem.has(k)?mem.get(k):null;
  if(op==='SET'){ if(rest.includes('NX')&&mem.has(k)) return null; mem.set(k,rest[0]); return 'OK'; }
  if(op==='DEL'){ let n=0; for(const key of [k,...rest]) if(mem.delete(key)) n++; return n; }
  if(op==='SADD'){ const s=mem.get(k)||new Set(); rest.forEach(x=>s.add(x)); mem.set(k,s); return 1; }
  if(op==='SREM'){ const s=mem.get(k)||new Set(); rest.forEach(x=>s.delete(x)); return 1; }
  if(op==='SMEMBERS') return [...(mem.get(k)||[])];
  throw new Error('unsupported '+op);
}
export const getJSON=async k=>{ const v=await cmd('GET',k); return v?JSON.parse(v):null; };
export const setJSON=(k,v)=>cmd('SET',k,JSON.stringify(v));
