"""캐릭터 이미지 수집 → images/<id>.webp 로 저장하고 characters.json의 image를 채운다. 로컬 PC에서 실행.
pip install requests beautifulsoup4 pillow
python scripts/fetch_images.py            # 이미지 없는 캐릭터만
python scripts/fetch_images.py --redo     # 전부 다시

찾는 순서
 1) 나무위키 캐릭터 개별 문서 「이름(작품)」 → 「이름」 의 첫 인물 이미지
 2) 작품의 「등장인물」 문서에서 alt(파일명)에 캐릭터 이름이 들어간 이미지
 3) (주인공만) 네이버웹툰 작품 썸네일 — 얼굴이 아닐 수 있어 표시만 해 둔다
결과: data/image_report.csv (성공/실패/출처). 실패한 캐릭터는 관리자 화면에서 이미지 주소를 붙여 넣으면 바로 뜬다.
"""
import json, os, io, csv, argparse, time, sys
from urllib.parse import quote
import requests
from bs4 import BeautifulSoup
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from crawl_namuwiki import fetch_html, DELAY, UA

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG=os.path.join(ROOT,'images'); os.makedirs(IMG,exist_ok=True)
DB=os.path.join(ROOT,'data','characters.json')

def namu_imgs(html):
    soup=BeautifulSoup(html,'html.parser'); out=[]
    for im in soup.find_all('img'):
        src=im.get('data-src') or im.get('src') or ''
        if 'i.namu.wiki' not in src: continue
        if src.startswith('//'): src='https:'+src
        w=int(im.get('width') or 0) if str(im.get('width') or '').isdigit() else 0
        if w and w<80: continue                      # 아이콘·깃발 제외
        out.append((src, im.get('alt') or ''))
    return out

def from_namu(c):
    for doc in (f"{c['name']}({c['work']})", c['name']):
        html=fetch_html(doc)
        if html and '문서가 존재하지 않습니다' not in html[:20000]:
            imgs=namu_imgs(html)
            if imgs: return imgs[0][0], f'나무위키:{doc}'
    for doc in (f"{c['work']}(웹툰)/등장인물", f"{c['work']}/등장인물"):
        html=fetch_html(doc)
        if not html: continue
        for src,alt in namu_imgs(html):
            if c['name'].replace(' ','') in alt.replace(' ',''): return src, f'나무위키:{doc}'
    return None, None

def from_naver(c):
    try:
        r=requests.get('https://comic.naver.com/api/search/all?keyword='+quote(c['work']),headers={**UA,'Referer':'https://comic.naver.com/'},timeout=15); time.sleep(1)
        items=(r.json().get('searchWebtoonResult') or {}).get('searchViewList') or []
        for it in items:
            if it.get('titleName','').replace(' ','')==c['work'].replace(' ',''): return it.get('thumbnailUrl'), '네이버웹툰 썸네일'
    except Exception as e: print('  네이버 검색 실패:',e)
    return None, None

def save(url, cid):
    ref='https://comic.naver.com/' if 'pstatic' in url else 'https://namu.wiki/'
    r=requests.get(url,headers={**UA,'Referer':ref},timeout=20); r.raise_for_status(); time.sleep(DELAY/2)
    im=Image.open(io.BytesIO(r.content)).convert('RGB'); im.thumbnail((360,450))
    path=os.path.join(IMG,cid+'.webp'); im.save(path,'WEBP',quality=82); return '/images/'+cid+'.webp'

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--redo',action='store_true'); ap.add_argument('--browser',action='store_true'); a=ap.parse_args()
    if a.browser: os.environ['CRAWL_BROWSER']='1'
    chars=json.load(open(DB,encoding='utf-8')); rows=[]
    for c in chars:
        if c.get('image') and not a.redo: rows.append([c['id'],c['name'],c['work'],'기존',c['image']]); continue
        url,src=from_namu(c)
        if not url and c.get('role')=='주인공': url,src=from_naver(c)
        if not url: rows.append([c['id'],c['name'],c['work'],'실패','']); print('[실패]',c['name']); continue
        try: c['image']=save(url,c['id']); c['image_src']=src; rows.append([c['id'],c['name'],c['work'],'성공',src]); print('[성공]',c['name'],src)
        except Exception as e: rows.append([c['id'],c['name'],c['work'],'실패',str(e)[:80]]); print('[저장 실패]',c['name'],e)
    json.dump(chars,open(DB,'w',encoding='utf-8'),ensure_ascii=False,indent=1)
    with open(os.path.join(ROOT,'data','image_report.csv'),'w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f); w.writerow(['id','이름','작품','결과','출처']); w.writerows(rows)
    ok=sum(r[3] in ('성공','기존') for r in rows); print(f'이미지 {ok}/{len(rows)} — 결과는 data/image_report.csv')

if __name__=='__main__': main()
