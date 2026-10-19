// 레어도 산출 — 가상 응답 N건에서 각 캐릭터가 최종 결과로 나온 비율로 SSR·SR·R·N을 매긴다.
// node scripts/rarity.js [건수=50000] → data/rarity.json  (DB나 문항 배점을 바꾸면 다시 돌릴 것)
import fs from 'fs';
import { buildProfile, rank, wobble } from '../lib/match.js';
import { Q, ORDER } from '../lib/questions.js';
const chars=JSON.parse(fs.readFileSync('data/characters.json','utf-8'));
const N=Number(process.argv[2]||50000);
let seed=20261016; const rnd=()=>{seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;};
const hit=Object.fromEntries(chars.map(c=>[c.id,0]));
for(let i=0;i<N;i++){
  const answers={}, timings={};
  for(const q of ORDER){ answers[q]=Math.floor(rnd()*Q[q].opts.length); timings[q]=1000+rnd()*9000; }
  const prof=buildProfile({answers,timings,changes:Math.floor(rnd()*4)});
  hit[wobble(rank(prof,chars,null),rnd)[0].id]++;
}
const sorted=chars.map(c=>({id:c.id,rate:hit[c.id]/N})).sort((a,b)=>a.rate-b.rate);
const cut=[[0.10,'SSR'],[0.30,'SR'],[0.60,'R'],[1.01,'N']];   // 가장 드문 10% / 다음 20% / 30% / 나머지 40%
const out={};
sorted.forEach((x,i)=>{ const p=i/sorted.length; out[x.id]={g:cut.find(([c])=>p<c)[1], rate:+(x.rate*100).toFixed(3), n:i+1}; });  // n: 드문 순서 (1 = 가장 드묾)
fs.writeFileSync('data/rarity.json',JSON.stringify(out));
const cnt={}; for(const v of Object.values(out)) cnt[v.g]=(cnt[v.g]||0)+1;
console.log(`응답 ${N}건 · 등급 분포`,cnt);
for(const g of ['SSR','SR','R','N']){ const r=Object.values(out).filter(v=>v.g===g).map(v=>v.rate); console.log(g, `확률 ${Math.min(...r)}% ~ ${Math.max(...r)}%`); }
