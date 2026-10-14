# 템플릿 12종 — props 사전

모든 시간(`at`, `times`, `t`, `winnerAt`, `markAt` …)은 **원본 영상 기준 초**. `words.json` 의 단어 `start` 를 그대로 쓴다.
생략하면 장면 시작부터 적당한 간격으로 자동 배치된다.
텍스트 표기: `*강조*` = 세리프 + 강조색, `_강조_` = 산세리프 + 강조색, `\n` = 줄바꿈.
`object` 는 `objects.md` 의 이름만. 무대 크기(세로 전체 / 세로 위 칸 / 머리 위·아래 납작한 카드 / 가로 오른쪽)에 맞춰 배치가 자동으로 바뀐다.
머리 위·아래 카드(`above`/`below`, 폭 960 × 높이 300~560)에는 morph · keyword · stat · media 만 (나머지는 render 가 막음). morph 는 머리 쪽 가장자리에 붙는다.

---

### hero — 주인공 3D 오브젝트 + 핵심어 (가장 자주)
```json
{"object": "bulb", "material": "tint", "title": "결심이 아니라\n*설계*", "titleTimes": [21.5, 21.8, 22.4],
 "label": "오늘의 결론", "sub": "작은 설명 한 줄", "objectAt": 21.1, "stars": true, "blob": true}
```
title 단어 수 = titleTimes 길이. material: tint | clay | color | halftone.

### keyword — 큰 타이포 + 손그림 마커
```json
{"text": "진짜 원인은\n*환경*", "times": [2.75, 3.1, 3.55], "mark": "underline", "markAt": 3.9,
 "ghost": "ENVIRONMENT", "label": "핵심", "sub": "보조 설명"}
```
mark: underline | circle | strike. ghost 는 배경에 옅게 흐르는 대형 글자(영문 대문자 추천).

### stat — 실제로 말한 숫자만
```json
{"value": 87, "suffix": "%", "label": "재방문율", "at": 5.2, "ring": 0.87}
```
prefix/suffix/decimals. ring(0~1)을 주면 원형 게이지, 아니면 `object` 로 옆에 오브젝트.

### compare — A vs B
```json
{"title": "같은 목표, 다른 방법",
 "left":  {"title": "의지로 버티기", "object": "gym", "items": ["매번 결심", "쉽게 지침"], "at": 11.6, "tag": "보통"},
 "right": {"title": "환경 바꾸기", "object": "setting", "items": ["한 번 설정"], "at": 12.6},
 "winner": "right", "winnerAt": 14.8, "vs": "vs"}
```

### steps — 계단식 과정 (2~5단계)
```json
{"title": "딱 *세 단계*", "steps": [{"text": "영상 넣기", "at": 14.4, "object": "video-camera"}, {"text": "자막 확인", "at": 15.4}]}
```

### list — 체크리스트 (2~5개)
```json
{"title": "오늘 할 일", "object": "notebook", "items": [{"text": "알림 끄기", "at": 17.7}, {"text": "야식", "at": 18.8, "ok": false}]}
```
ok:false 는 X 표시.

### chart — 막대 또는 추세선
```json
{"title": "3개월 변화", "kind": "bars", "bars": [{"label": "1월", "value": 20, "valueLabel": "20명"}, {"label": "3월", "value": 80, "highlight": true, "valueLabel": "80명"}]}
{"title": "꾸준히 하면", "kind": "line", "trend": "up", "endLabel": "성장", "at": 9.0}
```
bars 수치는 말한 숫자만. 숫자가 없으면 line + trend(up | down | flat-up) 로 방향만.

### quote — 종이 콜라주 인용 카드
```json
{"text": "좋은 질문이\n좋은 답을 만든다", "times": [17.4, 17.7, 18.0, 18.3], "by": "말한 사람(선택)", "object": "bulb"}
```
object 는 하프톤 콜라주로 모서리에 붙는다.

### chapter — 소제목 전환
```json
{"num": "02", "title": "실전 설정", "sub": "5분이면 끝", "label": "설정"}
```
chapter 가 3개 이상이면 장 카드 아래에 **길 지도**가 자동으로 붙는다: 모든 장 이름이 점으로 이어지고 지금 장에만 불이 켜진다 (`label` = 길 위 이름, 8자 이하. 없으면 번호). 스포 구간의 로드맵(FlowDiagram "모으고 → 굴리고 → 남기고")과 같은 말을 쓰면 장마다 "지금 어디쯤" 이 이어진다. 끄려면 취향 `broll.roadmap: false`.

### morph — 도형 하나가 계속 변신 (+커서) ★ UI 시연에 최고
```json
{"states": [
  {"t": 5.2, "kind": "pill", "text": "알림 1개", "object": "notify-heart"},
  {"t": 6.9, "kind": "card", "title": "흐름 *끊김*", "sub": "다시 몰입하려면 시간이 든다", "object": "flash"},
  {"t": 8.9, "kind": "toggle", "label": "방해 금지 모드", "on": true},
  {"t": 10.5, "kind": "search", "query": "집중 잘 하는 법"},
  {"t": 12.0, "kind": "chat", "prompt": "3줄로 요약해줘", "reply": "핵심만 정리해 드릴게요.", "app": "AI Chat"},
  {"t": 13.9, "kind": "terminal", "command": "git clone avatar-shorts", "enterAt": 15.1, "output": ["Cloning into 'avatar-shorts'..."]}
], "cursor": true}
```
상태 하나 = 대사 한 비트. **명령어·코드를 말하면 search 가 아니라 terminal** (command 는 말한 그대로, output 은 그 명령의 표준 출력만 — 숫자·결과 지어내기 금지). enterAt 은 "받아서/실행하면" 같은 단어 시작. chat 은 프롬프트 타이핑 → 전송 클릭 → 답변 타이핑까지 약 (글자수/22 + 2)초 필요.

### media — 직접 만든 이미지·영상 (Google Flow 등)
```json
{"src": "broll/scene1.mp4", "title": "선택: 위에 올릴 핵심어", "framed": true}
```
파일은 `projects/<slug>/broll/` 에. framed:false 면 무대를 꽉 채운다. 느린 켄 번즈 자동.

### palette — 3색 팔레트 카드 (색·브랜드·디자인을 말할 때만)
```json
{"triad": ["#2A1633", "#FF8A3D", "#FFE3CF"], "names": ["Ink Plum", "Tangerine Pop", "Peach Cloud"], "label": "PALETTE", "title": "*세 가지* 색", "titleTimes": [4.1, 4.5]}
```
위는 그라디언트 패널, 아래는 겹쳐 쌓인 색 탭 3장(HEX·이름·아이콘). triad 생략 시 영상 트라이어드. 색 이름·HEX 를 말하지 않았으면 names 는 비운다.

### custom — 직접 만든 컴포넌트
```json
{"template": "custom", "component": "OrbitIdea", "props": {"center": "bulb", "satellites": ["chat", "rocket", "target"], "title": "아이디어의 *궤도*"}}
```
`motion-kit` 스킬 참고. `src/custom/index.ts` 에 등록해야 한다.

이미 있는 커스텀 장면 (다른 영상에서도 그대로 쓴다):
| 이름 | 쓰는 때 | props |
|---|---|---|
| `StackCarousel` | 종류 3~5개를 차례로 말할 때 (cutaway). 세로로 쌓인 띠 중 가운데 한 장이 펼쳐지고, at 마다 다음 띠로 넘어가며 바탕색이 트라이어드를 따라 바뀜 | `{"label": "영상 소스", "items": [{"title": "분위기 있는 비롤", "object": "video-camera", "at": 32.56}, …]}` |
| `TypeSpecimen` | 글꼴·서체를 말할 때 (panel). 글꼴 이름을 그 글꼴로 쓴 카드가 차례로 | `{"items": [{"sample": "얇은 명조", "font": "myeongjo", "label": "고급스럽게", "at": 16.76}, {"sample": "고딕", "font": "sans", "weight": 800}, {"sample": "손글씨", "font": "hand"}]}` |
| `LightBloom` | "빛이 번지죠" 같은 화면 전환을 말할 때 | `{"from": "picture", "to": "star", "bloomAt": 12.3}` |
| `OrbitIdea` | 중심 개념 + 주변 요소 | `{"center": "bulb", "satellites": ["chat", "rocket", "target"]}` |
| `CoinVault` | 돈이 **어딘가에 모여 쌓인다** (충전금·예치금·적립금). 2.5D 카드 더미에서 동전이 포물선으로 날아가 유리 금고에 쌓이고 금 층이 차오른다. 말한 숫자는 알약 하나로. 크림 바탕 (EP01 v2, 사용자 선택) | `{"flowAt": 76.85, "flowUntil": 78.3, "fill": 0.74, "source": "충전한 돈", "target": "선수금", "pill": {"text": "4,276억 원", "at": 78.34}}` — 이름표 8자 이하, cutaway 권장 |
| `TwinVault` | **같은 돈, 다른 결과** 비교 (이자가 붙는 곳 vs 안 붙는 곳). 같은 금고 둘에 돈이 들어가고 왼쪽만 이자 동전이 솟아 쌓인다. 글자 비교 카드(compare) 대신 | `{"left": {"label": "은행", "at": 140.16}, "right": {"label": "스타벅스 카드", "at": 142.74}, "interestAt": 141.32, "noneAt": 148.02, "noneText": "이자 없음"}` — panel·cutaway |
| `FlowDiagram` | 돈·물건·정보가 **어디서 어디로** 가는지, 원인 → 결과 (panel·cutaway, 가로·세로). 노드가 차례로 뜨고 선이 그려진 뒤 강조색 점이 흐름. `shape: "loop"` 면 마지막이 처음으로 돌아오는 순환. 노드 3~4개(5개 이하), 노드 글자 2~8자 | `{"title": "충전금이 *매출*이 되기까지", "nodes": [{"text": "앱에서 충전", "object": "mobile", "at": 6.3}, {"text": "스타벅스 통장", "object": "money-bag"}, {"text": "커피 받으면 매출", "object": "cup", "accent": true}], "edges": [{"from": 0, "to": 1, "label": "현금 먼저"}, {"from": 1, "to": 2}]}` — edges 를 비우면 순서대로 잇는다. 시각은 nodes[].at · edges[].at (원본 초, 없으면 0.6초 간격) |

### 장면 카메라 — 멈춰 있지 않게 (모든 템플릿)
모든 장면은 처음→끝 아주 느리게 줌인한다 (취향 `broll.camera: drift`). 장면이 4초를 넘는데 요소가 앞에서 다 뜨면 render 가 ⚠️ "앞에 몰려 있고 …초는 멈춰" 를 띄운다 → 등장 시각(times·at)을 대사에 맞춰 뒤로 나누거나, 대사가 세부를 가리키는 순간 그쪽으로 다가간다:
```json
{"id": "05", "template": "keyword", "props": {...}, "camera": {"at": 33.1, "x": 0.5, "y": 0.6, "scale": 1.14, "dur": 1.0}}
```
x·y = 무대 안 초점(0~1), scale 1~1.6, at = 원본 초 (`npm run words`). 장면 하나에 한 번만.

### 가로 영상: 장(章)마다 아바타 좌우 바꾸기
`chapter` 장면 props 에 `"avatar": "right"` (또는 `"left"`)를 적으면 그 장부터 아바타 카드가 오른쪽으로 가고, 자료 무대는 왼쪽으로 온다. 다음 chapter 까지 이어진다 (처음은 왼쪽). 옮기는 건 장 카드(cutaway) 동안이라 덜컥이지 않는다 (`src/layouts/sideSwap.js`). 롱폼에서 장마다 번갈아 쓰면 9분이 단조롭지 않다. 세로 영상에선 무시된다.
