"""나무위키 수집 — 로컬 PC에서 실행.
pip install requests beautifulsoup4
python scripts/crawl_namuwiki.py            # data/works_stier.json 전체
python scripts/crawl_namuwiki.py --only 화산귀환

- 작품 문서는 "제목(웹툰)" → "제목" 순으로 시도, 이어서 "제목/등장인물" 하위 문서를 받는다.
- 받은 원문은 scripts/cache/에 텍스트로 저장해 재실행 시 다시 받지 않는다.
- 봇 차단(403/429/챌린지 페이지)이 오면 멈추고 알려 준다. 그때는 브라우저로 문서를 열어
  본문을 복사해 scripts/cache/<문서명>.txt 로 저장하면 이후 단계가 그대로 동작한다.
"""
import json, os, sys, time, re, argparse
from urllib.parse import quote
import requests
from bs4 import BeautifulSoup

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE=os.path.join(ROOT,'scripts','cache'); os.makedirs(CACHE,exist_ok=True)
DELAY=float(os.environ.get('CRAWL_DELAY','4'))  # 요청 간격(초). 줄이지 말 것
UA={'User-Agent':'Mozilla/5.0 (internal club event; low-rate fetch)'}

def fname(doc): return os.path.join(CACHE, re.sub(r'[\\/:*?"<>|]','_',doc)+'.txt')

BROWSER=None
def browser_get(url):
    """--browser 모드: 화면이 보이는 크롬으로 연다. 확인 화면이 뜨면 직접 눌러 주면 된다."""
    global BROWSER
    if BROWSER is None:
        from playwright.sync_api import sync_playwright
        pw=sync_playwright().start()
        BROWSER=pw.chromium.launch_persistent_context(os.path.join(CACHE,'_browser'),headless=False)
    page=BROWSER.pages[0] if BROWSER.pages else BROWSER.new_page()
    page.goto(url,timeout=60000)
    for _ in range(60):                                  # 최대 60초: 확인 화면이 지나갈 때까지 대기
        if 'namu.wiki' in page.url and page.query_selector('article, main, #app'): break
        page.wait_for_timeout(1000)
    page.wait_for_timeout(1500); time.sleep(DELAY)
    return page.content()

def fetch_html(doc):
    """원문 HTML (이미지 수집용). scripts/cache/<문서>.html 에 캐시"""
    path=fname(doc)[:-4]+'.html'
    if os.path.exists(path): return open(path,encoding='utf-8').read()
    if os.environ.get('CRAWL_BROWSER')=='1':
        html=browser_get('https://namu.wiki/w/'+quote(doc))
        if '문서가 존재하지 않습니다' in html[:200000] and '<article' not in html: return None
        open(path,'w',encoding='utf-8').write(html); return html
    try: r=requests.get('https://namu.wiki/w/'+quote(doc),headers=UA,timeout=20)
    except requests.RequestException:
        sys.exit('[연결 실패] 나무위키에 접속하지 못했습니다. 인터넷 연결을 확인하고, 회사망이라면 다른 네트워크(휴대폰 테더링 등)에서 다시 실행해 보세요.')
    time.sleep(DELAY)
    if r.status_code==404: return None
    if r.status_code in (403,429) or 'challenge' in r.text[:3000].lower():
        sys.exit(f'[차단] 나무위키가 자동 접속을 막았습니다. 같은 명령 끝에 --browser 를 붙여 다시 실행하세요.')
    r.raise_for_status()
    open(path,'w',encoding='utf-8').write(r.text); return r.text

def fetch(doc):
    path=fname(doc)
    if os.path.exists(path): return open(path,encoding='utf-8').read()
    html=fetch_html(doc)
    if not html: return None
    soup=BeautifulSoup(html,'html.parser')
    for t in soup(['script','style','noscript']): t.decompose()
    text=re.sub(r'\n{3,}','\n\n',soup.get_text('\n')).strip()
    if '문서가 존재하지 않습니다' in text[:2000]: return None
    open(path,'w',encoding='utf-8').write(text); return text

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--only'); ap.add_argument('--browser',action='store_true'); a=ap.parse_args()
    if a.browser: os.environ['CRAWL_BROWSER']='1'
    works=json.load(open(os.path.join(ROOT,'data','works_stier.json'),encoding='utf-8'))
    for w in works:
        t=w['title']
        if t.startswith('보충 슬롯') or (a.only and a.only!=t): continue
        main_doc=None
        for cand in (f'{t}(웹툰)', t):
            if fetch(cand): main_doc=cand; break
        if not main_doc: print('[없음]',t); continue
        chars=fetch(f'{main_doc}/등장인물')
        print('[완료]',t,'— 등장인물 문서','있음' if chars else '없음(작품 문서 안의 등장인물 항목 사용)')

if __name__=='__main__': main()
