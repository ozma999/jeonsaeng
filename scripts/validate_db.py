"""추출 결과 자동 검증 + 병합 → data/characters.json, 검수표 data/review.csv
python scripts/validate_db.py [--include-seed]
- 근거 없는 필드는 폐기(축 점수는 3으로, 범주형은 캐릭터 제외)
- 허용값 검사, id 중복 정리, 관계 id 확인, 작품 내 축 점수 복붙 의심 표시
"""
import json, os, glob, csv, argparse
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENUM=dict(role={'주인공','라이벌','조력자','흑막','감초','엑스트라'},solve={'무력','두뇌','사교','근성','재능'},
  emo={'직진','츤데레','무표정','감성'},arc={'밑바닥성장','숨겨진강자','회귀','몰락','평탄'})
WORLD={'학원','현대','무협','판타지','스릴러','로맨스','일상'}
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--include-seed',action='store_true'); a=ap.parse_args()
    out=[]; flags=[]; seen=set()
    files=sorted(glob.glob(os.path.join(ROOT,'data','extracted','*.json')))
    for f in files:
        chars=json.load(open(f,encoding='utf-8')); axes_seen=[]
        for c in chars:
            ev=c.pop('evidence',{}) or {}; why=[]
            for k in ENUM:
                if c.get(k) not in ENUM[k] or not ev.get(k): why.append(f'{k} 근거 없음'); c[k]=None
            if not c.get('role') or not c.get('name'):   # 역할 근거가 없으면 매칭 품질이 무너지므로 제외
                flags.append((c.get('name'),c.get('work'),'제외: '+', '.join(why))); continue
            q=(c.get('quote') or '').strip()
            c['quote']=q if q and any(q in e or e in q for e in (ev.get('quote') or [])) and len(q)<=60 else ''
            c['world']=[w for w in (c.get('world') or []) if w in WORLD] or ['일상']
            ax=c.get('axes') or {}
            for k in 'EMSX':
                v=ax.get(k); ax[k]=v if isinstance(v,(int,float)) and 1<=v<=5 and len(ev.get('axes',[]) or ev.get(k,[]) or [])>=1 else 3
            c['axes']=ax
            for k in ENUM:
                if c.get(k) not in ENUM[k]: c[k]={'role':'조력자','solve':'근성','emo':'감성','arc':'평탄'}[k]
            if tuple(ax.values()) in axes_seen: why.append('축 점수가 같은 작품 다른 캐릭터와 동일')
            axes_seen.append(tuple(ax.values()))
            base=c.get('id') or 'char'; c['id']=base; i=2
            while c['id'] in seen: c['id']=f'{base}{i}'; i+=1
            seen.add(c['id']); c.setdefault('look',{}); c.setdefault('relations',[]); c.setdefault('ending',''); c.setdefault('spoiler',1 if c.get('ending') else 0); c.setdefault('meme','')
            out.append(c)
            if why: flags.append((c['name'],c['work'],'; '.join(why)))
    if a.include_seed or not out:
        seed=json.load(open(os.path.join(ROOT,'data','characters.json'),encoding='utf-8'))
        for s in seed:
            if s['id'] not in seen: out.append(s); seen.add(s['id'])
    ids={c['id'] for c in out}
    for c in out: c['relations']=[r for r in c['relations'] if r.get('id') in ids]
    json.dump(out,open(os.path.join(ROOT,'data','characters.json'),'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    with open(os.path.join(ROOT,'data','review.csv'),'w',encoding='utf-8-sig',newline='') as fp:
        w=csv.writer(fp); w.writerow(['id','이름','작품','역할','세계관','한줄','검증','자동 플래그','검수(맞음/수정/제외)'])
        fl={(n,wk):m for n,wk,m in flags}
        for c in out: w.writerow([c['id'],c['name'],c['work'],c['role'],'/'.join(c['world']),c['scene'],'검수 완료' if c.get('verified') else '검수 전',fl.get((c['name'],c['work']),''),''])
    print(f'캐릭터 {len(out)}명 저장, 플래그 {len(flags)}건 → data/review.csv')
if __name__=='__main__': main()
