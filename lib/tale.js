// 전생 단편 조립기 — 사용자의 답 + 시드 랜덤으로 data/tales/<세계>.json 조각을 골라 8문단 이야기를 만든다.
// 같은 사람(닉네임+답)은 다시 열어도 같은 이야기, 다른 사람은 같은 답이어도 이름·장소·변형이 달라진다.
import fs from 'fs';
import path from 'path';

const FILES = ['school', 'murim', 'fantasy', 'office', 'ruins']; // Q4 선택지 순서와 같음
const W = {};
for (const f of FILES) { try { W[f] = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'tales', f + '.json'), 'utf-8')); } catch {} }

const K5 = ['검', '장부', '폰', '국자'], K6 = ['존경', '두려움', '또너야', '이름없음'], K7 = ['앞장', '작전', '근원', '짐'];
const K8 = ['회귀', '정체', '짝사랑', '없음'], K9 = ['라이벌', '동료', '한사람', '고양이'], K10 = ['끝나지않았다', '고마웠어', '다음생엔', '배고프다'];

function rng(seedStr) { // mulberry32
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const PAIR = { 이: '가', 은: '는', 을: '를', 과: '와', 아: '야', 이라: '라', 이여: '여', 이었: '였', 이다: '다' };
const jong = w => { const c = String(w).trim().slice(-1); return c >= '가' && c <= '힣' && (c.charCodeAt(0) - 0xAC00) % 28 !== 0; };
function fill(t, ctx) {
  return String(t).replace(/\{([a-z]+)(?::([^}]+))?\}/g, (_, k, j) => {
    const v = ctx[k] ?? '';
    if (!j) return v;
    if (j === '으로') { const c = v.slice(-1); const rieul = c >= '가' && c <= '힣' && (c.charCodeAt(0) - 0xAC00) % 28 === 8; return v + (!jong(v) || rieul ? '로' : '으로'); }
    return v + (jong(v) ? j : (PAIR[j] ?? j));
  });
}

// 8문단: 현생과 잇는 에필로그 (최면사의 마무리)
const ANCHOR = [ // Q1 스무 살의 금요일 밤
  '현생의 당신이 금요일 밤이면 사람들 한가운데로 걸어 들어가는 건 우연이 아닙니다. {name}도 늘 그랬으니까요.',
  '현생의 당신이 금요일 밤 모니터 불빛 아래가 가장 편한 건, {name}의 밤도 작은 불빛 하나와 함께였기 때문입니다.',
  '현생의 당신이 남들 다 떠난 자리에 끝까지 남아 있는 건, {name}에게서 물려받은 버릇입니다.',
  '현생의 당신에게 아무도 모르는 혼자만의 장소가 있다면, 그건 {name}이 쓰던 자리를 그대로 옮겨 온 겁니다.'.replace('{name}이', '{name:이}'),
];
const AFTER = { // Q10에 따라 이어 붙는 한 줄
  끝나지않았다: ['그때 끝내지 못한 이야기는 지금도 계속되고 있습니다. 당신이 쉽게 포기하지 않는 이유입니다.', '그 시절의 다짐은 아직 유효합니다. 당신은 지금, 그 이야기의 다음 장을 살고 있습니다.'],
  고마웠어: ['그때 미처 다 전하지 못한 고마움이, 이번 생에서 당신이 사람을 챙기는 방식이 되었습니다.', '고맙다는 말을 건네지 못한 얼굴이 아직 몇 남아 있습니다. 이번 생에서 마저 전하시면 됩니다.'],
  다음생엔: ['"다음 생엔 꼭…" 그 뒤의 말을 기억하십니까. 지금이 바로 그 다음 생입니다.', '그 시절 미뤄 둔 약속은 사라지지 않았습니다. 지금이, 그 약속을 지키기로 한 생입니다.'],
  배고프다: ['그래서인지 현생의 당신은 밥때를 꽤 정확히 압니다. 영혼에 새겨진 배꼽시계입니다. 오늘 저녁은 꼭 챙기세요.', '그 시절 끝내 먹지 못한 한 끼가 아직 남아 있습니다. 오늘은 맛있는 걸 드세요. {name}의 몫까지.'],
};
const CLOSE = [
  '이제 셋을 세면 깨어납니다. 하나, 둘… {nick}님, 천천히 눈을 뜨세요.',
  '숨을 깊이 들이쉬세요. 셋을 세면 현생으로 돌아옵니다. 하나, 둘, 셋. {nick}님, 돌아오신 걸 환영합니다.',
  '이제 그 시절의 불빛이 멀어집니다. 셋에 눈을 뜨세요. 하나, 둘… 어서 오세요, {nick}님.',
];
const LABEL = ['학원', '무협', '판타지', '현대', '폐허'];

export function buildTale(sub) {
  const a = sub.answers || {};
  const wi = Number.isInteger(a.q4) && W[FILES[a.q4]] ? a.q4 : 0;
  const T = W[FILES[wi]]; if (!T) return null;
  const r = rng(`${sub.nick}|${[a.q1, a.q2, a.q3, a.q4, a.q5, a.q6, a.q7, a.q8, a.q9, a.q10].join(',')}|${sub.at || ''}`);
  const pick = l => l[Math.floor(r() * l.length) % l.length];
  const k = (K, i) => K[Number.isInteger(i) && i >= 0 && i < 4 ? i : 0];
  const b = k(K9, a.q9), last = k(K10, a.q10);
  const ctx = { name: pick(T.names), place: pick(T.places), season: pick(['봄', '여름', '가을', '겨울']), comp: pick(T.comp_names[b]), event: pick(T.crisis_event), nick: sub.nick || '' };
  const paras = [
    pick(T.intro),
    pick(T.job[k(K5, a.q5)]), pick(T.fame[k(K6, a.q6)]), pick(T.bond[b]),
    pick(T.secret[k(K8, a.q8)]), pick(T.crisis[k(K7, a.q7)]), pick(T.last[last]),
  ].map(t => fill(t, ctx));
  // '곁에 있던 ○○'은 한 번만: 두 번째부터는 이름만 남긴다
  let seen = false;
  for (let i = 0; i < paras.length; i++) {
    paras[i] = paras[i].replace(/곁에 있던 /g, m => { if (seen) return ''; seen = true; return m; });
  }
  const free = sub.free ? ` 당신이 떠올린 그 장면, "${String(sub.free).slice(0, 60)}". 그건 아마 ${fill('{name:이}', ctx)} 살던 어느 하루였을 겁니다.` : '';
  const epi = fill(`${ANCHOR[Number.isInteger(a.q1) ? a.q1 % 4 : 0]} ${pick(AFTER[last])}${free}`, ctx);
  return { world: LABEL[wi], title: fill(pick(T.titles), ctx), name: ctx.name, place: ctx.place, comp: ctx.comp, paras, epilogue: epi, close: fill(pick(CLOSE), ctx) };
}
