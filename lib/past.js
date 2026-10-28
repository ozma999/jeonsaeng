// v3 전생 생애 — 실제 역사 장면(data/scenes/*.json)에 전생을 배치하고, 출생부터 죽음·환생까지의 연표를 만든다.
// 답은 문장에 그대로 쓰지 않는다: 성향(axes)·닮은 캐릭터의 역할/서사 → 사건과의 관계·직업·수명으로만 이어진다.
// 생년월일은 저장하지 않는다. planPast()가 만든 계산값(장면·인덱스·전생 날짜·환생 간격)만 저장된다.
import fs from 'fs';
import path from 'path';

const DIR = path.join(process.cwd(), 'data', 'scenes');
const SC = {};
try { for (const f of fs.readdirSync(DIR)) if (f.endsWith('.json')) { const d = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf-8')); SC[d.id] = d; } } catch {}
export const SCENE_IDS = Object.keys(SC);

/* ---------- 입력 선택지 (화면과 같은 순서) ---------- */
export const SLOTS = ['새벽', '아침', '낮', '저녁', '밤'];
export const SIBS = ['외동', '맏이', '둘째', '셋째', '넷째', '막내'];
export const LANDS = ['바다', '강', '산', '눈', '사막', '도시골목'];
export const FEARS = ['물', '불', '높은 곳', '좁은 곳', '큰 소리', '딱히 없음'];
export const MARKS = ['얼굴', '목', '어깨', '팔', '손', '가슴', '등', '다리', '발', '없음'];

/* ---------- 유틸 ---------- */
function rng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const PAIR = { 이: '가', 은: '는', 을: '를', 과: '와', 아: '야', 이라: '라', 이여: '여', 이었: '였', 이다: '다' };
const jong = w => { const c = String(w).trim().slice(-1); return c >= '가' && c <= '힣' && (c.charCodeAt(0) - 0xAC00) % 28 !== 0; };
const josa = (v, j) => {
  if (j === '으로') { const c = String(v).slice(-1); const rieul = c >= '가' && c <= '힣' && (c.charCodeAt(0) - 0xAC00) % 28 === 8; return v + (!jong(v) || rieul ? '로' : '으로'); }
  return v + (jong(v) ? j : (PAIR[j] ?? j));
};
// 나이: 고유어 (뒤에 '살'이 오면 관형형: 스무 살, 서른두 살)
const ONES = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'], ONES_A = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];
const TENS = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
function kAge(n, attr) { n = Math.max(1, Math.min(99, n | 0)); const t = Math.floor(n / 10), o = n % 10;
  if (attr && n === 20) return '스무'; return TENS[t] + (attr ? ONES_A : ONES)[o]; }
function fill(t, ctx) {
  return String(t)
    .replace(/\{sib\}로/g, '{sib:으로}').replace(/\{sib\}였/g, '{sib:이었}')
    .replace(/\{(age_k|death_age_k)\}(\s?살)/g, (_, k, s) => kAge(ctx[k], true) + s)
    .replace(/\{([a-z_]+)(?::([^}]+))?\}/g, (_, k, j) => {
      let v = ctx[k]; if (k === 'age_k' || k === 'death_age_k') v = kAge(v, false);
      v = v ?? ''; return j ? josa(String(v), j) : String(v);
    });
}
const yearsIn = t => (String(t).match(/1[5-9]\d\d(?=년)/g) || []).map(Number);
const monthOf = s => { const m = String(s || '').match(/(\d{1,2})월/); return m ? +m[1] : 12; };
const DIM = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function diffYMD(a, b) { // a(전생 사망) → b(현생 출생)
  let y = b.y - a.y, m = b.m - a.m, d = b.d - a.d;
  if (d < 0) { m--; d += DIM(b.m === 1 ? b.y - 1 : b.y, b.m === 1 ? 12 : b.m - 1); }
  if (m < 0) { y--; m += 12; }
  return { y, m, d };
}

/* ---------- 1) 계산: 제출 때 한 번 ---------- */
// input: {birth:{y,m,d}, slot, sib, land, fear, mark, deja}, prof: buildProfile 결과, twin: 닮은 캐릭터(role, arc)
export function planPast({ nick, input, prof, twin, answers }) {
  const b = input.birth; if (!b || !SCENE_IDS.length) return null;
  const r = rng(`${nick}|${b.y}-${b.m}-${b.d}|${Object.values(answers || {}).join('')}`);
  const pick = n => Math.floor(r() * n) % n;
  const v = prof?.v || { E: 0, M: 0, S: 0, X: 0 };
  // 젊어서 / 늙어서
  let young = ['몰락', '회귀'].includes(twin?.arc); if (r() < 0.2) young = !young;
  // 장면 고르기: 데자뷔 지명 > 끌리는 풍경·무서운 것 가중치 > 조선/세계 반반
  const land = LANDS[input.land], fear = FEARS[input.fear];
  const FEAR_T = { 물: ['바다', '강'], 불: ['도시골목'], '높은 곳': ['산'], '좁은 곳': ['도시골목'], '큰 소리': ['바다', '도시골목'] };
  let cands = SCENE_IDS.map(id => SC[id]);
  const deja = String(input.deja || '').trim();
  const dejaHit = deja && cands.filter(s => [s.place_then, s.place_now].join(' ').split(/[\s,·()]+/).some(w => w.length >= 2 && deja.includes(w)));
  if (dejaHit && dejaHit.length) cands = dejaHit;
  else { const region = r() < 0.5 ? '조선' : '세계'; const same = cands.filter(s => s.region === region); if (same.length) cands = same; }
  const w = cands.map(s => { let x = 1; if (land && s.terrain.includes(land)) x += 3; if (FEAR_T[fear] && s.terrain.some(t => FEAR_T[fear].includes(t))) x += 1.5;
    if (!young && s.anchor.year > 1888) x *= 0.15; return x; });
  let t = r() * w.reduce((a, c) => a + c, 0), si = 0; for (; si < cands.length - 1; si++) { t -= w[si]; if (t <= 0) break; }
  const S = cands[si], A = S.anchor.year;
  // 나이·수명·사망
  const dIdxY = pick(2), dIdxO = pick(2);
  const minY = Math.max(A, ...yearsIn(S.death.young[dIdxY])), minO = Math.max(A + 6, ...yearsIn(S.death.old[dIdxO]));
  let plan = null;
  if (!young) for (let k = 0; k < 60 && !plan; k++) {
    const D = minO + pick(Math.max(1, 1900 - minO)); if (D > 1899) continue;
    const L = 58 + pick(29), by = D - L, age = A - by;
    if (age >= 16 && age <= 52) plan = { kind: 'old', di: dIdxO, by, D, age };
  }
  if (!plan) { const age = 17 + pick(18), by = A - age, D = Math.min(1899, Math.max(minY, A + pick(5))); plan = { kind: 'young', di: dIdxY, by, D, age }; }
  const am = monthOf(S.anchor.date);
  const dtext = S.death[plan.kind][plan.di] || '';
  const SEASON = [[/늦가을/, [10, 11]], [/초겨울/, [11, 12]], [/정월/, [1, 1]], [/섣달/, [12, 12]], [/(\d{1,2})월/, null], [/겨울/, [12, 12]], [/봄/, [3, 5]], [/여름|장마/, [6, 8]], [/가을/, [9, 11]], [/우기/, [11, 12]]];
  const near = (dtext.match(/\{death_year\}년\s*([^,.。\s]{1,6})/) || [])[1] || '';
  let range = null; for (const src of [near, dtext]) { for (const [re, rg] of SEASON) { const m = src.match(re); if (m) { range = rg || [+m[1], +m[1]]; break; } } if (range) break; }
  let dm;
  if (range) { dm = range[0] + pick(range[1] - range[0] + 1); if (plan.D === A && dm <= am) { if (range[1] > am) dm = am + 1 + pick(range[1] - am); else plan.D = Math.min(1899, A + 1); } }
  else dm = plan.D === A ? Math.min(12, am + 1 + pick(Math.max(1, 12 - am))) : 1 + pick(12);
  const dd = 1 + pick(DIM(plan.D, dm));
  const death = { y: plan.D, m: dm, d: dd }, pb = { y: plan.by, m: b.m, d: Math.min(b.d, DIM(plan.by, b.m)) };
  const yi = [0, 1].filter(i => yearsIn(S.youth[i]).every(y => y >= pb.y && y <= A));
  // 직업: 바깥/안쪽 (에너지 축)
  const all = S.jobs.map((j, i) => [j, i]), fit = all.filter(([j]) => j.out === (v.E >= 0)), pool = fit.length ? fit : all;
  const ji = pool[pick(pool.length)][1];
  // 사건과의 관계: 닮은 캐릭터의 역할 (도덕 축이 낮으면 '이용한 쪽')
  const REL = { 주인공: 'center', 조력자: 'side', 흑막: 'use', 감초: 'crowd', 엑스트라: 'unnamed', 라이벌: 'side' };
  let rel = REL[twin?.role] || ['center', 'side', 'crowd', 'unnamed'][pick(4)]; if (v.M <= -1.5 && rel !== 'use' && r() < 0.5) rel = 'use';
  return {
    v: 3, scene: S.id, name: pick(S.names.length), birthI: pick(2), youthI: yi.length ? yi[pick(yi.length)] : -1, job: ji, rel,
    bond: v.X > 0 ? 'open' : 'hidden', death: { kind: plan.kind, i: plan.di, ...death }, pbirth: pb, age: plan.age,
    gap: (g => ({ y: g.y, m: g.m }))(diffYMD(death, b)), // 현생 날짜 자체는 남기지 않음
    slot: Number.isInteger(input.slot) ? input.slot : null, sib: Number.isInteger(input.sib) ? input.sib : null,
    land: Number.isInteger(input.land) ? input.land : null, fear: Number.isInteger(input.fear) ? input.fear : null,
    mark: Number.isInteger(input.mark) ? input.mark : null, deja: deja.slice(0, 40), last: answers?.q10 ?? 0, seed: Math.floor(r() * 1e9),
  };
}

/* ---------- 2) 그리기: 볼 때마다 ---------- */
const LAST = [ // Q10의 정서만 빌린 마지막 순간 (답의 말은 쓰지 않음)
  ['숨이 잦아드는 동안에도 당신의 손가락은 무언가를 마저 하려는 듯 옷자락을 움켜쥐었습니다. 끝은 내가 정한다고, 그 손이 말하고 있었지요.', '눈을 감기 직전, 당신은 내일 할 일을 하나 더 떠올렸습니다. 그 일은 결국 다음 생으로 미뤄졌습니다.', '마지막 숨을 고르며 당신은 웃었습니다. 아직 덜 끝난 이야기가 있다는 걸 아는 사람의 웃음이었지요.'],
  ['당신은 곁에 있던 얼굴들을 하나씩 천천히 바라보았습니다. 이름을 다 부르지는 못했지만, 그 눈길이 인사를 대신했지요.', '마지막 순간 당신의 입가에 남은 건 미안함이 아니라 고마움이었습니다. 그 표정을 본 사람들은 오래도록 그 얼굴을 잊지 못했습니다.', '당신은 누군가의 손등을 두 번, 가볍게 두드렸습니다. 평생 말로는 하지 못한 인사였지요.'],
  ['당신은 무언가를 약속하듯 입술을 달싹였습니다. 그 말을 들은 사람은 없었지만, 약속은 사라지지 않았습니다.', '눈을 감기 전 당신은 창밖의 하늘을 오래 보았습니다. 이번엔 여기까지, 다음엔 꼭 끝까지 가 보겠다고.', '당신은 못다 한 말을 가슴에 접어 넣고 눈을 감았습니다. 그 접힌 말은 아주 오랫동안 펼쳐지지 않은 채 당신을 따라왔습니다.'],
  ['마지막 순간, 어디선가 {food} 냄새가 흘러들었습니다. 당신은 그쪽으로 고개를 돌리고, 아주 평화로운 얼굴로 눈을 감았지요.', '사람들은 당신이 무언가 거창한 말을 남길 줄 알았습니다. 당신은 그저 부엌 쪽을 한 번 보고 작게 웃었을 뿐입니다. 아무래도 끼니를 걸렀던 모양입니다.', '당신의 마지막 기억은 따뜻한 {soup} 한 그릇이었습니다. 끝내 다 먹지 못한 그 한 그릇이, 이상하게도 가장 선명하게 남았지요.'],
];
const LAST_IN = [ // 사고·급한 죽음일 때: 주변 묘사 없이 속마음만
  ['그 짧은 순간에도 당신은 생각했습니다. 아직 끝난 게 아니라고, 이건 잠깐 쉬어 가는 것뿐이라고.', '모든 것이 멀어지는 동안에도 당신은 내일 할 일을 하나 더 떠올렸습니다. 그 일은 결국 다음 생으로 미뤄졌습니다.'],
  ['그 짧은 순간, 당신의 머릿속을 스친 건 고마운 얼굴들이었습니다. 하나하나 인사할 시간은 없었지만, 마음은 이미 다 전한 것 같았지요.', '마지막으로 떠오른 건 원망이 아니라 고마움이었습니다. 당신은 그 마음을 꼭 쥔 채 눈을 감았습니다.'],
  ['그 짧은 순간 당신은 무언가를 약속했습니다. 이번엔 여기까지지만, 다음엔 꼭 끝까지 가 보겠다고.', '못다 한 말이 목 끝까지 차올랐지만 소리가 되지는 못했습니다. 그 말은 접힌 채로, 아주 오랫동안 당신을 따라왔습니다.'],
  ['이상하게도 그 순간 떠오른 건 아침에 먹다 남긴 {soup} 한 그릇이었습니다. 다 먹고 나올걸, 하는 생각이 마지막이었지요.', '모든 것이 멀어지는데, 당신은 엉뚱하게도 오늘 저녁 무엇을 먹을지 생각하고 있었습니다. 끝까지 당신다운 마지막이었습니다.'],
];
const MARK_T = { 얼굴: '그 시절 햇볕과 바람을 가장 먼저 맞던 자리지요.', 목: '무거운 것을 지고 고개를 숙이던 자리입니다.', 어깨: '매일 같은 곳에 짐이 얹히던 자리입니다.', 팔: '소매를 걷어붙이고 일하던 팔, 무언가에 쓸리곤 하던 자리입니다.', 손: '평생 일을 쥐던 손이니, 흔적이 남는 것도 무리는 아니지요.', 가슴: '누군가를 끌어안던 자리입니다.', 등: '등 뒤에서 누군가 당신을 부르던 날의 자리입니다.', 다리: '하루에도 수십 리를 걷던 다리였지요.', 발: '{place:의} 땅을 가장 많이 밟은 곳입니다.' };
const FEAR_TT = { 물: ['바다', '강'], '높은 곳': ['산'], '좁은 곳': ['도시골목'] };
const FEAR_ALT = { 물: '깊은 물 앞에서 한 발 물러서게 되는 건, 그 시절 당신이 물가를 멀리하며 살았기 때문입니다. 그 버릇은 생을 건너서도 남았지요.', '높은 곳': '높은 곳에서 발끝이 저린 건, 그 시절 당신이 평생 낮은 땅에서만 살았기 때문입니다.', '좁은 곳': '좁은 곳에서 숨이 막히는 건, 그 시절 당신이 늘 탁 트인 곳에서 일했기 때문입니다.' };
const FEAR_L = { 물: '깊은 물 앞에서 한 발 물러서게 되는 건, {place:의} 물빛을 몸이 아직 기억하기 때문입니다.', 불: '타오르는 불 앞에서 괜히 숨을 참게 되는 건, 그 시절 어느 밤의 열기가 남아 있어서입니다.', '높은 곳': '높은 곳에서 아래를 내려다볼 때 발끝이 저린 건, 그 시절의 어느 비탈이 아직 몸에 남아서입니다.', '좁은 곳': '좁은 곳에서 숨이 막히는 건, 그 시절 사람들 틈에 끼어 오도 가도 못하던 날이 있었기 때문입니다.', '큰 소리': '큰 소리에 유난히 놀라는 건, 그 시절 어느 날의 굉음이 아직 귀에 남아서입니다.', '딱히 없음': '무서운 게 별로 없는 건, 웬만한 일은 그 시절에 이미 한 번 다 겪어 보았기 때문입니다.' };
const JOB_L = { '콘텐츠·편집': '현생에서 이야기를 만지는 일을 하는 건, {place:에서} 보고 들은 것을 언젠가 누군가에게 전하고 싶었기 때문입니다.', 개발: '현생에서 무언가를 짜고 고치는 일을 하는 건, {job:으로} 살며 익힌 손끝의 셈이 남아서입니다.', 디자인: '현생에서 보기 좋은 것을 만드는 일을 하는 건, 그 시절 {place:의} 빛깔을 아직 기억하기 때문입니다.', '사업·마케팅': '현생에서 사람과 사람을 잇는 일을 하는 건, 그 시절 오가던 사람들의 흥정 소리가 몸에 배어서입니다.', 경영지원: '현생에서 남들이 잘 일하도록 뒤를 받치는 일을 하는 건, 그 시절에도 당신이 늘 누군가의 뒤를 받쳤기 때문입니다.', 기타: '현생의 일이 무엇이든, 당신은 {job:으로} 살던 그때처럼 묵묵히 해내고 있을 겁니다.' };
const fmtD = d => `${d.y}년 ${d.m}월 ${d.d}일`;

export function renderPast(p, sub) {
  const S = SC[p?.scene]; if (!S) return null;
  const r = rng(String(p.seed)), pick = l => l[Math.floor(r() * l.length) % l.length];
  const job = S.jobs[p.job] || S.jobs[0];
  const name = S.names[p.name % S.names.length];
  const deathAge = p.death.y - p.pbirth.y - ((p.death.m < p.pbirth.m || (p.death.m === p.pbirth.m && p.death.d < p.pbirth.d)) ? 1 : 0);
  const ctx = { name, birthday: `${p.pbirth.m}월 ${p.pbirth.d}일`, birth_year: p.pbirth.y, sib: p.sib != null ? SIBS[p.sib] : '평범한 집안의 아이', age_k: p.age, death_year: p.death.y, death_age_k: deathAge,
    place: S.place_short || S.place_then, job: job.job, food: S.region === '조선' ? '밥 짓는' : '빵 굽는', soup: S.region === '조선' ? '국' : '수프' };
  const sibAware = t => p.sib == null ? t.replace(/\{sib\}로 태어났습니다/g, '태어났습니다').replace(/\{sib\}로,?/g, '').replace(/\{sib\}였고/g, '') : t;
  const F = t => fill(sibAware(t), ctx);
  const deathText = S.death[p.death.kind][p.death.i] || S.death[p.death.kind][0];
  const sudden = p.death.kind === 'young' && /물살|휩쓸|떨어|무너|불길|사고|파도|해일|쓰러/.test(deathText);
  const lastLine = fill(pick((sudden ? LAST_IN : LAST)[Math.max(0, Math.min(3, p.last | 0))]), ctx);
  const slot = p.slot != null ? SLOTS[p.slot] : null;
  const timeline = [
    { when: `${p.pbirth.y}`, tag: '출생', text: F(S.birth[p.birthI] || S.birth[0]) },
    p.youthI >= 0 ? { when: `${p.pbirth.y + 7}~`, tag: '자라던 날들', text: F(S.youth[p.youthI]) } : null,
    { when: `${Math.min(S.anchor.year - 1, p.pbirth.y + 18)}~`, tag: job.job, text: F(job.text) },
    { when: `${S.anchor.year}`, tag: S.anchor.title.replace(/\s*\([^)]*\)/g, ''), text: F(S.event[p.rel] || S.event.crowd), real: true },
    { when: '', tag: p.bond === 'open' ? '인연' : '말하지 못한 마음', text: F(S.bond[p.bond]) },
    { when: `${p.death.y}`, tag: '마지막', text: F(deathText) + ' ' + lastLine + (slot ? ` 당신이 눈을 감은 건 ${slot}${jong(slot) ? '이었' : '였'}습니다.` : '') },
    { when: `${p.death.y} → 현생`, tag: '영혼이 쉬어 간 시간', text: `당신의 영혼은 ${p.gap.y}년${p.gap.m ? ` ${p.gap.m}개월` : ''} 남짓을 쉬었습니다. 그리고 그 시절과 같은 생일, ${p.pbirth.m}월 ${p.pbirth.d}일에 다시 태어났습니다.` },
  ].filter(Boolean);
  const traces = [];
  if (p.mark != null && MARKS[p.mark] !== '없음') traces.push(`${josa(MARKS[p.mark], '의')} 점이나 흉터는 ${fill('{job:으로}', ctx)} 살던 시절의 흔적입니다. ${fill(MARK_T[MARKS[p.mark]], ctx)}`);
  if (p.fear != null) { const fw = FEARS[p.fear], near = (FEAR_TT[fw] || []).some(t => S.terrain.includes(t)); traces.push(fill(near || !FEAR_ALT[fw] ? FEAR_L[fw] : FEAR_ALT[fw], ctx)); }
  if (p.land != null) { const L = LANDS[p.land], lw = L === '도시골목' ? '도시의 골목' : L; const LW = { 바다: /바다|바닷|파도|갯벌|포구|항구/, 강: /강|나루|강물/, 산: /산|고개|봉우리/, 눈: /눈발|눈이|눈 덮|설원|얼음/, 사막: /사막|모래/, 도시골목: /골목|장터|시가|거리/ };
    const seen = S.terrain.includes(L) || (LW[L] && LW[L].test(timeline.map(t => t.text).join(' ')));
    traces.push(seen ? `까닭 없이 ${josa(lw, '에')} 끌리는 건, ${fill('{place:에서}', ctx)} 보던 풍경이 아직 눈에 남아 있기 때문입니다.` : `까닭 없이 ${josa(lw, '에')} 끌리는 건, 그 시절 끝내 가 보지 못한 곳이었기 때문입니다.`); }
  if (p.deja) traces.push(`처음 가 봤는데 낯익었던 곳, “${p.deja}”. 그 공기가 ${fill('{place:의}', ctx)} 어느 날과 닮았던 겁니다.`);
  if (sub?.job && JOB_L[sub.job]) traces.push(fill(JOB_L[sub.job], ctx));
  return {
    profile: { name, place_then: S.place_then, place_now: S.place_now, region: S.region, job: job.job, born: fmtD(p.pbirth), died: fmtD(p.death), deathAge, anchor: { ...S.anchor, title: S.anchor.title.replace(/\s*\([^)]*\)/g, '') }, gap: p.gap, sib: ctx.sib },
    timeline, traces, facts: S.facts, sources: S.sources,
  };
}
