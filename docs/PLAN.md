# YouTube 구간 반복 · 배속 연습 앱 (LoopTube)

> 이 문서는 저장소에 커밋되는 계획서다. `CLAUDE.md`가 이 문서를 가리키므로, 새 머신에서 클론해도 로컬 세션 파일 없이 그대로 읽을 수 있다.

## Context

악기/댄스 연습을 위해 YouTube 영상의 특정 구간(1~5초의 짧은 소절 포함)을 느린 배속으로 무한 반복하는 앱. 기존 전용 앱(Amazing Slow Downer 등)은 로컬 오디오 파일만 다루고, YouTube 자체 기능은 A-B 구간 반복을 지원하지 않는다.

요구사항: 데스크톱 + 모바일(iOS/Android) 양쪽에서 사용, 저장한 루프를 기기 간 동기화.

### 결론: 구현 가능. 단, 아래 3가지는 YouTube API의 구조적 한계이므로 설계 전제로 삼는다.

1. **배속은 이산값만 가능.** `setPlaybackRate()`는 `getAvailablePlaybackRates()`가 반환하는 목록(보통 `0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2`)만 받고, 그 외 값은 **가장 가까운 아래 값으로 내림**한다. 0.6x·0.85x 같은 미세 조정은 불가능 → **슬라이더 UI를 쓰면 안 되고, 지원 값만 노출하는 세그먼트 버튼**으로 만든다.
2. **루프 이음새(seam)에 미세한 끊김이 남는다.** 스트림에 직접 접근할 수 없어 `seekTo()` 호출로만 되감기가 가능하다. 완전 gapless는 불가능하며, 현실적 목표는 **오버런 p95 < 150ms**다.
3. **모바일 백그라운드 재생 불가.** 화면을 끄면 정지한다. 플랫폼/약관 제약이며 우회 수단은 없다.

**좋은 소식:** 공식 문서상 `seekTo()`는 *"이미 다운로드된 구간으로 seek하는 경우"* 키프레임으로 스냅하지 않는다. 짧은 연습 루프는 항상 버퍼 안에 있으므로 **프레임 단위로 정확히 착지한다.** 또한 배속 변경 시 브라우저가 피치를 자동 보정(`preservesPitch`)하므로 0.5배속에서도 음정이 유지된다 — 악기 연습에 적합.

---

## 플랫폼 선택: 웹(PWA) 단일 코드베이스 → Capacitor로 앱 패키징

**핵심 근거: 어떤 플랫폼을 고르든 YouTube 재생은 결국 WebView 안의 IFrame 플레이어에서 돌아간다.**
공식 Android Player API는 지원 종료됐고, 스트림 직접 추출은 약관 위반이다. React Native의 `react-native-youtube-iframe`조차 내부는 WebView + IFrame API다. 즉 **네이티브로 가도 얻는 이점이 0**이므로, 웹 코드 1벌로 4개 타깃(데스크톱 브라우저 · 모바일 브라우저 · iOS 앱 · Android 앱)을 커버하는 것이 유일하게 합리적인 선택이다.

| 레이어 | 선택 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js (App Router) + TypeScript** | Capacitor용 정적 export 지원 |
| 스타일 | **Tailwind CSS** | |
| 플레이어 | **YouTube IFrame Player API** (직접 로드, 래퍼 라이브러리 없이) | 루프 엔진이 플레이어 내부 타이밍에 밀착해야 해서 래퍼가 오히려 방해됨 |
| 로컬 저장 | **Dexie (IndexedDB)** | 비로그인 상태에서도 100% 동작 |
| 동기화 | **Supabase** (Google OAuth + Postgres + RLS) | 무료 티어로 충분 — 3단계에서 도입 |
| 웹 배포 | **Vercel** | |
| 앱 패키징 | **Capacitor** | 동일 코드 → iOS/Android — 4단계에서 도입 |

---

## 구현 계획

### 파일 구조
```
looptube/
├── src/
│   ├── app/
│   │   ├── page.tsx                 # 메인 연습 화면
│   │   ├── debug/page.tsx           # 루프 정확도 측정 harness
│   │   └── layout.tsx
│   ├── components/
│   │   ├── Player.tsx               # IFrame 플레이어 마운트
│   │   ├── LoopBar.tsx              # 타임라인 + A/B 핸들 + 구간 하이라이트
│   │   ├── SpeedPicker.tsx          # 지원 배속만 세그먼트 버튼으로
│   │   ├── FineTuner.tsx            # A/B ±0.1초 미세 조정
│   │   ├── RepCounter.tsx           # 반복 횟수 + 자동 속도 상승
│   │   ├── LoopLibrary.tsx          # 저장된 루프 목록
│   │   └── UrlInput.tsx             # YouTube 링크 파싱 입력
│   ├── lib/
│   │   ├── youtube/
│   │   │   ├── loadApi.ts           # IFrame API 스크립트 싱글톤 로더
│   │   │   ├── parseUrl.ts          # watch / youtu.be / shorts / &t= 파싱
│   │   │   ├── oembed.ts            # 제목·썸네일 (API 키 불필요)
│   │   │   └── types.ts             # IFrame API 타입 정의
│   │   ├── loopEngine.ts            # ★ 핵심: rAF 루프 + 적응형 lookahead
│   │   ├── db.ts                    # Dexie 스키마
│   │   ├── format.ts / stats.ts
│   │   └── sync.ts                  # (미구현, 3단계) Supabase 동기화
│   └── hooks/
│       ├── usePlayer.ts
│       ├── useLoopEngine.ts
│       ├── usePlayhead.ts
│       └── useHotkeys.ts
├── capacitor.config.ts              # (미구현, 4단계)
└── supabase/migrations/             # (미구현, 3단계)
```

### ★ 핵심: 루프 엔진 (`src/lib/loopEngine.ts`)

정확도가 이 앱의 전부이므로 여기에 가장 많은 공을 들인다.

```ts
// 매 프레임(~16ms) getCurrentTime()을 폴링하고,
// B 지점에 "도달하기 전에" 미리 seek을 건다.
function tick() {
  if (player.getPlayerState() === BUFFERING) { raf(tick); return; } // 버퍼링 중엔 판정 스킵
  const t = player.getCurrentTime();
  const rate = currentRate;                 // onPlaybackRateChange로 확정된 값
  // lookahead는 "실시간 초" 단위이므로 배속을 곱해 미디어 시간으로 환산
  if (t >= B - lookahead * rate) {
    seekIssuedAt = performance.now();
    player.seekTo(A, true);
    reps += 1;
    onRep(reps);                            // 반복 카운터 / 자동 속도 상승 훅
  }
  raf(tick);
}
```

**적응형 lookahead** — 고정값으로는 기기·네트워크마다 오버런이 달라진다. seek 직후 실제 착지 시간을 측정해 자기 보정한다:

```ts
// seek 후 첫 프레임에서 실측
const landed = player.getCurrentTime();
const overshoot = landed - A;               // A보다 얼마나 지나쳐 착지했나
lookahead = clamp(lookahead * 0.85 + (lookahead + overshoot) * 0.15, 0.03, 0.4); // EMA
```

초기값 `lookahead = 0.08`. 10~20회 반복이면 해당 기기에 수렴한다.

**나머지 규칙**
- 배속은 `setPlaybackRate()` 호출 결과를 믿지 말고 **`onPlaybackRateChange` 이벤트로만** `currentRate`를 갱신한다 (문서 명시 사항).
- 영상이 cue될 때 배속이 1로 리셋되므로 `onStateChange`에서 재적용한다.
- `seekTo`의 두 번째 인자는 `true`. 루프 구간은 이미 버퍼에 있어 추가 요청이 발생하지 않는다.

### UX — 연습 앱에 특화된 부분

- **A/B 지정**: 재생 중 `A`/`B` 키 한 번으로 현재 지점 찍기. "방금 지나간 3초를 A로" 버튼도 제공(악기 연습 중엔 손이 늦다).
- **미세 조정**: A/B 각각 ±0.1초 버튼. 소절 시작을 정확히 맞추는 데 필수.
- **자동 속도 상승**: "N회 반복마다 다음 배속으로" — 0.5 → 0.75 → 1.0. 연습 앱의 킬러 기능.
- **반복 사이 쉬는 시간**: 0~3초 설정 (댄스 연습 시 자세 리셋용).
- **단축키**: `Space` 재생/정지, `A`/`B` 지점 찍기, `←`/`→` 0.1초, `Shift+←/→` 1초, `[`/`]` 배속.
- 타임라인은 직접 그린 바 형태. (오디오 파형은 스트림 접근이 불가능해 구현할 수 없음)

### 영상 불러오기
URL 붙여넣기 방식. 제목·썸네일은 **oEmbed**(`https://www.youtube.com/oembed?url=...&format=json`)로 가져온다 — API 키도 쿼터도 필요 없다.
※ Data API v3 검색은 1회당 100 유닛이라 일 100회밖에 못 쓴다. 범위에서 제외한다.

### 데이터 모델 (3단계에서 실제 생성)
```sql
loops (
  id uuid pk, user_id uuid references auth.users,
  video_id text, video_title text, label text,
  start_sec numeric, end_sec numeric, playback_rate numeric,
  created_at timestamptz, updated_at timestamptz
)
-- RLS: user_id = auth.uid()
```
로컬(Dexie) 우선 저장 → 로그인 시 `updated_at` 기준 last-write-wins 병합. 비로그인 사용자도 모든 기능을 쓸 수 있고, 나중에 로그인하면 로컬 데이터가 그대로 업로드된다. `src/lib/db.ts`의 `Loop.syncedAt` 필드는 이를 위해 미리 만들어 둔 자리이며, 동기화 코드가 붙기 전까지는 항상 `null`이다.

### 플랫폼별 함정 (미리 처리)
- **iOS 전반**: `playerVars`에 `playsinline: 1` 필수. 빠뜨리면 재생 시 강제 전체화면이 되어 커스텀 컨트롤이 무력화된다. (구현됨: `usePlayer.ts`)
- **Capacitor iOS의 Error 153** (4단계에서 실제로 마주칠 이슈): WKWebView가 referrer를 정상적으로 보내지 않아 발생. `capacitor.config.ts`에 `server.iosScheme: 'https'` + `server.hostname`을 설정하고, `playerVars.origin`에 동일 호스트를 넘겨 해결한다.
- **임베드 차단 영상** (`onError` 101/150): 재생 불가 안내 UI. (구현됨)
- **광고**: 임베드 플레이어의 광고는 스킵할 수 없다. 광고 재생 중에는 루프 엔진을 일시 정지시켜야 한다. (미구현 — 알려진 갭)
- **약관 준수**: 공식 IFrame 플레이어를 가리거나 숨기지 않는다. 스트림 추출·다운로드는 하지 않는다. 현재 설계(플레이어는 그대로 보이고, 외부에 컨트롤을 덧붙이는 방식)는 허용 범위 안에 있다.

---

## 단계별 진행

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 웹 MVP — 플레이어 + 루프 엔진 + 배속 + 로컬 저장 | ✅ 완료 |
| 2 | PWA(설치형) + 단축키 + 반복 카운터/자동 속도 상승 | ⏳ 부분(단축키·반복카운터는 1단계에서 이미 구현됨, PWA manifest/service worker는 미구현) |
| 3 | Supabase 로그인 + 기기 간 동기화 | ❌ 미착수 |
| 4 | Capacitor iOS/Android 빌드 | ❌ 미착수 |

1단계 완료 시점에 이미 데스크톱·모바일 브라우저에서 모두 쓸 수 있다.

---

## 검증

**루프 정확도 (가장 중요 — 1단계에서 바로 측정)**
`/debug` 페이지에서 3초짜리 구간을 100회 자동 반복시키고, 매 회 실제 착지 시간과 오버런을 기록해 p50/p95/max를 출력한다. (구현됨)
- 목표: **p95 오버런 < 150ms**, 적응형 lookahead 수렴 후 p50 < 60ms
- 0.25x / 0.5x / 1x / 2x 각 배속에서 측정 (배속별로 오차 특성이 다르다)
- Chrome 데스크톱 + iOS Safari + Android Chrome 3종에서 각각 확인
- **이 수치는 실기기 브라우저에서 사람이 직접 확인해야 한다.** `loopEngine.test.ts`의 가상 클럭 시뮬레이션은 엔진 로직의 회귀만 잡을 뿐, 실제 YouTube 플레이어의 seek 거동을 검증하지는 못한다.

**기능 확인**
- `getAvailablePlaybackRates()` 반환값이 UI에 그대로 반영되는지 (하드코딩하지 않았는지)
- 새 영상 cue 후 배속이 유지되는지 (리셋 버그)
- 임베드 차단 영상 URL을 넣었을 때 안내가 뜨는지
- 비로그인으로 루프 저장 → 로그인 → 다른 기기에서 조회되는지 (3단계 완료 후)

**모바일 빌드** (4단계)
`npx cap run ios` / `npx cap run android`로 실기기에서 재생·루프·배속이 모두 동작하는지, Error 153이 재발하지 않는지 확인.

---

## 참고
- [YouTube IFrame Player API Reference](https://developers.google.com/youtube/iframe_api_reference)
- [YouTube Embedded Players and Player Parameters](https://developers.google.com/youtube/player_parameters)
- [Looping and slowing videos via YouTube's IFrame player API — Oisín Bates](https://oisinbates.com/youtube-looping/)
- [Fixing YouTube Error 153 in iOS Capacitor apps](https://dev.to/davidvesely/fixing-youtube-error-153-in-ios-capacitor-apps-a-simple-proxy-solution-607)
