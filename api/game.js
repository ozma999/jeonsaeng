import fs from 'fs';
import path from 'path';
import { buildTale } from '../lib/tale.js';
import { planPast, renderPast } from '../lib/past.js';
import { meetOf, meetMap } from '../lib/meet.js';
import { planLife, renderLife, lifeCard, echoLine, PACK_IDS } from '../lib/life.js';
let ECHO={}; try{ ECHO=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','echo.json'),'utf-8')); }catch{}
import { buildProfile, rank, wobble, buildResult, LOOK_OPTS, composition } from '../lib/match.js';
import { cmd, getJSON, setJSON, usingMemory, misconfigured } from '../lib/store.js';
import { ORDER, JOBS, MBTI } from '../lib/questions.js';

export const VERSION='v3.9';
let OVR={};   // 관리자 화면에서 붙여 넣은 이미지 주소 (Redis img:overrides)
// 저장소에 포함된 캐릭터 이미지(data/imgpack_*.json)가 있으면 그걸 먼저 쓴다 → /api/img?id=<id> 로 같은 도메인에서 내려줌
let PACK={}; try{ PACK=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','imgpack_index.json'),'utf-8')); }catch{}
const imgOf=id=>OVR[id]||(PACK[id]?`/api/img?id=${id}&v=${VERSION}`:'')||BY_ID[id]?.image||'';
const CHARS=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','characters.json'),'utf-8'));
const BY_ID=Object.fromEntries(CHARS.map(c=>[c.id,c]));
// 레어도 (scripts/rarity.js 로 생성). 파일이 없으면 등급 없이 동작
// 본편 서사 (data/lore.json: 회상록·봉인된 기억·인연·명대사·명장면)
let LORE={}; try{ LORE=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','lore.json'),'utf-8')); }catch{}
function loreOf(id){
  const L=LORE[id]; if(!L) return null; const me=BY_ID[id];
  const norm=t=>String(t||'').replace(/\s|\(.*?\)/g,'');
  const bonds=(L.bonds||[]).map(b=>{ const n=norm(b.name);
    const hit=CHARS.find(x=>x.id!==id&&x.work===me.work&&(norm(x.name)===n||(Math.min(n.length,norm(x.name).length)>=2&&(norm(x.name).includes(n)||n.includes(norm(x.name))))));
    return {name:b.name,rel:b.rel,line:b.line,image:hit?imgOf(hit.id):''}; });
  return {story:L.story||[],spoiler:L.spoiler||[],bonds,quotes:L.quotes||[],scenes:L.scenes||[]};
}
let RARITY={}; try{ RARITY=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','rarity.json'),'utf-8')); }catch{}
const ADMIN=(process.env.ADMIN_NAME||'김현우').replace(/\s+/g,'');   // 이 이름으로 들어오면 관리자 메뉴가 열린다 (보안 없음)

const cleanNick=n=>String(n||'').replace(/\s+/g,'').slice(0,20);   // 띄어쓰기 무시: '김 현우' = '김현우'
const isRevealed=async()=> (await cmd('GET','config:revealed'))==='1';

function view(sub, subs, idx){
  const c=BY_ID[sub.assigned]; if(!c) return null;
  const r=buildResult(sub,c,CHARS);
  r.relations=c.relations.map(x=>({...x,name:BY_ID[x.id]?.name,work:BY_ID[x.id]?.work})).filter(x=>x.name);
  if (subs){
    const relIds=new Set(c.relations.map(x=>x.id));
    r.bonds=subs.filter(o=>o.nick!==sub.nick&&o.assigned&&BY_ID[o.assigned])
      .filter(o=>BY_ID[o.assigned].work===c.work)
      .map(o=>({nick:o.nick,name:BY_ID[o.assigned].name,type:relIds.has(o.assigned)?c.relations.find(x=>x.id===o.assigned).type:'같은 작품'}));
    // 전생의 소울메이트 / 원수: 참가자 중 성향이 가장 가까운 사람과 가장 먼 사람
    const me=buildProfile(sub), dist=o=>{ const p=buildProfile(o); let d=0; for(const a of ['E','M','S','X']) d+=Math.abs(p.v[a]-me.v[a]);
      const top=x=>Object.entries(x.world).sort((a,b)=>b[1]-a[1])[0]?.[0]; return d+(top(p)===top(me)?0:1); };
    const others=subs.filter(o=>o.nick!==sub.nick&&BY_ID[o.assigned]).map(o=>({o,d:dist(o)})).sort((a,b)=>a.d-b.d);
    if (others.length){ const f=others[0].o, l=others[others.length-1].o;
      r.soulmate={nick:f.nick,name:BY_ID[f.assigned].name,work:BY_ID[f.assigned].work};
      if (others.length>1) r.rival={nick:l.nick,name:BY_ID[l.assigned].name,work:BY_ID[l.assigned].work}; }
  }
  const {id,name,work,author,year,world,role,scene,ending,spoiler,meme,image,source,quote}=r.char;
  const rr=RARITY[id]||null;
  r.char={id,name,work,author,year,world,role,scene,ending,spoiler,meme,image:imgOf(id),source,quote,
    rarity:rr?{grade:rr.g,rate:rr.rate,order:rr.n,total:CHARS.length}:null, lore:loreOf(id)}; // 배점 데이터는 내보내지 않음
  // 희미하게 겹친 또 다른 생 (후보 2순위)
  r.composition=composition(sub.assigned, sub.top||[], BY_ID).map(x=>({...x,image:imgOf(x.id)}));
  // 맞히기 보기: 배정 캐릭터 + 후보 3명 (섞어서)
  const opts=[sub.assigned,...(sub.top||[]).map(t=>t.id).filter(id=>id!==sub.assigned&&BY_ID[id])].slice(0,4);
  r.choices=opts.map(id=>({id,name:BY_ID[id].name,work:BY_ID[id].work})).sort(()=>Math.random()-.5);
  r.silhouette=imgOf(c.id);
  const lives=sub.lives||[];
  if (lives.length){
    const rep=Number.isInteger(sub.rep)&&lives[sub.rep]?sub.rep:0, i=Number.isInteger(idx)&&lives[idx]?idx:rep;
    r.life=renderLife(lives[i],sub); r.lifeIdx=i; r.repIdx=rep; r.dex=lives.map(lifeCard); r.packTotal=PACK_IDS.length;
    r.echo=echoLine(lives[i], c.name, ECHO[c.id]);
    if (subs) r.meet=meetOf(sub, subs);
    if (subs) r.lifeCross=subs.filter(o=>o.nick!==sub.nick&&o.lives?.length).map(o=>({o,L:o.lives[Number.isInteger(o.rep)?o.rep:0]})).filter(x=>x.L&&x.L.pack===lives[rep].pack)
      .map(({o,L})=>{ const c=lifeCard(L); return c&&{nick:o.nick,name:c.name,job:c.job,by:c.by}; }).filter(Boolean);
  }
  r.past=!r.life&&sub.past?renderPast(sub.past,sub):null;
  if (!r.life&&!r.past) r.tale=buildTale(sub);
  if (r.past && !r.life && subs) r.pastCross=subs.filter(o=>o.nick!==sub.nick&&o.past&&o.past.scene===sub.past.scene).map(o=>{ const x=renderPast(o.past,o); return x&&{nick:o.nick,name:x.profile.name,job:x.profile.job,born:x.profile.born}; }).filter(Boolean);
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
    OVR=(await getJSON('img:overrides').catch(()=>null))||{};
    if (misconfigured) return res.status(500).json({error:'Redis가 연결되지 않았습니다. Vercel 환경변수를 확인한 뒤 다시 배포해 주세요.'});
    if (action==='config') return res.json({revealed:await isRevealed(), demo:usingMemory, jobs:JOBS, mbti:MBTI, version:VERSION});

    if (action==='submit'){
      const nick=cleanNick(q.nick); if(!nick) return res.status(400).json({error:'이름을 입력해 주세요.'});
      const answers={}; for(const k of ORDER){ const v=Number(q.answers?.[k]); if(!Number.isInteger(v)) return res.status(400).json({error:'모든 문항에 답해 주세요.'}); answers[k]=v; }
      const sub={ nick, answers, timings:q.timings||{}, changes:Number(q.changes)||0, skipped:!!q.skipped,
        look:Number.isInteger(q.look)?q.look:null, belief:[0,1,2].includes(q.belief)?q.belief:1,
        free:String(q.free||'').slice(0,80), job:JOBS.includes(q.job)?q.job:null, mbti:MBTI.includes(q.mbti)?q.mbti:null, at:Date.now() };
      const prof=buildProfile(sub);
      sub.top=rank(prof,CHARS,sub.look!=null?LOOK_OPTS[sub.look]:null).map(({id,score})=>({id,score}));
      // v3.1 전생 생애: 출생 연도만 받는다. 할 때마다 새 생이 쌓이고(도감), 대표 생은 직접 고른다
      { const y=Number(q.year); if(!(Number.isInteger(y)&&y>=1940&&y<=2015)) return res.status(400).json({error:'태어난 해를 골라 주세요.'});
        const int=(v,n)=>Number.isInteger(v)&&v>=0&&v<n?v:null;
        sub.lifeInput={year:y, slot:int(q.slot,5), sib:int(q.sib,6), land:int(q.land,6), fear:int(q.fear,6), mark:int(q.mark,10)}; }
      const prev=await getJSON('sub:'+nick);
      if (prev?.assigned && (await cmd('GET','claim:'+prev.assigned))===nick) await cmd('DEL','claim:'+prev.assigned);
      sub.assigned=await claimFirst(nick, wobble(sub.top));
      { const others=(await allSubs()).filter(o=>o.nick!==nick&&o.lives?.length).map(o=>o.lives[Number.isInteger(o.rep)?o.rep:0]).filter(Boolean);
        const L=planLife({nick, input:sub.lifeInput, prof, twin:BY_ID[sub.top[0]?.id], answers, taken:others});
        sub.lives=[...(prev?.lives||[]), L].filter(Boolean).slice(-60); sub.rep=Number.isInteger(prev?.rep)&&prev.lives?.[prev.rep]?prev.rep:0;
        if (sub.rep>=sub.lives.length) sub.rep=0; }
      await setJSON('sub:'+nick,sub); await cmd('SADD','subs',nick);
      const revealed=await isRevealed();
      return res.json({result:view(sub, revealed?await allSubs():null, sub.lives?.length?sub.lives.length-1:undefined), revealed});
    }
    if (action==='me'){
      const sub=await getJSON('sub:'+cleanNick(q.nick)); if(!sub) return res.json({result:null});
      const revealed=await isRevealed();
      return res.json({result:view(sub, revealed?await allSubs():null), revealed});
    }
    if (action==='life'||action==='setRep'||action==='reroll'){
      const nick=cleanNick(q.nick), sub=await getJSON('sub:'+nick); if(!sub?.lives?.length) return res.status(404).json({error:'기록이 없습니다.'});
      let i=Number(q.i);
      if (action==='setRep'){ if(!sub.lives[i]) return res.status(400).json({error:'없는 기록입니다.'}); sub.rep=i; await setJSON('sub:'+nick,sub); }
      if (action==='reroll'){ const prof=buildProfile(sub); const others=(await allSubs()).filter(o=>o.nick!==nick&&o.lives?.length).map(o=>o.lives[Number.isInteger(o.rep)?o.rep:0]).filter(Boolean);
        const last=sub.lives[sub.lives.length-1]; const input=sub.lifeInput||{year:last.nowY,slot:last.slot,sib:last.sib,land:last.land,fear:last.fear,mark:last.mark};
        const L=planLife({nick,input,prof,twin:BY_ID[sub.top?.[0]?.id],answers:sub.answers,taken:others,salt:String(sub.lives.length)});
        sub.lives=[...sub.lives,L].slice(-60); await setJSON('sub:'+nick,sub); i=sub.lives.length-1; }
      const revealed=await isRevealed();
      return res.json({result:view(sub, revealed?await allSubs():null, Number.isInteger(i)?i:undefined), revealed});
    }
    if (action==='present'){
      const admin=cleanNick(q.adminCode)===ADMIN;
      if (!admin && !(await isRevealed())) return res.status(403).json({error:'아직 공개 전입니다.'});
      const subs=await allSubs();
      return res.json({results:subs.map(s=>view(s,subs)).filter(Boolean), map:meetMap(subs)});
    }
    if (action==='admin'){
      if (cleanNick(q.adminCode)!==ADMIN) return res.status(401).json({error:'관리자 이름이 아닙니다.'});
      const op=q.op;
      if (op==='list'){ const subs=await allSubs();
        return res.json({revealed:await isRevealed(), demo:usingMemory, subs:subs.map(s=>({nick:s.nick,at:s.at,assigned:s.assigned,locked:!!s.locked,
          top:s.top.map(t=>({id:t.id,score:t.score,name:BY_ID[t.id]?.name,work:BY_ID[t.id]?.work}))})), chars:CHARS.length}); }
      if (op==='dex'){ const subs=await allSubs(); return res.json({dex:subs.filter(s=>s.lives?.length).map(s=>({nick:s.nick,rep:Number.isInteger(s.rep)?s.rep:0,lives:s.lives.map(lifeCard)}))}); }
      if (op==='reassign') return res.json({ok:true,count:await reassign()});
      if (op==='chars') return res.json({chars:CHARS.map(c=>({id:c.id,name:c.name,work:c.work,image:imgOf(c.id),override:!!OVR[c.id]}))});
      if (op==='setImage'){ if(!BY_ID[q.id]) return res.status(400).json({error:'캐릭터를 찾을 수 없습니다.'});
        const url=String(q.url||'').trim(); if(url&&!/^https?:\/\//.test(url)) return res.status(400).json({error:'http로 시작하는 이미지 주소를 넣어 주세요.'});
        if(url) OVR[q.id]=url; else delete OVR[q.id]; await setJSON('img:overrides',OVR); return res.json({ok:true}); }
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
