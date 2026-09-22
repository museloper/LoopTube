# LoopTube

YouTube 영상의 원하는 구간을 원하는 배속으로 무한 반복하는 악기·댄스 연습 도구입니다.

배포 주소: https://museloper.github.io/LoopTube/

## 기능

- 영상 / 재생목록 링크 붙여넣기 (`watch?v=`, `youtu.be/`, `/shorts/`, `/playlist?list=` 등)
- A-B 구간 지정: 타임라인 드래그, 0.1초·1초 단위 미세 조정, "직전 3초를 구간으로"
- 배속: 플레이어가 지원하는 값만 버튼으로 노출 (YouTube IFrame API 제약상 0.25 단위)
- 반복 카운터, 반복 사이 쉬는 시간, N회마다 자동 속도 올리기
- 구간 저장 (브라우저 IndexedDB, 로그인 불필요)
- 단축키: `Space` 재생 · `A`/`B` 지점 지정 · `L` 반복 · `←`/`→` 0.1초 · `Shift`+`←`/`→` 1초 · `[`/`]` 속도

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest — 루프 엔진·URL 파싱 등 순수 로직
npx tsc --noEmit
npx eslint src
```

### 루프 정확도 측정 (`/debug`)

자동 테스트는 실제 YouTube 재생을 검증하지 못합니다. 루프 엔진을 바꾼 뒤에는 브라우저에서
`/debug` 페이지를 열어 영상을 불러오고 "측정 시작"을 눌러 100회 반복을 돌린 다음,
**21회 이후 p95 오버런이 150ms 미만**인지 직접 확인하세요.

## 배포

`main` 브랜치에 push하면 GitHub Actions(`.github/workflows/deploy.yml`)가
typecheck → lint → test → 정적 export 빌드 → GitHub Pages 배포를 수행합니다.
서버 기능이 없는 완전 정적 사이트(`output: "export"`)입니다.

설계 배경과 로드맵은 [`docs/PLAN.md`](docs/PLAN.md)에 있습니다.
