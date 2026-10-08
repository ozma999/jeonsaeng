// 가상 응답 시뮬레이션 — 결과 분포와 의외성 장치 강도를 점검한다.  node scripts/simulate.js [건수]
import fs from 'fs';
import { buildProfile, rank, wobble } from '../lib/match.js';
import { Q, ORDER } from '../lib/questions.js';
const chars=JSON.parse(fs.readFileSync('data/characters.json','utf-8'));
const N=Number(process.argv[2]||1000);
const top1={}, picked={}, inTop10={}; let gap=0, combos=0;
for (let i=0;i<N;i++){
  const answers={}, timings={};
  for (const q of ORDER){ answers[q]=Math.floor(Math.random()*Q[q].opts.length); timings[q]=1000+Math.random()*9000; }
  const prof=buildProfile({answers,timings,changes:Math.floor(Math.random()*4)});
  combos+=prof.combos.length?1:0;
  const top=rank(prof,chars,null); const w=wobble(top);
  top1[top[0].id]=(top1[top[0].id]||0)+1; picked[w[0].id]=(picked[w[0].id]||0)+1;
  for(const t of top) inTop10[t.id]=(inTop10[t.id]||0)+1;
  gap+=(top[0].score-w[0].score)/top[0].score;
}
const sortE=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
const p=sortE(picked);
console.log(`응답 ${N}건 · 캐릭터 ${chars.length}명`);
console.log(`최종 결과로 한 번 이상 나온 캐릭터: ${p.length}/${chars.length}`);
console.log(`가장 자주 나온 5명:`, p.slice(0,5).map(([k,v])=>`${k} ${(v/N*100).toFixed(1)}%`).join(', '));
console.log(`후보 10위 안에 한 번도 못 든 캐릭터:`, chars.filter(c=>!inTop10[c.id]).map(c=>c.id).join(', ')||'없음');
console.log(`최종 결과로 한 번도 안 나온 캐릭터:`, chars.filter(c=>!picked[c.id]).map(c=>c.id).join(', ')||'없음');
console.log(`1위 후보와 최종 결과의 평균 점수 차: ${(gap/N*100).toFixed(2)}% (목표 5% 이내)`);
console.log(`조합 규칙이 하나 이상 발동한 비율: ${(combos/N*100).toFixed(1)}%`);
