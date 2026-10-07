# 결정 기록 — avatar-v01

| 항목 | 정한 것 | 이유 | 바꾸려면 |
|---|---|---|---|
| 팔레트 | darktech + terracotta 3색(자동), 그라디언트 면 | AI 도구 주제 → darktech. 배경의 주황 램프 조명에 맞춰 3색 자동 선택 (terracotta 0.60 > plum 0.53 > oxblood-guava 0.52) | taste.json `look.triad: "plum"` 등, `look.surface: "flat"` |
| 무음 | tight (0.16s 남김) → 27.0→25.8초 | 취향 기본 | `edit.silence: "natural"` |
| 훅 | 15–16번 "편집 프로그램은, 한 번도 안 켰습니다" 를 맨 앞으로 | 결과+부정, 혼자 뜻이 통함 (점수 4) | edit.json 삭제 또는 `edit.structure: "as-is"` |
| 펀치인 | 컷 2곳 1.00↔1.08 | 취향 기본 | `edit.punchIn: false` |
| B-roll | high, 9장면 | 27초 짧은 기능 소개 | `broll.density` |
| 배치 | 머리 위 3(훅 스위치·무료·git clone) · 분할 2(클로드→설계도) · 턱 아래 1(형광펜) · 전체 3 | `broll.framing: varied`. 훅·UI 입력은 얼굴이 보이는 머리 위 카드, 이어서 설명하는 두 문장은 한 번의 분할, 형광펜은 턱 아래. 머리 위가 좁아 머리 위 카드 때 아바타를 335px 내림 | plan.json 의 `mode` |
| 다양성 | 08 "무료" 를 morph 알약 → 동그라미 친 큰 글자(keyword) | 07·08·09 가 머리 위 morph 알약 3연속이라 지루함 (정책 `variety`: 이웃 장면 배치·모션이 둘 다 같음). 머리 위 묶음은 유지해 아바타가 오르내리지 않게. README 영상(`after.mp4`)은 이 규칙 전에 렌더한 것 | plan 08 의 `template` |
| 늦은 요소 | 05 밑줄을 "그어지고"(14.62) → "형광펜이"(13.94), 06 "빛이 번지죠" 를 "빛이"(16.32)에 한 번에 | 무음을 줄이니 두 장면 끝이 당겨져 마지막 요소가 끝 0.5초 전에야 나옴 (`npm run storyboard` ⚠️). 06 은 다음이 훅으로 옮긴 문장이라 out 을 늘릴 수 없음 | plan 05 `markAt`, 06 `titleTimes` |
| 커스텀 장면 | LightBloom ("빛이 번지죠") | 대사가 화면 효과를 설명 → 보여줘야 함 | plan 06 삭제 |
| 자막 교정 | 하나 하나→하나하나, 아래래포지토리→아래 repository | 사용자 대본 기준 | script.txt |
