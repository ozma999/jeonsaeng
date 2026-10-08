# 전생체험 — 당신은 전생에 어떤 웹툰 캐릭터였나 (페이지 v1)

사내 오타쿠 동호회 행사용. 기획 근거는 `docs/기획안_v3.html`.

## 구성
| 경로 | 내용 |
|---|---|
| `index.html` | 체험 · 결과 · 관리자(`?admin`) · 발표 모드(`?present`) 단일 페이지 |
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
3. Vercel Storage 또는 Upstash에서 Redis를 만들고, 환경변수 4개를 넣는다 (`.env.example` 참고).
4. 배포 후 `https://<주소>/?admin` 에서 관리자 코드로 접속해 동작을 확인한다.

## 로컬 확인
```
node scripts/dev-server.js        # http://localhost:3000  (입장 코드 demo / 관리자 코드 admin)
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

## 행사 운영 순서
1. 오픈: 입장 코드를 동호회에 공유. 참가자는 체험 직후 본인 결과를 본다.
2. 응답 마감 후 관리자 화면에서 **전역 재배정 실행** → 결과를 훑고 어색한 배정은 후보 목록에서 수동 지정.
3. 행사 당일 **인연 공개 켜기** → 참가자 결과 화면에 전생 인연 표시, `?present` 발표 모드 사용 (→/스페이스: 다음, ←: 이전).

## 알려진 한계 (v1)
- 결과 문구는 템플릿 조립. Claude API 개인별 서사 생성은 다음 단계.
- 시드 DB가 49명이라 50명 이상이 참여하면 중복이 생긴다. 실제 DB(약 660명)로 교체하면 해소된다.
- 외부 이미지는 PNG 저장 시 빠질 수 있다(브라우저 보안 정책).
