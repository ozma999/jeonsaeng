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
pip install requests beautifulsoup4 anthropic
python scripts/crawl_namuwiki.py                 # 원문 수집 → scripts/cache/
export ANTHROPIC_API_KEY=...
python scripts/extract_characters.py --per-work 4   # 초안 → data/extracted/
python scripts/validate_db.py                    # 검증·병합 → data/characters.json, data/review.csv
node scripts/simulate.js 3000                    # 분포 재점검
```
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
