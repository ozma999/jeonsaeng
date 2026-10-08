import fs from 'fs';
import path from 'path';
import { buildProfile, rank, wobble, buildResult, LOOK_OPTS } from '../lib/match.js';
import { cmd, getJSON, setJSON, usingMemory, misconfigured } from '../lib/store.js';
import { ORDER, JOBS } from '../lib/questions.js';

const CHARS=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','characters.json'),'utf-8'));
const BY_ID=Object.fromEntries(CHARS.map(c=>[c.id,c]));
const ACCESS=process.env.ACCESS_CODE || (usingMemory?'demo':null);
const ADMIN=process.env.ADMIN_CODE || (usingMemory?'admin':null);

const cleanNick=n=>String(n||'').trim().slice(0,20);
const isRevealed=async()=> (await cmd('GET','config:revealed'))==='1';

function view(sub, subs){
  const c=BY_ID[sub.assigned]; if(!c) return null;
  const r=buildResult(sub,c,CHARS);
  r.relations=c.relations.map(x=>({...x,name:BY_ID[x.id]?.name,work:BY_ID[x.id]?.work})).filter(x=>x.name);
  if (subs){
    const relIds=new Set(c.relations.map(x=>x.id));
    r.bonds=subs.filter(o=>o.nick!==sub.nick&&o.assigned&&BY_ID[o.assigned])
      .filter(o=>BY_ID[o.assigned].work===c.work)
      .map(o=>({nick:o.nick,name:BY_ID[o.assigned].name,type:relIds.has(o.assigned)?c.relations.find(x=>x.id===o.assigned).type:'같은 작품'}));
  }
  const {id,name,work,author,year,world,role,scene,ending,spoiler,meme,image,source}=r.char;
  r.char={id,name,work,author,year,world,role,scene,ending,spoiler,meme,image,source}; // 배점 데이터는 내보내지 않음
  return { nick:sub.nick, ...r };
}
async function allSubs(){ const nicks=await cmd('SMEMBERS','subs')||[]; const out=[]; for(const n of nicks){ const s=await getJSON('sub:'+n); if(s) out.push(s);} return out; }

async function claimFirst(nick, order){
  for (const t of order){ const ok=await cmd('SET','claim:'+t.id,nick,'NX'); if(ok) return t.id; }
  return order[0].id; // 모두 선점된 경우: 중복 허용(관리자 재배정에서 정리)
}

async function reassign(){
  const subs=await allSubs();
  for (const c of CHARS) await cmd('DEL','claim:'+c.id);
  const claimed=new Set(), workCount={};
  subs.sort((a,b)=>((b.top[0]?.score||0)-(b.top[1]?.score||0))-((a.top[0]?.score||0)-(a.top[1]?.score||0)));
  for (const s of subs){
    if (s.locked && !claimed.has(s.assigned)){ claimed.add(s.assigned); }
    else {
      const best=s.top[0].score;
      const cand=s.top.filter(t=>!claimed.has(t.id)).map(t=>{
        let adj=t.score;
        if (t.id===s.assigned && t.score>=best*0.9) adj+=best*0.04;          // 결과가 덜 바뀌도록
        if (workCount[BY_ID[t.id]?.work] && t.score>=best*0.9) adj+=best*0.05; // 전생 인연 유도
        return {...t,adj};
      }).sort((a,b)=>b.adj-a.adj);
      s.assigned=(cand[0]||s.top[0]).id; claimed.add(s.assigned);
    }
    workCount[BY_ID[s.assigned].work]=(workCount[BY_ID[s.assigned].work]||0)+1;
    await cmd('SET','claim:'+s.assigned,s.nick); await setJSON('sub:'+s.nick,s);
  }
  return subs.length;
}

export default async function handler(req,res){
  try{
    const q=req.method==='GET'?req.query:(req.body||{});
    const action=q.action;
    if (misconfigured) return res.status(500).json({error:'Redis가 연결되지 않았습니다. Vercel 환경변수를 확인한 뒤 다시 배포해 주세요.'});
    if (action==='config') return res.json({revealed:await isRevealed(), demo:usingMemory, jobs:JOBS});

    if (action==='submit'||action==='me'||action==='present'){
      const admin=ADMIN && q.adminCode===ADMIN;
      if (!admin && (!ACCESS || q.code!==ACCESS)) return res.status(401).json({error:'입장 코드가 맞지 않습니다.'});
    }
    if (action==='submit'){
      const nick=cleanNick(q.nick); if(!nick) return res.status(400).json({error:'닉네임을 입력해 주세요.'});
      const answers={}; for(const k of ORDER){ const v=Number(q.answers?.[k]); if(!Number.isInteger(v)) return res.status(400).json({error:'모든 문항에 답해 주세요.'}); answers[k]=v; }
      const sub={ nick, answers, timings:q.timings||{}, changes:Number(q.changes)||0, skipped:!!q.skipped,
        look:Number.isInteger(q.look)?q.look:null, belief:[0,1,2].includes(q.belief)?q.belief:1,
        free:String(q.free||'').slice(0,80), job:JOBS.includes(q.job)?q.job:null, at:Date.now() };
      const prof=buildProfile(sub);
      sub.top=rank(prof,CHARS,sub.look!=null?LOOK_OPTS[sub.look]:null).map(({id,score})=>({id,score}));
      const prev=await getJSON('sub:'+nick);
      if (prev?.assigned && (await cmd('GET','claim:'+prev.assigned))===nick) await cmd('DEL','claim:'+prev.assigned);
      sub.assigned=await claimFirst(nick, wobble(sub.top));
      await setJSON('sub:'+nick,sub); await cmd('SADD','subs',nick);
      const revealed=await isRevealed();
      return res.json({result:view(sub, revealed?await allSubs():null), revealed});
    }
    if (action==='me'){
      const sub=await getJSON('sub:'+cleanNick(q.nick)); if(!sub) return res.json({result:null});
      const revealed=await isRevealed();
      return res.json({result:view(sub, revealed?await allSubs():null), revealed});
    }
    if (action==='present'){
      const admin=ADMIN && q.adminCode===ADMIN;
      if (!admin && !(await isRevealed())) return res.status(403).json({error:'아직 공개 전입니다.'});
      const subs=await allSubs();
      return res.json({results:subs.map(s=>view(s,subs)).filter(Boolean)});
    }
    if (action==='admin'){
      if (!ADMIN || q.adminCode!==ADMIN) return res.status(401).json({error:'관리자 코드가 맞지 않습니다.'});
      const op=q.op;
      if (op==='list'){ const subs=await allSubs();
        return res.json({revealed:await isRevealed(), demo:usingMemory, subs:subs.map(s=>({nick:s.nick,at:s.at,assigned:s.assigned,locked:!!s.locked,
          top:s.top.map(t=>({id:t.id,score:t.score,name:BY_ID[t.id]?.name,work:BY_ID[t.id]?.work}))})), chars:CHARS.length}); }
      if (op==='reassign') return res.json({ok:true,count:await reassign()});
      if (op==='reveal'){ await cmd('SET','config:revealed',q.value?'1':'0'); return res.json({ok:true}); }
      if (op==='override'){ const s=await getJSON('sub:'+cleanNick(q.nick)); if(!s||!BY_ID[q.id]) return res.status(400).json({error:'대상을 찾을 수 없습니다.'});
        if ((await cmd('GET','claim:'+s.assigned))===s.nick) await cmd('DEL','claim:'+s.assigned);
        s.assigned=q.id; s.locked=true; await cmd('SET','claim:'+q.id,s.nick); await setJSON('sub:'+s.nick,s); return res.json({ok:true}); }
      if (op==='reset'){ const n=cleanNick(q.nick); const s=await getJSON('sub:'+n);
        if (s && (await cmd('GET','claim:'+s.assigned))===n) await cmd('DEL','claim:'+s.assigned);
        await cmd('DEL','sub:'+n); await cmd('SREM','subs',n); return res.json({ok:true}); }
      return res.status(400).json({error:'알 수 없는 작업입니다.'});
    }
    res.status(400).json({error:'알 수 없는 요청입니다.'});
  }catch(e){ res.status(500).json({error:'서버 오류: '+e.message}); }
}
