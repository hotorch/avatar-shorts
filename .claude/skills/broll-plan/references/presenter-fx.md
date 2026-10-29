# 발표자 효과 (mode `fx`) — 발표자 위에 얹는 6종

발표자 영상에서 사람을 오려내(`npm run fx`, rembg u2net) 그래픽을 발표자 **뒤와 앞**에 놓는다.
B-roll 이 발표자를 덮거나 비켜 가는 것과 달리, 이건 **발표자가 주인공인 채로** 장면이 된다. 코드: `src/fx/`, 기준: 정책 `presenterFx`, 검사: `scripts/fx-rules.mjs`.

## 언제 쓰나 — 랜덤이 아니라 기준

효과는 그 문장이 **그 말을 할 때만** 들어간다. 아무 데나 뿌리면 순위를 말하지 않는 줄에 티어 표가 뜨는 장식이 된다.
아래를 다 채울 때만 쓰고, 어울리는 문장이 없으면 한 영상에 0개다 (B-roll 장면으로 충분하다).

1. **말** — 효과의 '맞는 말'(아래 표)을 그 장면에서 한다. 효과가 쓰는 단어(이름표·글자·`atWord`)는 그 장면에서 실제로 나와야 한다 → `render --check` 가 막는다.
2. **발표자** — 얼굴이 화면에 있다 (오려낸 프레임 중 얼굴을 못 찾은 게 `faceMissMax` 30 % 이하). 세로 영상만.
3. **길이·실물** — 장면이 `minSec` 이상, 실물(카드·순위 항목·데이터 파일)이 `minItems` 이상.
4. **반복 금지** — 같은 효과는 영상당 한 번. 이웃 장면과의 지문(다양성 정책)도 다른 장면처럼 본다 — fx 끼리 붙이면 배치가 같으니 효과음을 다르게.
5. **숫자** — 그래프 값은 출처(`source`)가 적힌 데이터 파일에서만. plan 에 숫자를 직접 쓰면 ❌.

| 효과 | 맞는 말 | 최소 길이 | 실물 | 보이는 것 |
|---|---|---|---|---|
| `freeze` | 사람 이름·소개 | 2.0 s | — | 몸짓 정점에서 번쩍 → 정지, 흰 테두리 스티커 + 이름표 (목소리는 계속) |
| `text-behind` | 도구·제품 이름을 처음 부를 때, 한 단어 | 1.5 s | — | 머리 뒤에서 큰 단어가 솟고, 머리카락이 글자 앞에 |
| `shoulder` | 둘을 맞대기, 하나가 다른 하나로 넘기기 | 2.5 s | 카드 2 | 발표자 0.74배, 양 어깨 뒤 유리 카드 2장, 편지가 머리 위로 |
| `grade-wipe` | 화면·색·화질 자체가 좋아질 때만 | 1.5 s | — | 세로선이 쓸며 보정본으로, BEFORE/AFTER 칩 |
| `tier` | 순위 매기기·고르기 | 3.0 s | 항목 3 | 발표자를 올리고 가슴 아래 S~D 패널, 타일이 D→S 순으로 |
| `glass-chart` | 실제로 잰 숫자가 오르내릴 때 | 2.0 s | 데이터 파일 1 | 가슴 위 유리 카드, 합계가 오르고 막대가 솟음 |

주의
- `shoulder` 는 카드 내용(머리 위)이 들어갈 만큼만 발표자를 줄인다 — render 가 장면마다 재서 채운다 (ℹ️ 로 배율을 보여 줌). 0.8배(아바타 하한)보다 줄여야 하는 영상은 ❌ → 다른 효과로. `scale` 은 보통 비워 둔다.
- `freeze` 는 목소리가 이어지는 동안 그림을 1.3초 멈춘다 — 입이 멈춰 보이는 구간이다. 몸짓 정점은 손 모양 모델 대신 '얼굴 밖 움직임이 가장 큰 프레임'.
- `tier` 타일 그림은 저장소 3D 오브젝트(`object`) 또는 내가 넣은 이미지(`src`, `broll/`). **상표 로고를 저장소에 넣지 않는다.** 말하지 않은 항목 이름은 ⚠️.
- 모든 위치는 그 장면 **모든 프레임의 최악값**(가장 높은 정수리·가장 낮은 턱·어깨가 화면 옆을 벗어나는 줄)에서 나온다. 박자는 단어 시작. 그래픽은 위 UI 아래·자막 줄 위에만.
- 효과는 시간을 늘이지 않는다. 장면 동안 자막은 기본 자리(화면 아래쪽)로 간다.

## 붙이는 순서

1. plan.json 에 장면 하나 — `"mode": "fx"`, `"template": "<효과>"`, 시간은 다른 장면처럼 **원본 시간**, 단어는 `npm run words -- <이름>` 에서.
2. `npm run fx -- <이름>` — fx 장면만 오려낸다 (CPU, 영상 1초당 ≈ 7~10초. 처음 한 번 모델 ≈170MB). 결과 `projects/<이름>/fx/<id>.cutout.webm`·`.track.json`.
   장면 시간이나 편집본이 바뀌면 `render --check` 가 "→ npm run fx" 로 알린다 (바뀐 장면만 다시). `text-behind` 는 끝에 글자마다 가려지는 정도를 잰다 (70 % 이상 보여야).
3. `npm run storyboard -- <이름>` / `npm run still -- <이름> --scene <id>` 로 확인 → 렌더.

## plan.json 예

```json
{"id": "01", "in": 0.0, "out": 3.7, "mode": "fx", "template": "freeze",
 "props": {"name": "김하나", "role": "영상 만드는 사람"}, "sfx": [{"t": 0.3, "cue": "pop"}]}

{"id": "02", "in": 3.8, "out": 6.2, "mode": "fx", "template": "text-behind",
 "props": {"text": "Mod", "atWord": "Mod"}}

{"id": "03", "in": 7.9, "out": 12.0, "mode": "fx", "template": "shoulder",
 "props": {"left":  {"chip": "하나", "title": "고객 찾기", "line": "고객이 될 만한 곳", "atWord": "하나는"},
           "right": {"chip": "다른 하나", "title": "영업 메일", "line": "거기에 보내기", "atWord": "다른", "pill": "보냄"},
           "sendWord": "보내고"}}

{"id": "05", "in": 21.3, "out": 24.3, "mode": "fx", "template": "grade-wipe",
 "props": {"atWord": "바꾸는"}}

{"id": "04", "in": 15.4, "out": 21.1, "mode": "fx", "template": "tier",
 "props": {"title": "간단한 일 · 가성비", "atWord": "가성비",
           "rows": [{"tier": "S", "items": [{"name": "작은 모델", "object": "rocket"}]},
                    {"tier": "A", "items": [{"name": "중간 모델", "object": "bulb"}]},
                    {"tier": "B", "items": [{"name": "큰 모델", "src": "broll/big.png"}]}]}}

{"id": "06", "in": 24.4, "out": 27.1, "mode": "fx", "template": "glass-chart",
 "props": {"data": "broll/chart.json"}}
```

### freeze — 사람 소개
`name`(그 장면에서 말한 이름, 띄어쓰기 상관없이 이어서 나와야 함) · `role`(작은 줄, 선택) · `hold`(멈춤 초, 기본 1.3. 앞 0.2 + 뒤 0.5초가 남아야) · `search`([첫 단어, 끝 단어] — 몸짓 정점을 찾을 구간, 선택).

### text-behind — 이름 한 단어
`text`(한 단어) · `atWord`(글자가 솟는 단어, 기본 `text`) · `width`·`font`(선택). 머리 위가 좁으면 글자를 올리는 대신 영상을 내린다. 정수리가 너무 높으면 ❌ → 다른 효과로.

### shoulder — 둘 맞대기·넘기기
`left`·`right` = `{chip, title, line?, atWord}` (right 는 `pill?` 더) · `sendWord`(편지가 왼쪽 → 오른쪽으로 떠나는 단어, 선택) · `scale`(발표자 배율, 비우면 잰 값. 0.8 아래는 ❌).

### grade-wipe — 화면이 좋아진다
`atWord`(선이 쓸기 시작하는 단어) · `grade`(CSS filter, 기본 초안 보정) · `after`(진짜 보정본 `broll/…mp4`, 장면 시작에 0초를 맞춘 것) · `labels`({after, before}).

### tier — 순위
`title` · `atWord`(첫 타일이 날아오는 단어) · `rows`([{tier, items: [{name, object | src}]}], 위가 제일 좋은 칸) · `busy`·`done`(칩 글자).

### glass-chart — 잰 숫자
`data`: 프로젝트 안 JSON 파일 경로만. 파일 모양:
```json
{"title": "이 편 제작 시간", "period": "10월", "unit": "분", "total": 67.9,
 "bars": [{"label": "립싱크", "value": 27.4}, {"label": "렌더", "value": 15.5}],
 "source": "어디서 잰 숫자인지 (로그 파일 경로 등)", "decimals": 1}
```
합계를 그 장면에서 말하지 않으면 ⚠️ (숫자는 말할 때 보여 주는 게 원칙).
