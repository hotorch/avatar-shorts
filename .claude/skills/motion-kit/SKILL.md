---
name: motion-kit
description: 템플릿으로 표현할 수 없는 장면을 Remotion 커스텀 컴포넌트로 만들 때의 부품(kit) 사용법과 규칙. "이 장면은 직접 만들어줘", 템플릿 수정, 새 템플릿 추가 요청에 사용.
---

# motion-kit — 커스텀 장면 만들기

대부분은 템플릿 11종으로 충분하다. 꼭 필요할 때만 커스텀을 만든다. 먼저 `../broll-plan/references/design-rules.md` 를 읽는다.

## 순서
1. `src/custom/OrbitIdea.tsx` 를 복사해 `src/custom/<이름>.tsx` 로 시작.
2. `src/custom/index.ts` 의 `CUSTOM` 에 한 줄 등록.
3. plan.json: `{"template": "custom", "component": "<이름>", "props": {...}}`
   - 이름은 그 영상 말고도 쓸 수 있게 **일반적으로** (`LightBloom` 처럼. `AvatarV01Scene` ✗). 만든 장면은 저장소 코드가 되므로 결정 요약에 "새 장면 `src/custom/<이름>.tsx` 를 만들었어요 — 다른 영상에서도 씁니다" 한 줄을 남긴다.
4. 빠른 확인: `npm run still -- <이름> <원본 초…>` 또는 `--scene <id>` (시작·가운데·끝). 프레임·편집 시간 계산은 스크립트가 한다 — 직접 `remotion still --frame` 을 계산하지 않는다 (렌더 fps 30 ≠ 원본 fps, 편집으로 시간이 밀림).
5. `npm test` 통과 확인 (타입 + 등록 누락 + 회귀). 새 템플릿이면 `src/scenes/index.tsx` · `scripts/render.mjs` 의 templates · `broll-plan/references/templates.md` 세 곳에 넣는다 (시험이 어긋나면 잡는다).

## 시계와 무대
```tsx
const {start, end} = useScene();   // 이 장면의 원본 기준 시작/끝(초)
const now = useNow();              // 지금(원본 기준 초)
const {w, h, u, wide, kind} = useStage(); // 무대 크기, u=기준 스케일(모든 px 에 곱하기), wide=가로형 무대
```
- 무대 크기는 세로 전체(1080×~1310) / 세로 위 칸(1080×~860) / 가로 오른쪽(1190×800) / 가로 넓게(1530×830). **px 에는 항상 `* u`**, 가로형이면 `wide` 로 배치를 바꾼다.

## 좌표 규칙 (자주 틀리는 곳)
- `Card`, `Object3D`, `GradientPanel`, `Blob` 의 `x, y` 는 **가운데** 좌표다. 왼쪽 위가 아니다.
- 무대(`useStage`)의 (0,0) 은 무대 왼쪽 위. 세로 컷어웨이 무대는 화면 위 120px 부터, 자막(1470px) 위 40px 까지.
- 장면의 모든 등장 시각은 props 로 받아 **원본 시간**으로 쓴다 (render 가 편집 시간으로 옮기는 키: `in out t at times titleTimes *At`). 이 이름을 벗어난 시간 prop 은 옮겨지지 않는다 → 이름을 `…At` 으로 짓는다.
- 장면이 열리면 0.4초 안에 뭔가 보여야 한다. 핵심 순간(예: bloomAt)을 기다리는 동안 보여 줄 '앞 상태'를 둔다.

## 움직임 부품 (`src/kit/motion.ts`)
| 함수 | 용도 |
|---|---|
| `useSpringAt(at, 'pop' \| 'soft' \| 'snap', delayFrames?)` | at 초에 시작하는 0→1 스프링 (pop = 7% 오버슈트) |
| `useProgress(at, dur, EASE.out)` | 이징 진행도 0→1 |
| `useExit(0.35)` | 장면 끝 퇴장 진행도 0→1 (영상 마지막 장면이면 0 고정) |
| `useFloat(amp, period, phase)` | 느린 부유 (깊이마다 다른 값으로 패럴랙스) |
| `stagger(items, base, gap)` | 항목별 등장 시각 (at 우선) |

## 시각 부품
| 부품 | 파일 | 한 줄 설명 |
|---|---|---|
| `<Backdrop/>` `<Grid/>` `<Grain/>` `<Blob/>` | kit/Backdrop | 바탕·격자·대각선 2개·종이결·유기 도형 |
| `<Object3D name at size x y material from depth/>` | kit/Object3D | 주인공 3D 오브젝트 (떠오름+그림자+부유) |
| `<ObjIcon name size material/>` | kit/Object3D | 작은 정적 아이콘 |
| `<KText text at times size weight align/>` | kit/KText | 한글 단어 마스크 등장 (`*세리프*`, `_강조_`) |
| `<GhostText text/>` | kit/KText | 흐르는 대형 배경 글자 |
| `<Card at w h x y z from tone/>` | kit/Parts | 2.5D 카드 (z=깊이) |
| `<Pill/>` `<Star4/>` `<CheckDot/>` | kit/Parts | 라벨, 네 갈래 별, 체크 |
| `<Marker at kind w h x y/>` | kit/Parts | 손그림 밑줄·동그라미·체크·취소선·화살표 |
| `<Cursor path clicks/>` | kit/Parts | 경로 따라 움직이는 커서 + 클릭 파문 |
| `<Counter at to prefix suffix/>` | kit/Parts | 숫자 카운트업 |
| `<TypeText text at cps/>` `<Bubble/>` `<AppWindow/>` `<Bar/>` | kit/Parts | 타이핑, 말풍선, 앱 창, 막대 |
| `<GradientPanel w h x y at/>` `gradientSurface(triad,w,h)` `<PaletteCard w/>` | kit/Gradient | 트라이어드 그라디언트 면 (정책 레시피), 3색 팔레트 카드. `Card tone="gradient"` 도 가능 |
| `useTheme()` `alpha()` `FONT` | kit/theme | 팔레트 색·트라이어드(`t.triad`)·면(`t.surface`)·글꼴 스택 |
| `fitSize(text, size, maxW)` `textWidth()` | kit/measure | 폭에 맞춰 글자 크기 |

## 색 (정책 `sceneColors`)
바탕·면·타일은 `useTheme()` 의 팔레트·트라이어드(`t.triad.dark/accent/light`, `t.accent`)와 그 색에 검정을 섞은 명암만. 레퍼런스 사진 색을 가져오지 않는다. 예: `StackCarousel` 의 바탕 = 타일 색을 어둡게.

## 레퍼런스 모션을 옮길 때
- 그 움직임만 옮기고, 레퍼런스의 타이포·라벨·사진은 가져오지 않는다 (사용자가 좋다고 한 부분만).
- 화면 전체 레이아웃의 전환(아바타가 커지며 돌아오기 등)은 장면이 아니라 `src/layouts/Vertical.tsx` 에 넣고, 수치는 정책에 둔다 (`avatarGrow` 처럼 render 가 plan 으로 넘김 → 코드에 따로 적지 않음).

## Remotion 규칙 (렌더가 깨지지 않게)
- 모든 움직임은 프레임의 함수: `spring`, `interpolate` 만. **CSS transition / @keyframes / setTimeout / Math.random 금지** (랜덤은 `random('seed')`).
- 이미지는 `<Img>`, 영상은 `<OffthreadVideo>`, 파일은 `staticFile('objects/…')`.
- `interpolate` 입력 범위는 반드시 증가 순서. 짧은 장면에서 겹치지 않게 `Math.min` 으로 보호.
- 글꼴은 이미 로드됨 (`FONT.sans` 등). 외부 URL 폰트·CDN 금지 (오프라인 렌더).
- 한글은 `wordBreak: 'keep-all'`.
- SVG 도형을 직접 그려도 좋다 (뇌, 눈, 모래시계 등 목록에 없는 오브젝트). 선은 `pathLength={1}` + `strokeDashoffset` 로 그려지게.

공식 Remotion 규칙이 더 필요하면 선택 설치: `npx skills add remotion-dev/skills`
