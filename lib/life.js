// v3.1 전생 생애 — 시대 팩(data/packs/*.json)을 조립해 출생부터 죽음까지의 연표를 만든다.
// - 할 때마다 다른 생이 나온다(같은 답이어도). 답은 성향 → 일의 종류·사건과의 관계·인연의 모양·수명으로만 이어진다.
// - 연표는 모두 '최면 진술', 대표 사건 한 칸만 '기록 대조 · 일치'(실제 사실).
// - 현생 출생 연도만 받는다. 전생은 연도까지만 보여 준다.
import fs from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), 'data', 'packs');
const PK = {};
try { for (const f of fs.readdirSync(DIR)) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8')); PK[d.id] = d; } } catch {}
export const PACK_IDS = Object.keys(PK);

export const SLOTS = ['새벽', '아침', '낮', '저녁', '밤'];
export const SIBS = ['외동', '맏이', '둘째', '셋째', '넷째', '막내'];
export const LANDS = ['바다', '강', '산', '눈', '사막', '도시골목'];
export const FEARS = ['물', '불', '높은 곳', '좁은 곳', '큰 소리', '딱히 없음'];
export const MARKS = ['얼굴', '목', '어깨', '팔', '손', '가슴', '등', '다리', '발', '없음'];
export const GRADE_W = { N: 10, R: 6, SR: 3, SSR: 1 };
const RATE = (() => { const tot = PACK_IDS.reduce((a, id) => a + (GRADE_W[PK[id].grade] || 1), 0); const o = {}; for (const id of PACK_IDS) o[id] = Math.round((GRADE_W[PK[id].grade] || 1) / tot * 1000) / 10; return o; })();

/* ---------- 유틸 ---------- */
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const PAIR = { 이: '가', 은: '는', 을: '를', 과: '와', 아: '야', 이라: '라', 이여: '여', 이었: '였', 이다: '다' };
const jong = w => { const c = String(w).trim().slice(-1); return c >= '가' && c <= '힣' && (c.charCodeAt(0) - 0xAC00) % 28 !== 0; };
export const josa = (v, j) => {
  v = String(v);
  if (j === '으로') { const c = v.slice(-1); const rieul = c >= '가' && c <= '힣' && (c.charCodeAt(0) - 0xAC00) % 28 === 8; return v + (!jong(v) || rieul ? '로' : '으로'); }
  return v + (jong(v) ? j : (PAIR[j] ?? j));
};
const ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'], ONES_A = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
function kAge(n, attr) { n = Math.max(1, Math.min(99, n | 0)); const t = Math.floor(n / 10), o = n % 10; if (attr && n === 20) return '스무'; return TENS[t] + (attr ? ONES_A : ONES)[o]; }
function fill(t, ctx) {
  return String(t)
    .replace(/\{sib\}로/g, '{sib:으로}').replace(/\{sib\}였/g, '{sib:이었}')
    .replace(/\{(age_k|death_age_k)\}(\s?살)/g, (_, k, s) => kAge(ctx[k], true) + s)
    .replace(/\{([a-z_]+)(?::([^}]+))?\}/g, (_, k, j) => {
      let v = ctx[k]; if (k === 'age_k' || k === 'death_age_k') v = kAge(v, false);
      v = v ?? ''; return j ? josa(v, j) : String(v);
    });
}

/* ---------- 1) 계산: 플레이할 때마다 ---------- */
// input: {year, slot, sib, land, fear, mark}, prof: 성향, twin: 닮은 캐릭터, taken: 같은 팩 다른 사람의 대표 생 목록
export function planLife({ nick, input, prof, twin, answers, taken = [], salt = '' }) {
  if (!PACK_IDS.length || !input?.year) return null;
  const r = rng(`${nick}|${input.year}|${Object.values(answers || {}).join('')}|${salt}|${Date.now()}|${Math.random()}`);
  const pick = n => Math.floor(r() * n) % n;
  const v = prof?.v || { E: 0, M: 0, S: 0, X: 0 };
  let young = ['몰락', '회귀'].includes(twin?.arc); if (r() < 0.25) young = !young;
  // 팩 고르기: 레어도 가중치 × 끌리는 풍경
  const land = LANDS[input.land];
  const ids = PACK_IDS, w = ids.map(id => (GRADE_W[PK[id].grade] || 1) * (land && PK[id].terrain.includes(land) ? 1.8 : 1));
  let t = r() * w.reduce((a, c) => a + c, 0), k = 0; for (; k < ids.length - 1; k++) { t -= w[k]; if (t <= 0) break; }
  const P = PK[ids[k]], A = P.anchor.year, [Y0, Y1] = P.years, maxD = Math.min(1899, Y1 + 15);
  // 나이·사망 연도
  let plan = null;
  if (!young) for (let i = 0; i < 80 && !plan; i++) { const L = 55 + pick(32), age = 16 + pick(36), by = A - age, D = by + L; if (D > A + 4 && D <= maxD && by >= Y0 - 15) plan = { kind: 'old', by, D, age }; }
  if (!plan) { const age = 17 + pick(18), by = A - age, D = Math.min(maxD, A + pick(5)); plan = { kind: 'young', by, D: Math.max(D, A), age }; }
  // 조각 고르기: 같은 팩 사람과 겹치지 않게
  const used = new Set(taken.filter(x => x && x.pack === P.id).flatMap(x => [`job${x.job}`, `ev${x.rel}${x.evI}`, `bd${x.bond}${x.bondI}`, `lf${x.lifeI}`, `nw${x.newsI}`, `bt${x.birthI}`, `yt${x.youthI}`, `dt${x.kind}${x.deathI}`]));
  const free = (n, key) => { const all = [...Array(n).keys()]; const f = all.filter(i => !used.has(key(i))); const pool = f.length ? f : all; return pool[pick(pool.length)]; };
  const jobsAll = P.jobs.map((j, i) => i), fit = jobsAll.filter(i => P.jobs[i].out === (v.E >= 0));
  const jobPool = fit.filter(i => !used.has(`job${i}`)); const job = (jobPool.length ? jobPool : fit.length ? fit : jobsAll)[pick((jobPool.length ? jobPool : fit.length ? fit : jobsAll).length)];
  const NG = P.names_g || '', jg = P.jobs[job].g; const nPool = P.names.map((_, i) => i).filter(i => !jg || NG[i] === jg); const nameI = (nPool.length ? nPool : P.names.map((_, i) => i))[pick(nPool.length || P.names.length)];
  const REL = { 주인공: 'center', 조력자: 'side', 흑막: 'use', 감초: 'crowd', 엑스트라: 'unnamed', 라이벌: 'side' };
  let rel = REL[twin?.role] || ['center', 'side', 'crowd', 'unnamed'][pick(4)];
  if (r() < 0.3) rel = ['center', 'side', 'use', 'crowd', 'unnamed'][pick(5)]; // 운명의 장난
  if (v.M <= -1.5 && r() < 0.5) rel = 'use';
  const evI = free(P.event[rel].length, i => `ev${rel}${i}`);
  const bond = v.X > 0 ? (r() < 0.8 ? 'open' : 'hidden') : (r() < 0.8 ? 'hidden' : 'open');
  const bondI = free(P.bond[bond].length, i => `bd${bond}${i}`);
  return {
    v: 31, pack: P.id, grade: P.grade, kind: plan.kind, by: plan.by, dy: plan.D, age: plan.age, nowY: input.year,
    name: nameI, mate: pick(P.mates.length), place: pick(P.places.length),
    birthI: free(P.birth.length, i => `bt${i}`), youthI: free(P.youth.length, i => `yt${i}`), job, lifeI: free(P.life.length, i => `lf${i}`), newsI: free(P.news.length, i => `nw${i}`),
    rel, evI, bond, bondI, deathI: free(P.death[plan.kind].length, i => `dt${plan.kind}${i}`), last: answers?.q10 ?? pick(4), lastI: pick(3), propI: pick(PROP.length),
    newsAge: 14 + pick(Math.max(1, plan.D - plan.by - 14)),
    slot: Number.isInteger(input.slot) ? input.slot : null, sib: Number.isInteger(input.sib) ? input.sib : null,
    land: Number.isInteger(input.land) ? input.land : null, fear: Number.isInteger(input.fear) ? input.fear : null, mark: Number.isInteger(input.mark) ? input.mark : null,
    at: Date.now(),
  };
}

/* ---------- 2) 그리기 ---------- */
// 마지막으로 떠올린 것: 어떤 죽음 장면 뒤에 붙어도 어긋나지 않도록 속마음만 쓴다 (Q10의 정서만 빌림)
const LAST = [
  ['마지막으로 당신이 붙든 생각은 아직 끝난 게 아니라는 것이었습니다. 덜 끝낸 일들이 그 생 너머까지 당신을 따라왔지요.', '마지막 순간까지 당신은 내일 할 일을 하나 더 헤아리고 있었습니다. 그 일은 결국 다음 생으로 미뤄졌습니다.', '마지막에 당신의 마음에 남은 건 포기가 아니라 오기였습니다. 끝은 내가 정한다는, 아주 고집스러운 마음이었지요.'],
  ['마지막으로 당신의 마음을 스친 건 고마운 얼굴들이었습니다. 하나하나 인사하지는 못했지만, 마음은 이미 다 전한 것 같았지요.', '마지막에 남은 건 원망이 아니라 고마움이었습니다. 받은 것이 많은 생이었다고, 당신은 생각했습니다.', '마지막 순간 당신은 그동안 신세 진 이름들을 속으로 하나씩 불러 보았습니다. 끝까지 다 부르기엔 그 생이 조금 짧았지요.'],
  ['마지막으로 당신은 속으로 약속 하나를 했습니다. 이번엔 여기까지지만, 다음엔 꼭 끝까지 가 보겠다고.', '못다 한 말이 하나 남아 있었습니다. 그 말은 접힌 채로, 아주 오랫동안 당신을 따라왔습니다.', '마지막으로 당신은 다음 생에 할 일을 하나 정해 두었습니다. 이번에 미룬 그 일만은, 다음엔 꼭 먼저 하겠다고.'],
  ['이상하게도 마지막으로 떠오른 건 먹다 남긴 {soup} 한 그릇이었습니다. 다 먹고 올걸, 하는 생각이 그 생의 마지막 생각이었지요.', '마지막 순간에도 당신은 엉뚱하게 오늘 저녁 무엇을 먹을지 생각하고 있었습니다. 끝까지 당신다운 마지막이었습니다.', '마지막으로 당신의 마음을 채운 건 {food} 냄새의 기억이었습니다. 그 냄새는 생을 건너서도 지워지지 않았지요.'],
];
const PROP = ['{prop:은} 마지막 날까지 몸이 기억하고 있었습니다.', '{prop:은} 당신이 떠난 뒤에도 한참 그 자리에 남아 있었지요.', '눈을 감기 전, 당신은 {prop}의 감촉을 한 번 더 떠올렸습니다.'];
const MARK_T = { 얼굴: '그 시절 햇볕과 바람을 가장 먼저 맞던 자리지요.', 목: '무거운 것을 지고 고개를 숙이던 자리입니다.', 어깨: '매일 같은 곳에 짐이 얹히던 자리입니다.', 팔: '소매를 걷어붙이고 일하던 팔, 무언가에 쓸리곤 하던 자리입니다.', 손: '평생 일을 쥐던 손이니, 흔적이 남는 것도 무리는 아니지요.', 가슴: '누군가를 끌어안던 자리입니다.', 등: '등 뒤에서 누군가 당신을 부르던 날의 자리입니다.', 다리: '하루에도 수십 리를 걷던 다리였지요.', 발: '{place:의} 땅을 가장 많이 밟은 곳입니다.' };
const FEAR_T = { 물: ['바다', '강'], '높은 곳': ['산'], '좁은 곳': ['도시골목'] };
const FEAR_L = { 물: '깊은 물 앞에서 한 발 물러서게 되는 건, {place:의} 물빛을 몸이 아직 기억하기 때문입니다.', 불: '타오르는 불 앞에서 괜히 숨을 참게 되는 건, 그 시절 어느 밤의 열기가 남아 있어서입니다.', '높은 곳': '높은 곳에서 아래를 내려다볼 때 발끝이 저린 건, 그 시절의 어느 비탈이 아직 몸에 남아서입니다.', '좁은 곳': '좁은 곳에서 숨이 막히는 건, 그 시절 사람들 틈에 끼어 오도 가도 못하던 날이 있었기 때문입니다.', '큰 소리': '큰 소리에 유난히 놀라는 건, 그 시절 어느 날의 굉음이 아직 귀에 남아서입니다.', '딱히 없음': '무서운 게 별로 없는 건, 웬만한 일은 그 시절에 이미 한 번 다 겪어 보았기 때문입니다.' };
const FEAR_ALT = { 물: '깊은 물 앞에서 한 발 물러서게 되는 건, 그 시절 당신이 물가를 멀리하며 살았기 때문입니다. 그 버릇은 생을 건너서도 남았지요.', '높은 곳': '높은 곳에서 발끝이 저린 건, 그 시절 당신이 평생 낮은 땅에서만 살았기 때문입니다.', '좁은 곳': '좁은 곳에서 숨이 막히는 건, 그 시절 당신이 늘 탁 트인 곳에서 일했기 때문입니다.' };
const LAND_W = { 바다: /바다|바닷|파도|갯벌|포구|항구|뱃/, 강: /강|나루|운하/, 산: /산|고개|봉우리|비탈/, 눈: /눈발|눈이|눈 덮|얼음|서리/, 사막: /사막|모래/, 도시골목: /골목|장터|시전|거리|광장/ };
const JOB_L = { '콘텐츠·편집': '현생에서 이야기를 만지는 일을 하는 건, {place:에서} 보고 들은 것을 언젠가 누군가에게 전하고 싶었기 때문입니다.', 개발: '현생에서 무언가를 짜고 고치는 일을 하는 건, {job:으로} 살며 익힌 손끝의 요령이 남아서입니다.', 디자인: '현생에서 보기 좋은 것을 만드는 일을 하는 건, 그 시절 {place:의} 빛깔을 아직 기억하기 때문입니다.', '사업·마케팅': '현생에서 사람과 사람을 잇는 일을 하는 건, 그 시절 오가던 사람들의 흥정 소리가 몸에 배어서입니다.', 경영지원: '현생에서 남들이 잘 일하도록 뒤를 받치는 일을 하는 건, 그 시절에도 당신이 늘 누군가의 뒤를 받쳤기 때문입니다.', 기타: '현생의 일이 무엇이든, 당신은 {job:으로} 살던 그때처럼 묵묵히 해내고 있을 겁니다.' };
const SUDDEN = /물살|휩쓸|떨어|무너|불길|사고|파도|해일|쓰러|덮쳐|깔려/;

export function renderLife(p, sub) {
  const P = PK[p?.pack]; if (!P) return null;
  const job = P.jobs[p.job] || P.jobs[0];
  const deathAge = p.dy - p.by;
  const ctx = { name: P.names[p.name % P.names.length], mate: P.mates[p.mate % P.mates.length], place: P.places[p.place % P.places.length], job: job.job, prop: job.prop || job.job,
    birth_year: p.by, sib: p.sib != null ? SIBS[p.sib] : '평범한 집안의 아이', age_k: p.age, death_year: p.dy, death_age_k: deathAge,
    food: P.region === '조선' ? '밥 짓는' : '빵 굽는', soup: P.region === '조선' ? '국' : '수프' };
  const F = t => fill(p.sib == null ? String(t).replace(/\{sib\}로 태어났습니다/g, '태어났습니다').replace(/\{sib\}로,?\s?/g, '') : t, ctx);
  const deathText = P.death[p.kind][p.deathI % P.death[p.kind].length];
  const sudden = p.kind === 'young' && SUDDEN.test(deathText);
  const last = fill(LAST[Math.max(0, Math.min(3, p.last | 0))][p.lastI % 3], ctx);
  const timed = /새벽|아침|한낮|낮에|낮잠|오후|저녁|밤|해 질|해가 지|동틀|날이 밝|잠이 들|잠들|잠든|잠에/.test(deathText);
  const propLine = sudden ? '' : ' ' + fill(PROP[p.propI % PROP.length], ctx);
  const mateLine = deathText.includes('{mate}') ? '' : ' ' + fill(p.bond === 'open' ? '마지막으로 떠오른 얼굴들 가운데 {mate}도 있었습니다.' : '{mate}에게 끝내 하지 못한 말은 마지막까지 마음 한쪽에 접혀 있었습니다.', ctx);
  const slot = p.slot != null ? SLOTS[p.slot] : null;
  const timeline = [
    { when: `${p.by}`, tag: '출생', text: F(P.birth[p.birthI % P.birth.length]) },
    { when: `${p.by + 7}~`, tag: '자라던 날들', text: F(P.youth[p.youthI % P.youth.length]) },
    { when: `${Math.min(P.anchor.year - 1, p.by + 18)}~`, tag: job.job, text: F(job.text) },
    { when: '', tag: '어느 날', text: F(P.life[p.lifeI % P.life.length]) },
    { when: `${Math.min(p.dy, p.by + p.newsAge)}`, tag: '그해 들려온 소문', text: F(P.news[p.newsI % P.news.length]) },
    { when: `${P.anchor.year}`, tag: P.anchor.title, text: F(P.event[p.rel][p.evI % P.event[p.rel].length]), real: true },
    { when: '', tag: p.bond === 'open' ? `${ctx.mate} · 인연` : `${ctx.mate} · 말하지 못한 마음`, text: F(P.bond[p.bond][p.bondI % P.bond[p.bond].length]) },
    { when: `${p.dy}`, tag: '마지막', core: F(deathText), text: F(deathText) + (p.propI % 2 ? mateLine || propLine : propLine || mateLine) + ' ' + last + (slot && !timed ? ` 당신이 눈을 감은 건 ${slot}${jong(slot) ? '이었' : '였'}습니다.` : '') },
    { when: `${p.dy} → ${p.nowY}`, tag: '영혼이 쉬어 간 시간', text: `당신의 영혼은 ${p.nowY - p.dy}년 가까이 쉬었습니다. 그리고 ${p.nowY}년, 다시 태어났습니다.` },
  ];
  // 시간 순서: '그해 소문'을 연도 순으로 끼워 넣기
  const news = timeline.splice(4, 1)[0]; const ny = +news.when;
  const at = ny < P.anchor.year ? 4 : 6; timeline.splice(at, 0, news);
  const all = timeline.map(t => t.text).join(' ');
  const traces = [];
  if (p.mark != null && MARKS[p.mark] !== '없음') traces.push(`${josa(MARKS[p.mark], '의')} 점이나 흉터는 ${fill('{job:으로}', ctx)} 살던 시절의 흔적입니다. ${fill(MARK_T[MARKS[p.mark]], ctx)}`);
  if (p.fear != null) { const fw = FEARS[p.fear], near = (FEAR_T[fw] || []).some(x => P.terrain.includes(x)) || (fw === '물' && LAND_W.바다.test(all)); traces.push(fill(near || !FEAR_ALT[fw] ? FEAR_L[fw] : FEAR_ALT[fw], ctx)); }
  if (p.land != null) { const L = LANDS[p.land], lw = L === '도시골목' ? '도시의 골목' : L, seen = P.terrain.includes(L) || LAND_W[L]?.test(all);
    traces.push(seen ? `까닭 없이 ${josa(lw, '에')} 끌리는 건, ${fill('{place:에서}', ctx)} 보던 풍경이 아직 눈에 남아 있기 때문입니다.` : `까닭 없이 ${josa(lw, '에')} 끌리는 건, 그 시절 끝내 가 보지 못한 곳이었기 때문입니다.`); }
  if (sub?.job && JOB_L[sub.job]) traces.push(fill(JOB_L[sub.job], ctx));
  return {
    profile: { pack: P.id, slot: p.slot, g: (P.names_g || '')[p.name % P.names.length] || 'm', ni: p.name % P.names.length, jobI: p.job % P.jobs.length, name: ctx.name, era: P.title, region: P.region, place: ctx.place, job: job.job, by: p.by, dy: p.dy, deathAge, sib: ctx.sib, mate: ctx.mate,
      anchor: { year: P.anchor.year, title: P.anchor.title }, gap: p.nowY - p.dy, grade: p.grade || P.grade, rate: RATE[P.id] },
    timeline, traces,
    note: { said: timeline.length - 1, matched: 1, fact: P.anchor.fact, source: P.anchor.source },
  };
}
export function lifeCard(p) { const R = renderLife(p); if (!R) return null; const x = R.profile; return { name: x.name, era: x.era, job: x.job, by: x.by, dy: x.dy, grade: x.grade, rate: x.rate, anchor: x.anchor.year + ' ' + x.anchor.title }; }

const REL_ACT = { center: ['일이 터지면 늘 그 한복판으로 먼저 걸어 들어갔습니다', '남들이 망설일 때 맨 앞에 서 있었습니다'], side: ['늘 누군가의 곁에서 묵묵히 일을 받쳤습니다', '앞에 나서기보다 옆에서 판이 굴러가게 했습니다'],
  use: ['판이 바뀔 때 남보다 먼저 움직였습니다', '남들이 놀라는 사이 이득이 어디 있는지 먼저 알아봤습니다'], crowd: ['큰일이 나면 구경하고, 그 이야기를 부풀려 퍼뜨렸습니다', '어디서든 소문의 맨 앞자리에 있었습니다'],
  unnamed: ['기록에 이름 한 줄 남기지 않고도 제 몫을 해냈습니다', '아무도 기억하지 않는 자리에서 끝까지 버텼습니다'] };
export function echoLine(p, charName, act) {
  const P = PK[p?.pack]; if (!P || !act) return null;
  const name = P.names[p.name % P.names.length], ra = REL_ACT[p.rel] || REL_ACT.side;
  return `${josa(name, '은')} ${ra[p.evI % 2]}. 다른 세계의 ${charName}도 ${act} 같은 영혼이 두 번 산 흔적입니다.`;
}
