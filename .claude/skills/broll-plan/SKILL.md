---
name: broll-plan
description: 자막(words.json, captions.json)을 보고 어느 문장에 어떤 모션그래픽 B-roll을 얹을지 설계해 계획표와 plan.json 을 만든다. /shorts 의 ④ 단계, 또는 "비롤 다시 짜줘", "장면 바꿔줘" 요청에 사용.
---

# B-roll 계획: 대사 → 장면

먼저 읽기: `references/design-rules.md`(시각 규칙), `references/templates.md`(템플릿 props), `references/objects.md`(오브젝트 은유).
양은 취향 `broll.density`(low/medium/high)를 따른다 — 묻지 않는다. 확인: `node scripts/style.mjs <이름>`.

**시간 기준**: plan.json 의 모든 시간은 **원본 시간**(`words.json`)으로 쓴다. `edit.py` 로 편집했어도 마찬가지 — render 가 편집본 시간으로 옮긴다.
단, 재배치 경계를 넘는 장면은 쓸 수 없고(`edit.json` 의 덩어리 안에서만), 무음이 잘리면 장면이 짧아지므로 여유를 둔다 (정책 최소 1.2초).

## 1. 어디에 얹을까 (밀도)
| 양 | 기준 |
|---|---|
| low | 분당 2~4개. 핵심 주장·숫자·목록만 |
| medium | 분당 4~7개. 개념 설명, 비교, 과정 추가 |
| high | 대부분 문장. 얼굴 구간은 훅·감정·결론만 |

**얹기 좋은 문장**: 명사가 분명한 설명, 비교(A vs B), 순서·단계, 목록, 실제로 말한 숫자, 도구·앱 사용 장면, 정의 한 줄.
**얼굴로 둘 문장**: 첫 1초 훅, 감정·의견·경험담, 질문 던지기, 부탁·CTA.

## 2. 장면 규칙
- 한 장면 **3~8초**(최소 1.2초). 장면 사이 얼굴이 최소 ~1.5초 보이게 (많이 모드 제외).
- `in` 은 그 문장 첫 단어 시작 ~0.1초 전. 첫 요소가 `in` 뒤 0.4초 안에 나타나게 한다 (빈 화면 금지).
- 장면 안의 모든 등장 시각(`at`, `times`, `t`)은 **words.json 의 단어 start** 에서 가져온다. 말하는 순간 = 움직이는 순간.
  찾기: `npm run words -- <이름>` (큐별 단어@시각) · `npm run words -- <이름> 번지죠 git` (그 단어만). 파이썬 한 줄로 직접 뽑지 않는다.
- **한 비트에 한 변화**. 비트 간격 0.4~1.2초. 한 장면에 변화 2~4번이면 충분.
- 화면 글자 1~4어절. 자막과 똑같은 문장을 통째로 반복하지 않는다 (핵심어만).
- 방식 선택 (세로). 취향 `broll.framing` 이 `varied`(기본)면 한 영상에서 섞는다. 장면 6개 이상이면 3가지 이상, `split` 이면 panel·cutaway 만.
  | 방식 | 모습 | 어울리는 대사 | 템플릿 |
  |---|---|---|---|
  | `above` | 머리 위에 떠 있는 카드. 얼굴·표정이 계속 보여 신뢰감 | 훅, 한 단어·제품명, UI 입력(검색창·터미널·토글) | morph, keyword, stat, media |
  | `below` | 턱 아래 가슴 쪽 카드 | 핵심어 강조, 실제로 말한 숫자, 짧은 결론 | morph, keyword, stat, media |
  | `panel` | 위 칸 판, 얼굴은 아래 | UI 시연, 목록, 말을 이어가며 보여줄 때 | 전부 |
  | `cutaway` | 화면 전체 | 개념, 비교, 전환, 큰 3D 오브젝트 | 전부 |
  - 자리는 머리 위치(`video.json` track)로 **계산된다** (`src/layouts/framing.js`). `render --check` 가 ℹ️ 로 판 높이·카드 높이·아바타 이동을 보여 주고, 얼굴(정수리~턱)을 가리게 되면 ❌ (정책 `face`) → 다른 방식으로.
  - 머리 위가 좁은 영상은 above 에서 아바타를 내리고 드러난 위쪽을 흐린 영상으로 채운다. 얼굴이 화면을 꽉 채우면 panel 이 ❌ 일 수 있다 → above/below.
  - 같은 방식이 이어지면(0.6초 이내) 한 번에 배치된다. above↔below 를 바로 붙이면 아바타가 오르내리니, 붙일 거면 같은 방식으로 묶는다.
  - 가로: 기본 `panel`(오른쪽 무대), 넓게 보여줄 것만 `cutaway`(아바타가 작아짐). above/below 는 panel 과 같다. 장면이 없는 구간은 말하는 문장이 오른쪽에 크게 뜨므로 빈 화면 걱정 없음.
- 같은 템플릿 연속 3번 금지. 영상 전체에서 3~5가지 템플릿을 섞는다.
- **바로 이웃한 두 장면은 지문(배치·모션·주인공·첫 효과음)이 2개 이상 같으면 안 된다.** 주인공 오브젝트가 같아도 안 된다 (정책 `variety`, 렌더가 막는다). list·steps 는 같은 모션. 쓰고 나면 `storyboard` 스킬로 확인.
- 효과음은 동작에 1:1 로. 장면당 1~3개. `sfx` 를 비우면 시작에 옅은 whoosh 가 자동으로 들어간다.
  효과음: whoosh, whoosh-soft, pop, click, tick, thud, paper, sparkle, coin, marker, air

## 3. 절대 금지
- 영상에서 말하지 않은 숫자·가격·결과·로고·인용
- 파티클, 과한 글로우, 무지개 그라디언트, 흔들리는 카메라
- 얼굴(정수리~턱)을 가리는 배치 — 정책 `face`, `render --check` 가 막는다

## 4. 계획표 → plan.json
계획표(`| # | 구간 | 대사 | 화면에 나올 것 | 방식 |`)를 만들고 **바로 plan.json 을 쓴다** — 승인을 기다리는 건 취향 `ask: "always"` 일 때만. 표는 결정 요약에 넣는다 (사용자에게 JSON 은 보여 주지 않는다).

```json
{
  "title": "영상 제목",
  "theme": {"palette": "editorial", "accent": "purple"},
  "sfxVolume": 0.5,
  "scenes": [
    {"id": "01", "in": 3.2, "out": 7.0, "mode": "cutaway", "template": "compare",
     "props": {"left": {"title": "컷 편집", "object": "video-camera", "at": 4.62},
               "right": {"title": "자막 · 비롤", "object": "clock", "at": 5.5},
               "winner": "right", "winnerAt": 6.06},
     "sfx": [{"t": 3.2, "cue": "whoosh"}, {"t": 6.06, "cue": "thud", "volume": 0.6}]}
  ]
}
```
- `layout`, `duration`, `video`, `captions` 는 비워둔다 → 렌더 스크립트가 video.json / captions.json 에서 채운다.
- palette: `editorial` | `darktech` | `academic`. 트라이어드·그라디언트 면(`surface`)·효과음 볼륨·자막 크기는 취향에서 채워지므로 보통 적지 않는다.
  accent 는 트라이어드를 쓰면 무시된다(정책: 한 영상 한 강조색).
- 작성 후 `npm run storyboard -- <slug>` (검사 + 장면별 프레임 시트)로 확인한다 → `storyboard` 스킬.
