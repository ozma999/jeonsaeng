// v3.6 모임날 — 대표 전생끼리의 인연 (웹툰 캐릭터와 무관)
import { renderLife, josa } from './life.js';

const REL_P = { center: '사건 한가운데에', side: '바로 곁에', use: '그 틈을 노리는 쪽에', crowd: '구경하던 무리 속에', unnamed: '이름 없이 스쳐 가는 자리에' };
const jobTok = j => String(j || '').trim().split(/\s+/).pop();
const repOf = s => (s?.lives?.length ? s.lives[Number.isInteger(s.rep) && s.lives[s.rep] ? s.rep : 0] : null);

// 두 대표 전생 사이의 가장 강한 인연 하나
export function pairBond(A, B) {
  const a = A.L, b = B.L, pa = A.R.profile, pb = B.R.profile;
  const ov = Math.min(a.dy, b.dy) - Math.max(a.by, b.by);
  const out = [];
  if (a.pack === b.pack && a.place === b.place)
    out.push({ type: '같은 동네', score: 10, line: ov > 0 ? `${pa.place}에서 같은 시절을 살았습니다. 같은 골목 어딘가에서 몇 번은 스쳤을 겁니다.` : `${pa.place}, 한 사람이 떠난 자리에 다른 사람이 들어와 살았습니다.` });
  if (a.pack === b.pack)
    out.push({ type: '같은 시대', score: 7, line: `${pa.anchor.year}년 ${pa.anchor.title} 때, 이 사람은 ${josa(pb.job, '으로')} ${REL_P[b.rel] || '그 근처에'} 있었습니다. ${a.rel === b.rel ? '당신과 같은 자리였지요.' : `당신은 ${REL_P[a.rel] || '그 근처에'} 있었고요.`}` });
  if (Math.abs(a.dy - b.by) <= 2) out.push({ type: '영혼의 바통', score: 8, dir: 'after', line: `당신의 그 생이 ${a.dy}년에 끝나고, 그 무렵 ${b.by}년에 이 사람의 생이 시작됐습니다.` });
  else if (Math.abs(b.dy - a.by) <= 2) out.push({ type: '영혼의 바통', score: 8, dir: 'before', line: `이 사람의 그 생이 ${b.dy}년에 끝나고, 그 무렵 ${a.by}년에 당신의 생이 시작됐습니다.` });
  if (a.pack !== b.pack && jobTok(pa.job) === jobTok(pb.job)) out.push({ type: '같은 일', score: 6, line: `시대도 땅도 달랐지만, 둘 다 ${josa(jobTok(pa.job), '으로')} 살았습니다.` });
  if (a.pack !== b.pack && a.by === b.by) out.push({ type: '같은 해에 태어남', score: 5, line: `${a.by}년, 당신이 ${pa.place}에서 태어난 그해에 이 사람은 ${pb.place}에서 태어났습니다.` });
  if (a.pack !== b.pack && ov > 0) out.push({ type: '같은 하늘 아래', score: Math.min(4.5, ov / 12), line: `${Math.max(a.by, b.by)}~${Math.min(a.dy, b.dy)}년, ${ov}년 동안 같은 시간을 서로 다른 땅에서 살았습니다.` });
  if (!out.length) { const g = Math.max(a.by, b.by) - Math.min(a.dy, b.dy); out.push({ type: '엇갈린 생', score: 0.5, line: `두 생 사이에는 ${g}년의 틈이 있습니다. 한 사람이 떠난 세상에 한참 뒤 다른 사람이 도착했지요.` }); }
  return out.sort((x, y) => y.score - x.score)[0] || null;
}

const card = (o, R) => ({ nick: o.nick, name: R.profile.name, era: R.profile.era, job: R.profile.job, by: R.profile.by, dy: R.profile.dy, pack: R.profile.pack });

export function meetOf(sub, subs) {
  const L = repOf(sub); if (!L) return null;
  const me = { L, R: renderLife(L, sub) }; if (!me.R) return null;
  const others = subs.filter(o => o.nick !== sub.nick).map(o => { const L2 = repOf(o); const R2 = L2 && renderLife(L2, o); return R2 ? { o, L: L2, R: R2 } : null; }).filter(Boolean);
  const pairs = others.map(x => ({ x, b: pairBond(me, x) })).filter(p => p.b);
  const bonds = pairs.filter(p => p.b.score >= 5).sort((p, q) => q.b.score - p.b.score).slice(0, 6).map(p => ({ ...card(p.x.o, p.x.R), type: p.b.type, line: p.b.line }));
  // 소울메이트: 가장 강한 인연 + 인연의 모양이 같으면 가산
  const soulP = pairs.map(p => ({ p, s: p.b.score + (p.x.L.bond === L.bond ? 1 : 0) + (p.x.L.last === L.last ? 0.5 : 0) })).sort((a, b) => b.s - a.s)[0]?.p;
  // 라이벌: 같은 시대에서 한가운데 vs 틈을 노린 쪽, 혹은 같은 일을 한 사람
  const rivalC = others.filter(x => x.o.nick !== soulP?.x.o.nick).map(x => {
    let s = 0, line = '';
    if (x.L.pack === L.pack && ((x.L.rel === 'center' && L.rel === 'use') || (x.L.rel === 'use' && L.rel === 'center'))) { s = 9; line = `${me.R.profile.anchor.year}년, 한 사람은 사건 한가운데에, 한 사람은 그 틈을 노리는 쪽에 있었습니다.`; }
    else if (x.L.pack === L.pack && x.L.job === L.job) { s = 8; line = `같은 시대, 같은 ${josa(me.R.profile.job, '으로')} 한 손님을 두고 다퉜을 사이입니다.`; }
    else if (jobTok(x.R.profile.job) === jobTok(me.R.profile.job)) { s = 6; line = `둘 다 ${jobTok(me.R.profile.job)}. 서로 자기 쪽이 더 고생했다고 말할 사이입니다.`; }
    else if (x.L.pack === L.pack) { s = 5; const T = [`같은 시대의 ${josa(me.R.profile.job, '과')} ${x.R.profile.job}. 길에서 마주칠 때마다 괜히 먼저 고개를 돌리던 사이입니다.`, `${me.R.profile.anchor.year}년 무렵, ${josa(me.R.profile.place, '과')} ${x.R.profile.place}. 서로 자기 동네가 낫다고 우기던 사이입니다.`, `같은 시대를 살며 서로의 소문을 제일 먼저 듣던 사이입니다. 그 시절 ${x.R.profile.name}의 이름이 들리면 당신은 늘 한마디 보탰지요.`]; line = T[((L.at || 0) + (x.L.at || 0)) % 3]; }
    else if (x.R.profile.grade === me.R.profile.grade && x.R.profile.grade !== 'N') { s = 3; line = `둘 다 ${x.R.profile.grade} 등급 시대에서 왔습니다. 누가 더 드문 생이었는지 겨뤄 볼 만합니다.`; }
    if (!s) { const d = Math.abs((x.R.profile.deathAge || 0) - (me.R.profile.deathAge || 0)); s = Math.min(2.5, d / 20); line = `당신은 ${me.R.profile.deathAge}살까지, 이 사람은 ${x.R.profile.deathAge}살까지 살았습니다. 누구의 생이 더 알찼는지 오늘 겨뤄 보세요.`; }
    return { x, s, line };
  }).filter(c => c.s > 0).sort((a, b) => b.s - a.s)[0];
  return {
    bonds,
    soulmate: soulP ? { ...card(soulP.x.o, soulP.x.R), type: soulP.b.type, line: soulP.b.line } : null,
    rival: rivalC ? { ...card(rivalC.x.o, rivalC.x.R), line: rivalC.line } : null,
  };
}

// 발표 모드 인연 지도: 시대별 묶음 + 바통 이어짐
export function meetMap(subs) {
  const rows = subs.map(o => { const L = repOf(o); const R = L && renderLife(L, o); return R ? { o, L, R } : null; }).filter(Boolean);
  const byPack = {};
  for (const x of rows) (byPack[x.L.pack] = byPack[x.L.pack] || { era: x.R.profile.era, anchor: x.R.profile.anchor, people: [] }).people.push({ ...card(x.o, x.R), place: x.R.profile.place });
  const eras = Object.values(byPack).filter(g => g.people.length > 1).sort((a, b) => b.people.length - a.people.length);
  const relay = [];
  for (const a of rows) for (const b of rows) if (a !== b && Math.abs(a.L.dy - b.L.by) <= 2 && a.L.pack !== b.L.pack) relay.push({ from: a.o.nick, fromName: a.R.profile.name, dy: a.L.dy, to: b.o.nick, toName: b.R.profile.name, by: b.L.by });
  return { eras, relay: relay.slice(0, 12) };
}
