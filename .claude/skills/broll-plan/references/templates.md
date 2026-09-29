# 템플릿 12종 — props 사전

모든 시간(`at`, `times`, `t`, `winnerAt`, `markAt` …)은 **원본 영상 기준 초**. `words.json` 의 단어 `start` 를 그대로 쓴다.
생략하면 장면 시작부터 적당한 간격으로 자동 배치된다.
텍스트 표기: `*강조*` = 세리프 + 강조색, `_강조_` = 산세리프 + 강조색, `\n` = 줄바꿈.
`object` 는 `objects.md` 의 이름만. 무대 크기(세로 전체 / 세로 위 칸 / 가로 오른쪽)에 맞춰 배치가 자동으로 바뀐다.

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
{"num": "02", "title": "실전 설정", "sub": "5분이면 끝"}
```

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
