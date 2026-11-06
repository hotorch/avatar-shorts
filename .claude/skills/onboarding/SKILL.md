---
name: onboarding
description: 사람이 고른 자막 세트·폰트·브랜드 색·리듬·채널 규칙을 받아 내 취향(style/me.json)과 정책(style/policy.json)에 입히고, 예시 영상 위에 "내 디자인 1장"을 보여 준다. "온보딩:" 으로 시작하는 메모, "자막 세트 뉴스로", "브랜드 색 입혀줘", getdesign.md 의 DESIGN.md 를 붙여 넣었을 때, "강조색 #FF5A5F 로", "내 설정 보여줘" 요청에 사용. 좋아하는 영상으로 배우는 건 reference-taste, 레퍼런스를 정책으로 쪼개는 건 style-intake.
argument-hint: <내 선택 메모>
---

# 온보딩 — 고른 것을 입히기

사람은 [docs/TASTE-MANUAL.md](../../../docs/TASTE-MANUAL.md) 를 보고 고른 메모를 붙여 넣는다. 한국어, 쉬운 말. 묻지 않고 입힌 뒤 결과를 보여 준다.

```
메모 읽기 → 취향 적기 → 브랜드 색 → (채널 규칙) → 내 디자인 1장 → 요약
```

## 1. 메모 → 취향

한 줄씩 `npm run me -- --set <키>=<값> --why "온보딩"` 으로 적는다. 메모에 없는 줄은 건드리지 않는다.

| 메모 | 키 | 값 |
|---|---|---|
| 자막 세트 | `captions.set` | 기본 `basic` · 예능 `variety` · 뉴스 `news` · 다큐 `docu` · 터미널 `terminal` · 테크 `tech` · 에세이 `essay` |
| 폰트 | `captions.font` | SUIT `suit` · Pretendard `pretendard` · 나눔명조 `myeongjo` · 알림장 `allimjang` · Plex Mono `mono` |
| 자막 모양 | `captions.shape` | 흰 띠 `strip` · 검은 띠 `band` · 유리 `glass` · 글자만 `outline` · 노란 글자 `pop` · 터미널 `console` |
| 자막 움직임 | `captions.motion` | 없음 `none` · 쾅 `slam` · 쑥 `rise` · 초점 `focus` · 타자 `type` · 단어씩 `word` |
| 자막 크기 | `captions.scale` | 0.8 ~ 1.3 |
| 무음 | `edit.silence` | 타이트 `tight` · 보통 `natural` · 거의 안 자름 `off` |
| 훅 | `edit.structure` | 앞으로 `hook-first` · 말한 순서 그대로 `as-is` |
| 최대 길이 | `edit.maxLength` | 초 |
| B-roll | `broll.density` | 많이 `high` · 보통 `medium` · 적게 `low` |
| 효과음 | `sound.sfxVolume` | 0 ~ 1 (끄기 0) |

- 세트 + 한 칸은 함께 쓴다: "다큐인데 움직임만 쾅" → `captions.set=docu`, `captions.motion=slam`. 세트를 다시 고르면 예전에 덮어쓴 칸은 `npm run me -- --unset captions.motion` 으로 지운다.
- 유료 온보딩의 번호(`S22`, `F14`, `C04`, `M02`, `B14`)는 이 저장소에 없다. 받으면 "이 저장소는 이름으로 고릅니다" 하고 가장 가까운 이름을 제안한다. 지어내서 맞추지 않는다.

## 2. 브랜드 색

| 메모 | 할 일 |
|---|---|
| DESIGN.md 를 붙여 넣음 | 문서 전체를 `style/brand/<브랜드>.md` 로 저장 (git 제외) → `npm run brand -- style/brand/<브랜드>.md` |
| 파일 경로 | `npm run brand -- <경로>` |
| 내 강조색 `#FF5A5F` | `npm run brand -- --accent "#FF5A5F"` |
| 문서 + 내 강조색 | `npm run brand -- <문서> --accent "#FF5A5F"` |
| 바탕만 내 색 | `npm run brand -- <문서> --background "#101014"` |
| 브랜드 색 지우기 | `npm run brand -- --reset` |
| 팔레트 이름 (`violet-ink`) | `npm run me -- --set look.triad='"violet-ink"'` (승인 목록 `style/policy.json` `triad.approved`) |

- 출력의 ℹ️ (대비 때문에 조정한 색, 바탕을 바꾼 것)는 요약에 그대로 옮긴다. 사람이 고른 색이 바뀐 것은 알려야 한다.
- 가져오는 건 **색 값뿐**이다. 브랜드 이름·로고·서체·문구를 화면이나 plan 에 넣지 않는다.
- `style/brand/`·`DESIGN.md` 를 git 에 올리지 않는다. 남의 브랜드 색을 `policy.json` 승인 목록이나 공용 `style/taste.json` 에 넣지 않는다 (이 PC 의 내 취향까지만).

## 3. 내 채널 규칙 → 정책

"내 채널 규칙:" 줄은 취향이 아니라 **어기면 틀린 것**이다. `style/policy.json` 을 고치면 render 가 막기 시작하고, 이 저장소를 함께 쓰는 사람 모두에게 적용된다. 그래서 값을 고치기 전에 한 번 묻는다: "내 채널 규칙으로 고정할까요, 이번 영상만 예외로 둘까요?" (`style/README.md`).

| 규칙 | 키 | 범위 |
|---|---|---|
| 자막 한 줄 글자 수 | `captions.maxChars` | 12 ~ 18 |
| 한 자막의 강조 개수 | `captions.maxEmphPerCue` | 0 ~ 2 |
| 첫 몇 초는 얼굴 | `content.hookFaceSeconds` | 1 ~ 3 |
| 한 장면 최대 길이 | `scenes.maxSec` | 5 ~ 10 |

- 정책은 **조이기만** 한다. 범위를 벗어나 느슨하게 만들거나 `content.noFabrication`·`captionsVerbatim`·`face` 를 끄자는 말은 받지 않고 이유를 말한다.
- 고친 뒤 `npm run render -- taste-sample --check` 로 그 규칙이 실제로 걸리는지 본다 (예시 영상이 걸리는 건 정상이다, 내 영상은 그 규칙으로 만든다).

## 4. 내 디자인 1장

```bash
npm run sample
```
→ `projects/taste-sample/out/my-design.png`. **직접 열어 본다** (얼굴+자막 · 위 칸 판 · 화면 전체 장면 3칸). 자막이 읽히는지, 포인트색이 글자로 보이는지, 바탕이 고른 색인지. 글자가 안 읽히면 그 칸을 고치고 다시. 첫 실행은 예시 프로젝트를 만드느라 조금 더 걸린다.

## 5. 요약 (마지막 메시지)
- 시트 경로와 함께 표 하나: `| 항목 | 고른 것 | 들어간 곳 |` (취향 `style/me.json` / 정책 `style/policy.json`)
- 조정된 색이 있으면 한 줄씩
- 바꾸는 말 예시 한 줄: "자막 세트 다큐로", "강조색 #…로", "브랜드 지워줘"
- 다음: `/shorts 내영상.mp4`

"내 설정 보여줘" → `npm run me` 카드를 쉬운 말로. 처음으로 돌리기 → `style/me.json` 을 지워도 되는지 묻고 지운다.

## 꼭 지킬 것
- `style/taste.json`(공용 기본값)은 고치지 않는다. 한 사람의 선택은 `style/me.json` 이다 (`npm run me` · `npm run brand` 가 적는다. 직접 고치지 않는다).
- 세트를 바꿔도 글자는 말한 그대로, 18자·얼굴·강조 개수 정책은 그대로다.
- 목록에 없는 세트·폰트는 render 가 ❌ 로 막는다. 새 세트가 필요하면 `style-intake` 로 정책 `captions` 에 넣고 `src/captions/Captions.tsx` 를 고친다.
