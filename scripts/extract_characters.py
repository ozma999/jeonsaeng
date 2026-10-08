"""수집한 원문에서 캐릭터 프로필 추출 — Claude API 사용.
pip install anthropic ; export ANTHROPIC_API_KEY=...
python scripts/extract_characters.py [--only 화산귀환] [--per-work 4]
결과: data/extracted/<작품>.json  (검증 전 초안)
"""
import json, os, re, argparse, sys
import anthropic
sys.path.insert(0, os.path.dirname(__file__))
from crawl_namuwiki import fname

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'data','extracted'); os.makedirs(OUT,exist_ok=True)
MODEL=os.environ.get('MODEL','claude-sonnet-5-5')
TAGS=['무리의중심','모니터불빛','끝까지남는다','혼자만의장소','앞에나선다','분위기메이커','숨은실력자','존재감제로','바로말한다','웃으며기억한다','참다폭발','혼자삭인다','학원물체질','강호의피','판타지체질','직장인','생존자','무력파','기록하는자','정보통','생활형','존경받는자','두려움의대상','귀찮은녀석','이름없는자','앞장선다','작전가','재앙의근원','생존우선','회귀자','정체를숨김','짝사랑','비밀없음','평생의라이벌','동료애','단한사람','고양이','끝나지않았다','고마웠어','다음생엔','배고프다']

PROMPT='''아래는 웹툰 「{title}」의 나무위키 문서 원문이다. 원문에 근거해 주요 캐릭터 {n}명을 골라 JSON 배열로만 답하라. 설명, 마크다운 금지.
캐릭터 선정: 주인공, 라이벌, 핵심 조연, 인기 악역 순. 원문에 근거가 부족한 캐릭터는 넣지 말 것.
각 원소 형식:
{{"id":"영문 소문자 슬러그","name":"","work":"{title}","author":"","year":연재시작연도,
 "world":["학원|현대|무협|판타지|스릴러|로맨스|일상" 중 1~2개],
 "role":"주인공|라이벌|조력자|흑막|감초|엑스트라",
 "axes":{{"E":1-5 내향→외향,"M":1-5 악→정의,"S":1-5 개그→진지,"X":1-5 감정숨김→직진}},
 "solve":"무력|두뇌|사교|근성|재능","emo":"직진|츤데레|무표정|감성","arc":"밑바닥성장|숨겨진강자|회귀|몰락|평탄",
 "tags":[다음 목록에서만 3~6개: {tags}],
 "scene":"캐릭터를 한 줄로 (스포일러 없이, 25자 안팎)",
 "look":{{"glasses":true/false,"hair":"short|long","vibe":"sharp|soft"}} 원문에 근거 있는 키만,
 "relations":[{{"id":"같은 배열 안 다른 캐릭터 id","type":"관계 한 단어"}}],
 "ending":"결말 한 줄(없으면 빈 문자열)","spoiler":0|1|2,
 "meme":"팬덤 별명·밈(원문에 있으면)",
 "evidence":{{"필드명":["원문에서 그대로 옮긴 짧은 근거 문장", ...]}}}}
규칙: axes의 각 값과 role, solve, emo, arc는 evidence에 근거 문장을 최소 1개(axes는 2개) 넣을 것. 근거를 못 찾은 필드는 null.
'''

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--only'); ap.add_argument('--per-work',type=int,default=4); a=ap.parse_args()
    works=json.load(open(os.path.join(ROOT,'data','works_stier.json'),encoding='utf-8'))
    client=anthropic.Anthropic()
    for w in works:
        t=w['title']
        if t.startswith('보충 슬롯') or (a.only and a.only!=t): continue
        out=os.path.join(OUT,re.sub(r'[\\/:*?"<>|]','_',t)+'.json')
        if os.path.exists(out): continue
        texts=[open(fname(d),encoding='utf-8').read() for d in (f'{t}(웹툰)/등장인물',f'{t}/등장인물',f'{t}(웹툰)',t) if os.path.exists(fname(d))]
        if not texts: print('[원문 없음]',t); continue
        src='\n\n'.join(texts)[:120000]
        msg=client.messages.create(model=MODEL,max_tokens=8000,messages=[{'role':'user','content':PROMPT.format(title=t,n=a.per_work,tags=', '.join(TAGS))+'\n\n<원문>\n'+src+'\n</원문>'}])
        raw=''.join(b.text for b in msg.content if b.type=='text'); raw=re.sub(r'^```(json)?|```$','',raw.strip(),flags=re.M).strip()
        try: data=json.loads(raw)
        except Exception: open(out+'.raw.txt','w',encoding='utf-8').write(raw); print('[형식 오류]',t); continue
        for c in data: c['tier']='S'; c['source']=f'https://namu.wiki/w/{t}'; c['verified']=False; c.setdefault('image','')
        json.dump(data,open(out,'w',encoding='utf-8'),ensure_ascii=False,indent=1); print('[추출]',t,len(data),'명')

if __name__=='__main__': main()
