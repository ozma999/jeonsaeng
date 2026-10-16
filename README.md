# 전생체험 — 당신은 전생에 어떤 웹툰 캐릭터였나 (페이지 v1)

사내 오타쿠 동호회 모임용. 기획 근거는 `docs/기획안_v3.html`.

## 구성
| 경로 | 내용 |
|---|---|
| `index.html` | 체험 · 결과 · 관리자 · 발표 모드 단일 페이지 (관리자 이름 김현우로 입장) |
| `api/game.js` | Vercel 함수. 제출, 결과 조회, 전역 재배정, 인연 공개, 수동 지정 |
| `lib/questions.js` | 문항 배점표, 조합 규칙 15개, 근거 문장 — 서버에만 존재 |
| `lib/match.js` | 성향 계산, 유사도, 흔들리는 1위, 근거·서사·업보 생성 |
| `lib/store.js` | Upstash Redis REST (환경변수 없으면 메모리 저장) |
| `data/characters.json` | **시드 49명 (검수 전, 동작 확인용)** — 행사 전 교체 필요 |
| `data/works_stier.json` | S티어 115작품 확정 목록 |
| `scripts/` | 나무위키 수집 → Claude 추출 → 자동 검증, 시뮬레이션, 로컬 서버 |

## 배포 (Taste DNA Map과 같은 방식)
1. 이 폴더를 GitHub 새 저장소에 올린다.
2. Vercel에서 저장소를 Import (프레임워크: Other, 빌드 설정 없음).
3. Vercel Storage에서 Upstash Redis를 연결한다. 그 외 환경변수는 필요 없다.
4. 배포 후 첫 화면에서 이름을 **김현우**로 입력하면 운영자 메뉴(체험 / 관리자 화면 / 발표 모드)가 열린다.

## 로컬 확인
```
node scripts/dev-server.js        # http://localhost:3000  (관리자 이름 김현우)
node scripts/simulate.js 3000     # 가상 응답으로 결과 분포 점검
```

## 캐릭터 DB 만들기 (로컬 PC에서)
```
pip install requests beautifulsoup4 anthropic pillow
python scripts/crawl_namuwiki.py                 # 원문 수집 → scripts/cache/
export ANTHROPIC_API_KEY=...
python scripts/extract_characters.py --per-work 4   # 초안 → data/extracted/
python scripts/validate_db.py                    # 검증·병합 → data/characters.json, data/review.csv
python scripts/fetch_images.py                   # 이미지 수집 → images/<id>.webp, data/image_report.csv
node scripts/simulate.js 3000                    # 분포 재점검
```
- 이미지 수집 후 `images` 폴더와 `data/characters.json`을 GitHub에 올리면 저장소 안 이미지로 바로 뜬다(가장 빠르고 PNG 저장에도 포함).
- 수집에 실패한 캐릭터는 관리자 화면 하단 '캐릭터 이미지'에서 주소를 붙여 넣으면 재배포 없이 즉시 반영된다. 외부 주소는 `api/img` 프록시를 거쳐 핫링크 차단 없이 표시된다.
- 수집 중 차단 메시지가 나오면 안내된 경로에 브라우저로 저장한 본문을 넣고 다시 실행한다.
- `data/review.csv`로 S티어는 전수, A티어는 20% 샘플 검수 → 수정 사항을 `characters.json`에 반영하고 `verified: true`로 바꾼다.
- 이미지 URL은 `image` 필드에 넣는다. 비어 있거나 로딩에 실패하면 실루엣으로 대체된다.
- 시드 49명을 남기려면 `validate_db.py --include-seed` (같은 id는 추출본이 우선).

## 모임 운영 순서
1. 오픈: 링크를 동호회에 공유. 본명만 입력하면 들어가고, 기기와 관계없이 같은 이름이면 같은 기록이 열린다. 동명이인은 이름 뒤에 팀명을 붙인다.
2. 응답 마감 후 관리자 화면에서 **전역 재배정 실행** → 결과를 훑고 어색한 배정은 후보 목록에서 수동 지정.
3. 모임날 **인연 공개 켜기** → 참가자 결과 화면에 전생 인연 표시, `?present` 발표 모드 사용 (→/스페이스: 다음, ←: 이전).

## 알려진 한계 (v1)
- 명대사(`quote`)는 수집 단계에서 나무위키 명대사 항목을 그대로 옮긴 것만 남는다. 시드 49명에는 비어 있다.
- 결과 문구는 템플릿 조립. Claude API 개인별 서사 생성은 다음 단계.
- 시드 DB가 49명이라 50명 이상이 참여하면 중복이 생긴다. 실제 DB(약 660명)로 교체하면 해소된다.
- 외부 이미지는 PNG 저장 시 빠질 수 있다(브라우저 보안 정책).

## 관리자 이름 바꾸기
Vercel 환경변수 `ADMIN_NAME`에 다른 이름을 넣고, `index.html`의 `const ADMIN_NAME='김현우'`도 같은 이름으로 바꾼다. 보안 장치가 아니라 운영 메뉴를 여는 열쇠일 뿐이다.

## v1.4 변경
- 깨어난 뒤 기억이 3단계로 떠오르고(세계관 → 역할 → 실루엣·키워드), 후보 4명 중 직접 맞힌 뒤 공개
- 결과는 카드 한 장(얼굴, 이름, 한 줄 판정, 키워드, 명대사, 영혼 구성비, MBTI 한 줄, 모임날 정보) + '더 알아보기'에 나머지
- 현생 MBTI는 선택 입력. 매칭에는 쓰지 않고, 전생 MBTI는 성향 축에서 추정해 농담 한 줄로만 사용
- 이미지가 있는 캐릭터에 작은 가산점 — DB 구축 시 이미지를 우선 채울 것

## v1.5 변경
- 이미지: 수집 스크립트(`scripts/fetch_images.py`), 외부 이미지 프록시(`api/img.js`), 관리자 화면에서 이미지 주소 붙여 넣기

## v1.6 변경
- `validate_db.py`를 다시 돌려도 수집한 이미지와 검수 완료(`verified: true`) 캐릭터가 유지됨, 시드와 같은 캐릭터는 추출본 우선
- 나무위키가 자동 접속을 막으면 `--browser`를 붙여 실제 크롬 창으로 수집 (`py -m pip install playwright` → `py -m playwright install chromium` 필요)

## v1.7 변경
- 캐릭터 DB 346명 / 93작품 (works_stier 1–100위 수집본 통합). 전원 이미지 있음
- 제외: 50위 육아일기·51위 자기 자?(미수집), 개꿈(성인 작품), 이미지를 못 구했거나 인물 확인이 안 된 캐릭터
  - 작품째 빠진 곳: 삼봉이발소, 오! 나의 교주님, 내 여자친구는 상남자, 좋아? 죽어!
- 이미지: 303명 나무위키, 43명 구글 이미지 썸네일(encrypted-tbn0.gstatic.com, 저해상도 — 원본 교체 권장)
  - 구글 이미지는 '작품명+이름' 재검색 결과에서 출처 제목에 캐릭터 이름이 있는 그림만 사용, 실존 인물·배우 사진 제외
- 결과 쏠림 완화: 거의 안 나오던 53명의 성향 축(E/M/S/X)을 1~2칸 조정. 1만 건 시뮬레이션에서 결과로 한 번도 안 나오는 캐릭터 27명 → 약 10명, 후보 10위에 못 드는 캐릭터 0명

## v1.8 변경 — 디자인: 오락실 전생 판독기
- 전체 테마를 90년대 오락실·CRT 콘셉트로 교체 (별 배경, 주사선, 화면 전환 글리치)
- 컬러: 블랙 #05030D · 마젠타 #FF2BD6 · 시안 #19F7FF · 코인 옐로 #FFE14D · HP 그린 #7CFF4F
- 서체: 로고 Black Han Sans(3겹 그림자) · 본문 Galmuri11 · 숫자·라벨 Press Start 2P
- 인트로: 전구 테두리 간판, 무지개 최면 구슬 진자, INSERT SOUL, 1UP/HI-SCORE
- 질문: STAGE 번호 + HP 바 진행도, '최면사' 이름표가 달린 RPG 대화창, ▶ 커서 선택지
- 결과: "판독 완료!" + 네온 카드, 최면 깊이로 S/A/B/C 랭크 도장, SYNC 게이지, 영혼 구성을 게임 바로 표시
- 소리: 버튼·선택지에 8비트 효과음 추가 (기존 최면 배경음 유지, 소리 끄기 버튼 그대로)
- 동작·데이터·API는 v1.7과 같음
