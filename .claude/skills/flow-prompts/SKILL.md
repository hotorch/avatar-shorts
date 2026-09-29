---
name: flow-prompts
description: (선택) Google Flow·Veo·Midjourney 같은 이미지/영상 생성 도구로 B-roll 키프레임과 6초 모션 클립을 직접 만들고 싶을 때, 장면별 생성 프롬프트를 써 주고 결과물을 media 장면으로 넣는다. "플로우 프롬프트 줘", "AI 이미지로 비롤 만들고 싶어" 요청에 사용.
---

# flow-prompts — 생성형 B-roll (선택 경로)

기본 경로(코드 모션)는 무료·자동이다. 이 경로는 사용자가 **외부 생성 도구에서 직접** 만든 이미지·영상을 쓰고 싶을 때만 쓴다. Claude 는 프롬프트를 써 주고, 사용자가 만든 파일을 받아 넣는다. 유료 API 를 대신 호출하지 않는다.

## 1. 대상 장면 고르기
B-roll 계획표에서 "사실적인 오브젝트·장소·인물 연출이 필요한" 장면 1~5개만 고른다. 각 장면 길이는 4~6초.

## 2. 장면별 프롬프트 (영어로 쓰는 게 생성 품질이 좋다, 설명은 한국어로)
각 장면마다 세 가지를 준다:

**① 키프레임 이미지 프롬프트** — 글자 없는 빈 키프레임
- 선택한 팔레트의 바탕색·격자, 정확한 비율(세로 9:16 / 가로 무대는 3:2), 의미가 분명한 주인공 오브젝트 1개, 보조 벡터·콜라주 요소 최대 2개
- 사실적인 3D 오브젝트 + 흑백 하프톤 컷아웃 + 2.5D 레이어 + 얇은 기하학 선, 제어된 비대칭, 에디토리얼 조명과 부드러운 그림자, 깊이감, 중앙 안전 영역
- 배경에 저대비 반투명 대각선 정확히 2개
- **"no text, no letters, no logos, no watermark"** 를 반드시 넣는다 (한글은 편집 단계에서 합성)
- 화면 문구가 들어갈 여백 위치를 명시 ("leave empty space in the upper third for a headline")

예: `Premium editorial mixed-media collage, 9:16, warm off-white paper background with faint dotted grid, two faint translucent diagonal bands behind everything, a photorealistic glossy lightbulb floating center-left with soft contact shadow, black-and-white halftone cutout of a hand reaching toward it, thin royal-purple geometric circle behind, soft studio light, shallow depth, 2.5D layered, empty upper third for headline, no text, no letters, no logos, no watermark`

**② 6초 모션 프롬프트** (이미지 → 영상)
- 0.0~0.5초 고정 배경, 대각선 2개는 이미 천천히 움직임, 오브젝트 아직 없음
- 0.5~3.5초 주인공 진입 (방향·거리·감속·약한 모션블러), 5~10% 오버슈트 후 정지, 레이어는 5~10프레임 간격
- 3.5~4.7초 안정 후 느린 부유·미세 회전·빛 반사
- 4.7~6.0초 부드럽게 빠짐
- 카메라 고정 또는 5% 이내 밀어 들어가기. 흔들림 금지. **영상 안에 글자를 만들지 말 것.**

**③ 화면 문구** — 1~4어절 (media 장면의 `title` 로 합성됨)

## 3. 결과물 넣기
사용자에게: "만든 파일을 `projects/<slug>/broll/` 폴더에 `scene1.mp4` 처럼 넣어 주세요."
plan.json 에서 해당 장면을:
```json
{"template": "media", "props": {"src": "broll/scene1.mp4", "title": "핵심 *문구*", "framed": false}}
```
영상 클립은 원본 오디오를 가리지 않게 자동으로 음소거된다. 길이가 장면보다 짧으면 마지막 프레임에서 멈춘다 → 장면 길이를 클립에 맞춘다.
