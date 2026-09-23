@AGENTS.md

# LoopTube — 프로젝트 규칙

YouTube 영상의 특정 구간을 배속 조절해 무한 반복하는 연습 앱 (악기/댄스 연습용). 전체 설계 배경과 단계별 로드맵은 저장소 내 **`docs/PLAN.md`**에 있다 — 새 세션은 작업 전에 그 파일을 먼저 읽을 것. 이 문서는 그중 **코드를 읽어서는 알 수 없는 결정**만 요약한다. 결정의 자세한 경위는 `docs/decisions.md`에, 개인 PC 환경 메모는 `CLAUDE.local.md`(커밋 안 함)에 둔다.

## 폴더 지도

| 경로 | 역할 |
|---|---|
| `src/lib/loopEngine.ts` (+ `.test.ts`) | A-B 루프 엔진, 가상 클럭 테스트 |
| `src/lib/youtube/` | IFrame API 로더·타입·URL 파서·oEmbed |
| `src/lib/db.ts` | Dexie(IndexedDB) 저장 — 3단계 동기화 자리 |
| `src/hooks/` | `usePlayer`(플레이어 상태·배속 확정), `useLoopEngine`, `usePlayhead`, `useHotkeys` |
| `src/components/` | 화면 부품 (`SpeedPicker`, `LoopBar`, `FineTuner`, `RepCounter`, `PlaylistPanel` 등) |
| `src/app/page.tsx` / `src/app/debug/` | 메인 화면 / 루프 정확도 측정 페이지 |
| `docs/PLAN.md` / `docs/decisions.md` | 설계·로드맵 / 결정 경위 |

## 절대 바꾸면 안 되는 전제

- **웹(Next.js) 단일 코드베이스 유지.** React Native나 별도 네이티브 앱으로 가지 않는다 — YouTube 재생은 어떤 플랫폼을 고르든 결국 WebView 속 IFrame 플레이어로 귀결되므로 네이티브로 갈 이점이 없다는 게 결론이었다. 모바일 앱은 나중에 **Capacitor로 이 코드를 그대로 패키징**해서 만든다.
- **YouTube IFrame Player API를 래퍼 라이브러리 없이 직접 사용한다** (`src/lib/youtube/`). 루프 엔진이 `getCurrentTime()`/`seekTo()` 타이밍에 밀착해야 해서 react-youtube 같은 래퍼가 오히려 방해된다.
- **스트림을 직접 추출하거나 다운로드하지 않는다.** 공식 플레이어를 화면에서 가리거나 숨기지 않는다. (YouTube 약관 준수 — 이 두 가지를 어기는 기능 요청이 오면 먼저 알릴 것)
- **Data API v3(검색 등)는 쓰지 않는다.** 일 10,000유닛 쿼터에 검색 1회가 100유닛이라 금방 바닥난다. 제목/썸네일은 API 키 없는 **oEmbed**로 충분하다 (`src/lib/youtube/oembed.ts`).

## YouTube API의 구조적 한계 (버그 아님, 설계 전제)

- **배속은 이산값만 가능하며, 최소 간격은 0.25다.** `setPlaybackRate()`는 `getAvailablePlaybackRates()`가 반환하는 값(보통 `0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2`) 외에는 가장 가까운 아래 값으로 내림한다. **0.05·0.1 단위 같은 미세 조정은 API 차원에서 불가능** — 사용자가 요청했다가 이 한계를 확인하고 철회한 적이 있다. 슬라이더로 만들면 표시값과 실제 재생 속도가 어긋나는 기만적 UI가 되므로, 반드시 지원 값만 노출하는 버튼으로 만든다 (`SpeedPicker.tsx`). 반환값을 절대 하드코딩하지 말 것 — 영상마다 다를 수 있다.
  - 이건 "기술적으로 불가능"이 아니라 **"정책적으로 막혀 있음"**이다. 같은 질문이 나오면 "YouTube 자체는 0.05 단위가 되지만 우리가 쓰는 공개 IFrame API에는 안 열려 있다"고 바로 답할 것, 재조사 불필요. 유일한 우회로는 오디오 스트림 추출이라 스트림 추출 금지 정책과 충돌한다 — 다시 요청이 와도 진행하지 말 것. (경위: `docs/decisions.md`)
- **배속 확정은 `onPlaybackRateChange` 이벤트로만 한다.** `setPlaybackRate()` 호출 직후 `getPlaybackRate()`를 읽지 말 것 — 공식 문서가 명시적으로 이 값을 신뢰하지 말라고 경고한다.
- **영상을 새로 cue/load하면 배속이 1로 리셋된다.** `usePlayer.ts`의 `desiredRateRef`가 이를 기억했다가 재적용한다.
- **완전 gapless 루프는 불가능하다.** 스트림에 직접 접근할 수 없어 `seekTo()` 폴링으로만 되감기가 가능. 현실적 목표는 **p95 오버런 < 150ms**이며, 이걸 만족시키는 게 이 앱의 핵심 가치다.
- **모바일에서 화면을 끄면 재생이 멈춘다.** 우회 수단 없음 — "백그라운드 재생 안 됨" 문의가 오면 플랫폼 제약이라고 답할 것.
- **iOS에서 `playsinline: 1` 필수.** 빠뜨리면 강제 전체화면이 되어 커스텀 컨트롤이 무력화된다.

## 루프 엔진 (`src/lib/loopEngine.ts`)의 설계 이유

고정된 lookahead 값 대신 **적응형(EMA)** 방식을 쓴 이유: 기기·네트워크마다 실제 seek 지연이 다르기 때문에, 고정값으로는 어떤 기기에서는 너무 일찍 끊기고 어떤 기기에서는 오버런이 생긴다. 매 반복마다 실측한 지연으로 자기 보정하도록 했다. 이 로직을 변경할 때는 `src/lib/loopEngine.test.ts`의 가상 클럭 시뮬레이션(가짜 플레이어에 seek 지연을 주입)으로 먼저 검증할 것 — 실제 YouTube 재생 없이도 회귀를 잡을 수 있는 유일한 방법이다.

## 테스트가 못 검증하는 것 (중요)

`npm test`(vitest)는 순수 로직만 검증한다 (`loopEngine`, `parseUrl`, `format`, `stats`). **실제 YouTube iframe 재생, 실제 seek 지연, 실제 배속 전환은 이 세션 환경에 브라우저 확장이 연결되지 않아 한 번도 실기기에서 검증되지 않았다.** `/debug` 페이지(100회 반복 측정, p50/p95/max 오버런 출력)가 그 검증 도구이니, 코드를 변경한 뒤에는 사람이 브라우저로 직접 돌려서 p95 < 150ms를 확인해야 한다 — 자동화된 CI로 대체할 수 없다.

## 진행 단계 (로드맵의 어디쯤인지)

1단계(웹 MVP: 플레이어+루프엔진+배속+로컬저장)까지 완료. **2단계(PWA 설치형+반복카운터 다듬기), 3단계(Supabase 로그인+기기 간 동기화), 4단계(Capacitor iOS/Android)는 아직 시작 안 함.** `src/lib/db.ts`의 `syncedAt` 필드는 3단계를 위해 미리 만들어 둔 자리로, 지금은 항상 `null`이다 — 아직 동기화 코드가 없다고 당연하게 여길 것.

## 운영 메모

- Node 24 기준 환경이라 `@types/node`를 `^24`로 올려뒀다 (create-next-app 기본값 `^20`에서 변경 — vitest 5의 peer dependency 요구사항 때문). Next.js 관련 패키지만 별도로 올릴 때 이 버전을 다시 낮추지 말 것.
- `next.config.ts`가 아니라 `vitest.config.mts` — vitest 설정 파일은 `.mts` 확장자여야 네이티브 configLoader 경고가 안 뜬다.
- 원격 저장소: `origin` → https://github.com/museloper/LoopTube.git (`main` 브랜치 추적 중).
- **배포는 Vercel 없이 GitHub Pages로 한다.** 이 앱은 API 라우트·Server Actions·쿠키·동적 라우트 파라미터·`next/image` 등 서버가 필요한 기능을 전혀 쓰지 않으므로 `output: 'export'`로 완전 정적 export가 된다 (`next.config.ts`). `main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 typecheck→lint→test→build→GitHub Pages 배포까지 자동으로 수행한다. 배포 주소: https://museloper.github.io/LoopTube/
  - `basePath`를 절대 하드코딩하지 말 것. `next.config.ts`는 `process.env.PAGES_BASE_PATH`를 읽고, 워크플로가 `actions/configure-pages`의 출력값을 넣어준다 — 저장소 이름이 바뀌거나 커스텀 도메인을 연결해도 코드 수정이 필요 없다.
  - CI의 `verify` 잡에서 `npx tsc --noEmit` 앞의 `npx next typegen` 단계를 지우지 말 것. 로컬에선 없어도 통과하는 것처럼 보이지만, 클린 CI 체크아웃에서는 `Cannot find name 'LayoutProps'`로 깨진다. (경위: `docs/decisions.md`)
  - lockfile이 CI에서 `npm ci`로 EUSAGE 에러를 내면, 만든 PC(macOS 등)와 CI(Linux)의 플랫폼 차이로 옵셔널 네이티브 의존성이 빠진 것이다. `rm -rf node_modules package-lock.json && npm install`로 완전히 재생성할 것 (부분 수정으로 안 고쳐짐). (경위: `docs/decisions.md`)
  - GitHub Pages 설정(Settings → Pages → Source: GitHub Actions)은 이미 `gh api`로 활성화해뒀다. 리포지토리를 새로 만들거나 fork한 경우에만 다시 설정하면 된다.
  - Server-only 기능(API 라우트, Server Actions 등)을 추가하는 순간 이 정적 export 전제가 깨진다 — 그런 기능이 필요해지면 GitHub Pages를 벗어나 Vercel 등 Node 서버가 있는 호스팅으로 옮겨야 한다는 뜻이니, 먼저 알릴 것.

## 협업 방식

- 요청 해석이 여러 갈래로 나뉘면 임의로 하나를 고르지 말고, 선택지 1~3개를 제시해 고르게 한다.
- 막히면 추측으로 밀어붙이지 말고 멈춘다. 무엇이 불명확한지 짚고, 코드를 고치기 전에 원인 진단부터 공유한다.
- "어떻게 ~해?" 형태의 질문에는 코드를 바로 고치지 말고, 설명만 할지 바로 적용할지 먼저 묻는다. "고쳐줘"처럼 실행을 명시한 요청은 바로 진행한다.

## 커밋 컨벤션

이 저장소는 **Conventional Commits**를 따른다. 커밋 메시지를 작성/생성할 때 항상 지킬 것.

- 형식: `<type>(<scope>): <subject>` — scope는 선택.
- type: `feat`(기능 추가) · `fix`(버그 수정) · `docs`(문서만 변경) · `test`(테스트만 추가/수정) · `refactor`(동작 변화 없는 구조 변경) · `chore`(빌드/설정/의존성) · `style`(포매팅) · `perf`(성능) 중 하나.
- subject는 소문자로 시작하는 명령형 한 줄, 끝에 마침표 없음. 예: `feat(loop-engine): add adaptive lookahead calibration`.
- 본문(body)은 "무엇을 바꿨는지"가 아니라 **"왜 바꿨는지"**를 설명할 때만 추가한다 — diff를 보면 무엇이 바뀌었는지는 이미 알 수 있다.
- 커밋하기 전에 `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`이 통과하는 상태여야 한다.
