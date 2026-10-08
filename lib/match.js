import { Q, ORDER, COMBOS, ANCHOR_WEIGHT, SCENE, READING, DIFF, REGRET } from './questions.js';


// 받침에 따라 조사 선택
const hasJong=w=>{ const ch=String(w).trim().slice(-1).charCodeAt(0); return ch>=0xAC00&&ch<=0xD7A3 ? (ch-0xAC00)%28!==0 : false; };
const J=(w,a,b)=>w+(hasJong(w)?a:b);

const AX = ['E','M','S','X'];
const CATS = ['world','role','solve','emo','arc'];
const W = { axis:1.0, world:2.5, role:2.0, solve:1.2, emo:1.0, arc:1.2, tag:0.45, tagCap:2.2, look:0.2 };
const MAX_SCORE = 4*W.axis + W.world + W.role + W.solve + W.emo + W.arc + W.tagCap + W.look;

function add(prof, d, k=1){
  for (const a of AX) if (d[a]) prof.ax[a] += d[a]*k;
  for (const c of CATS) if (d[c]) for (const [key,v] of Object.entries(d[c])) prof[c][key]=(prof[c][key]||0)+v*k;
}
function norm(obj){ const m=Math.max(0,...Object.values(obj)); const o={}; for(const k in obj) o[k]=m>0?Math.max(0,obj[k])/m:0; return o; }

// answers: {q1:idx,...}, timings: {q1:ms,...}, changes: n, skipped: bool, look: idx|null
export function buildProfile({answers, timings={}, changes=0, skipped=false}){
  const prof={ax:{E:0,M:0,S:0,X:0},world:{},role:{},solve:{},emo:{},arc:{},tags:[],combos:[],uncon:null};
  for (const q of ORDER){
    const i=answers[q]; const opt=Q[q].opts[i]; if(!opt) continue;
    add(prof,opt.d,Q[q].anchor?ANCHOR_WEIGHT:1); prof.tags.push(opt.tag);
  }
  for (const c of COMBOS){
    if (Object.entries(c.when).every(([q,i])=>answers[q]===i)){ add(prof,c.d); prof.combos.push(c); }
  }
  // 무의식 신호 (영향력 작게)
  const ts=ORDER.map(q=>Math.min(30000,Math.max(0,timings[q]||0))).filter(Boolean);
  if (ts.length){
    const avg=ts.reduce((a,b)=>a+b,0)/ts.length;
    let maxQ=ORDER[0]; for(const q of ORDER) if((timings[q]||0)>(timings[maxQ]||0)) maxQ=q;
    const maxSec=(Math.min(30000,timings[maxQ]||0)/1000).toFixed(1);
    let type='보통';
    if (avg>7000 || changes>=3){ type='신중'; add(prof,{X:-0.5,solve:{두뇌:0.3}}); }
    else if (avg<2500 || skipped){ type='성급'; add(prof,{X:0.5,emo:{직진:0.3}}); }
    prof.uncon={type,avg:Math.round(avg),maxQ,maxSec,changes,skipped};
  }
  const v={}; for(const a of AX) v[a]=3+2*Math.tanh(prof.ax[a]/4);
  prof.v=v;
  for (const c of CATS) prof[c+'N']=norm(prof[c]);
  return prof;
}

export function idfMap(chars){
  const df={}; for(const c of chars) for(const t of new Set(c.tags)) df[t]=(df[t]||0)+1;
  const n=chars.length, idf={}; for(const t in df) idf[t]=Math.log(1+n/df[t]); return idf;
}

export function scoreChar(prof, c, idf, look){
  let s=0;
  for (const a of AX) s+=W.axis*(1-Math.abs(prof.v[a]-c.axes[a])/4);
  s+=W.world*Math.max(0,...c.world.map(w=>prof.worldN[w]||0));
  s+=W.role*(prof.roleN[c.role]||0);
  s+=W.solve*(prof.solveN[c.solve]||0);
  s+=W.emo*(prof.emoN[c.emo]||0);
  s+=W.arc*(prof.arcN[c.arc]||0);
  const shared=c.tags.filter(t=>prof.tags.includes(t));
  s+=Math.min(W.tagCap, W.tag*shared.reduce((a,t)=>a+(idf[t]||1),0));
  // 엑스트라는 희귀 전생: 이름 없는 쪽으로 강하게 기운 응답에서만 나오도록
  if (c.role==='엑스트라' && (prof.role['엑스트라']||0)<2.5) s*=0.75;
  if (look){ let m=0,k=0; for(const key of Object.keys(look)){ k++; if(c.look[key]===look[key]) m++; } if(k) s+=W.look*m/k; }
  return { s, shared };
}

export function rank(prof, chars, look){
  const idf=idfMap(chars);
  return chars.map(c=>({ id:c.id, ...scoreChar(prof,c,idf,look) }))
    .sort((a,b)=>b.s-a.s).slice(0,10).map(x=>({id:x.id,score:+x.s.toFixed(4),shared:x.shared}));
}

// 흔들리는 1위: 1위 대비 10% 이내 상위 5명 중 점수 비례 추첨 → 첫 순서로
export function wobble(top, rnd=Math.random){
  const best=top[0].score; const pool=top.filter(t=>t.score>=best*0.9).slice(0,5);
  const sum=pool.reduce((a,t)=>a+t.score,0); let r=rnd()*sum, pick=pool[0];
  for(const t of pool){ r-=t.score; if(r<=0){ pick=t; break; } }
  return [pick, ...top.filter(t=>t.id!==pick.id)];
}

export const LOOK_OPTS=[{glasses:true},{hair:'short'},{hair:'long'},{vibe:'sharp'},{vibe:'soft'}];

const ERA = { 학원:'종소리가 하루를 나누던 교실의 시대', 현대:'출근 지하철이 가득 차던 도시의 시대', 무협:'강호에 피바람이 불던 시대', 판타지:'검과 마법, 그리고 탑이 있던 세계', 스릴러:'세상이 무너져 내리던 시대', 로맨스:'한 사람의 마음이 세계의 전부였던 시절', 일상:'별일 없이 흘러가던 평화로운 나날' };
const ROLE = { 주인공:'이야기의 한가운데에 선 사람', 라이벌:'주인공이 끝내 넘어서야 했던 사람', 조력자:'누군가의 곁에서 판을 지탱한 사람', 흑막:'모든 일의 뒤편에 있던 사람', 감초:'모두의 긴장을 풀어 주던 사람', 엑스트라:'이름이 크레딧 끝자락에 겨우 남은 사람' };
const BELIEF = ['처음부터 믿고 들어오신 만큼, 기억이 아주 선명하게 떠올랐습니다.','반신반의하셨지만, 의식은 생각보다 깊이 내려갔습니다.','전혀 안 믿는다고 하셨죠. 그런데 꽤 깊이 들어가셨습니다.'];

const KARMA = {
  '콘텐츠·편집': c=>`전생에 ${c.work}의 운명을 직접 겪은 업보로, 현생에서는 남의 이야기를 고치고 다듬으며 살고 계십니다.`,
  '개발': c=>c.arc==='회귀'?'전생에 몇 번이고 다시 시작한 업보로, 현생에서도 롤백과 재배포를 반복하고 계십니다.':'전생에 세계의 규칙을 몸으로 익힌 업보로, 현생에서는 그 규칙을 코드로 짜고 계십니다.',
  '디자인': c=>`전생에 ${c.name}의 얼굴로 너무 많은 명장면을 남긴 업보로, 현생에서는 한 컷 한 픽셀에 집착하고 계십니다.`,
  '사업·마케팅': c=>c.solve==='사교'||c.solve==='두뇌'?'전생에 사람과 판을 움직이던 업보로, 현생에서도 숫자와 사람 사이에서 판을 짜고 계십니다.':'전생에 정면 돌파만 하던 업보로, 현생에서는 숫자 앞에서 정면 돌파를 하고 계십니다.',
  '경영지원': c=>'전생에 누군가의 뒤를 지키던 업보로, 현생에서는 회사 전체의 뒤를 지키고 계십니다.',
  '기타': c=>`전생의 ${J(c.name,'이','가')} 남긴 버릇 하나가, 아직 현생의 당신에게 남아 있습니다.`,
};

export function buildResult(sub, char, chars){
  const prof=buildProfile(sub);
  const idf=idfMap(chars);
  const { s, shared }=scoreChar(prof,char,idf,sub.look!=null?LOOK_OPTS[sub.look]:null);
  const depth=Math.round(60+39*Math.min(1,Math.max(0,(s/MAX_SCORE-0.35)/0.45)));
  // 단서: 선택지를 되풀이하지 않고, 두 장면을 묶어 한 사람을 돌려 말한다
  const tagQ={}; for(const q of ORDER){ const o=Q[q].opts[sub.answers[q]]; if(o) tagQ[o.tag]=q; }
  const hits=[...shared].sort((a,b)=>(idf[b]||0)-(idf[a]||0));
  const clues=[];
  for (let k=0; k<hits.length && clues.length<2; k+=2){
    const a=hits[k], b=hits[k+1];
    clues.push(b
      ? `「${SCENE[tagQ[a]]}」${hasJong(SCENE[tagQ[a]])?'과':'와'} 「${SCENE[tagQ[b]]}」. 서로 다른 두 장면이 같은 사람을 가리킵니다 — ${READING[a]}.`
      : `「${SCENE[tagQ[a]]}」에 그 사람의 흔적이 짙게 남아 있었습니다 — ${READING[a]}.`);
  }
  const fits=cb=>Object.entries(cb.d).some(([k,v])=>typeof v==='object'&&Object.keys(v).some(x=>k==='world'?char.world.includes(x):char[k]===x));
  const combo=prof.combos.find(fits);
  if (combo) clues.push('숨은 연결 — '+combo.ev+'.');
  if (clues.length<3){
    const t=char.tags.find(t=>!shared.includes(t));
    if (t) clues.push(`당신이 떠올리지 못한 장면도 있습니다. 기록에는 ${READING[t]}(이)라는 메모가 남아 있습니다.`.replace('이(이)라는','이라는'));
  }
  // 현생으로 넘어오며 달라진 것: 가장 크게 다른 축
  let diff=null, gap=0;
  for (const a of ['E','M','S','X']){ const d=char.axes[a]-prof.v[a]; if(Math.abs(d)>gap){gap=Math.abs(d); diff=DIFF[a][d>0?0:1];} }
  if (gap<0.8) diff='전생과 현생이 거의 그대로입니다. 영혼이 이사를 하면서 짐을 하나도 안 버렸습니다.';
  // 최면사의 메모
  const u=prof.uncon||{};
  const memo = sub.skipped ? '호흡 유도를 건너뛰셨습니다. 그런데도 여기까지 내려오셨군요.'
    : (sub.belief===2 && depth>=85) ? '안 믿는다고 하신 분 중에서 가장 깊이 내려간 축입니다.'
    : u.type==='성급' ? `모든 장면을 평균 ${(u.avg/1000).toFixed(1)}초 만에 지나갔습니다. 영혼이 급한 편입니다.`
    : u.type==='신중' ? `「${SCENE[u.maxQ]}」 앞에서 ${u.maxSec}초 머물렀습니다. 그곳에 무언가 두고 오신 것 같습니다.`
    : depth<72 ? '의식이 끝까지 조금 저항했습니다. 다음 생엔 더 깊이 들어가 보시죠.'
    : '특이사항 없음. 아주 평범하게 비범한 영혼입니다.';
  const story=[
    `당신은 ${ERA[char.world[0]]||'이름 모를 시대'}에 살았습니다.`,
    `${char.work}의 세계에서, 당신은 ${ROLE[char.role]||'한 사람'}이었습니다.`,
    `사람들은 당신을 ${J(char.name,'이라고','라고')} 불렀습니다. ${char.scene}.`,
    BELIEF[sub.belief??1],
    sub.free ? `당신이 떠올린 장면, "${String(sub.free).slice(0,60)}". 그건 아마 그 시절의 어느 하루였을 겁니다.` : '',
  ].filter(Boolean);
  const karma = sub.job && KARMA[sub.job] ? KARMA[sub.job](char) : null;
  const regret = REGRET[sub.answers.q10] || null;
  return { char, depth, evidence:clues.slice(0,3), story, karma, diff, memo, regret, quote:char.quote||'', uncon:prof.uncon };
}
