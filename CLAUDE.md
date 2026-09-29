# 아바타쇼츠 (avatar-shorts) — Claude 작업 안내

아바타·셀피 영상 하나로 무음 제거·훅 재배치 + B-roll 모션그래픽 + 한국어 자막 + 효과음이 입혀진 쇼츠/릴스를 만드는 키트. Remotion(React) 렌더, 로컬 음성 인식, API 키 없음.
사용자는 초보자일 수 있다. 한국어로, 쉬운 말로. **기본은 묻지 않고 끝까지** 가고(취향 `ask`), 마지막에 결정 요약 한 번.
결정은 `style/policy.json`(정책: 어기면 틀림, render 가 막음)과 `style/taste.json`(취향: 기본값, 사용자가 고치면 기억)으로 내린다. 기준은 `style/README.md`.

## 무엇을 할 때 어떤 스킬
| 요청 | 스킬 |
|---|---|
| 영상 주고 "쇼츠/릴스 만들어줘", `/shorts <경로>` | `shorts` (전체 흐름, 이것부터) |
| 자막 받아쓰기·오탈자 교정·다시 만들기 | `transcribe-ko` |
| 무음 제거, 훅 재배치, 길이 줄이기 | `viral-edit` |
| 어디에 어떤 B-roll 을 얹을지, 장면 수정 | `broll-plan` |
| 템플릿으로 안 되는 장면 직접 만들기, 템플릿 고치기 | `motion-kit` |
| 레퍼런스·"앞으로 이렇게" → 정책/취향/부품 | `style-intake` |
| Google Flow 등 생성 도구로 B-roll 을 만들고 싶을 때 | `flow-prompts` |
| 설치·실행이 안 됨 | `npm run doctor` → `docs/TROUBLESHOOTING.md` |

## 새 세션에서 처음
- `node_modules` 나 `.venv` 가 없으면 → `npm run setup` 부터 (5~10분, 모델·브라우저까지 받음). 끝나면 doctor 결과를 쉬운 말로 한 줄.
- "처음이에요", "잘 되는지 보고 싶어요" → `npm run demo` 를 돌리고 `projects/_demo/` 를 알려 준다.
- Windows(일반 터미널)면 → WSL2 안에서 쓰라고 안내한다 (`python3`, `.venv/bin` 경로를 가정한 키트).
- plan.json 을 어떻게 쓰는지 감이 필요하면 → `examples/avatar-v01/` (README 영상의 실제 대본·편집·설계도·결정 기록).

## 명령
```bash
npm run setup                      # 처음 한 번 (npm, .venv+faster-whisper, 효과음, 브라우저·모델 미리 받기)
npm run doctor                     # 환경 진단 — 뭔가 안 되면 이것부터
npm run demo                       # 영상 없이 데모 2개 렌더
npm run new -- <영상> [이름]         # projects/<이름>/ 생성(원본 복사) + 분석. 경로가 틀리면 파일 이름으로 찾음
.venv/bin/python scripts/transcribe.py projects/<이름> --hint "고유명사"   # 이것만 .venv, 나머지 .py 는 python3
python3 scripts/align.py projects/<이름>
python3 scripts/edit.py projects/<이름> [--list]   # 무음 제거 + edit.json(order, cut) → edit.mp4
npm run words -- <이름> [글자…]    # 단어별 원본 시간 · 편집 시간 · 프레임 (plan 의 at/t 는 여기서)
node scripts/style.mjs <이름>                     # 정책+취향 합친 결과·위반 확인
npm run render -- <이름> --check   # 검사 (+ .props.json, public/_live 준비)
npm run still -- <이름> 16.3 17.0  # 그 순간 스틸 (원본 시간. --edit = 결과 영상 시간, --scene 06)
npm run render -- <이름> --preview # 절반 해상도
npm run render -- <이름>           # 최종 → projects/<이름>/out/final.mp4
python3 scripts/look.py <mp4> --plan projects/<이름>/plan.json   # 훅 + 장면별 프레임 시트
npm test                           # 자체 시험 (코드를 고쳤으면 반드시. --quick 은 스틸 렌더 생략)
```

## 시간은 세 종류 — 직접 계산하지 않는다 (`scripts/timeline.mjs`)
| | 기준 | 쓰는 곳 |
|---|---|---|
| **원본 시간** | input.mp4 초 | words.json · captions.json · **plan.json** · `npm run still` 기본 |
| **편집 시간** | edit.mp4 / 결과 영상 초 | words.edit.json · captions.edit.json · cuts.json · look.py 에 직접 준 시각 · `still --edit` |
| **렌더 프레임** | 편집 시간 × 30fps | `remotion still --frame`. 원본 fps(25 등)와 다르다 |
render 가 plan(원본) → 편집 시간으로 옮긴다. 그래서 edit.json 이나 무음 기준을 바꿔도 plan 은 다시 쓰지 않는다.

## 프로젝트 폴더 (`projects/<이름>/`, git 제외)
`input.mp4` 원본 **복사본** · `video.json` 크기/레이아웃/얼굴 위치/배경 색(tones) · `transcript.txt`, `words.raw.json` 음성 인식 원본 ·
`script.txt` 교정 대본(한 줄=한 큐) · `words.json`, `captions.json` 정렬 결과 · `edit.json` 순서(`order`)·손으로 자를 곳(`cut`, 원본 초) · `edit.mp4`, `*.edit.json`, `cuts.json` 편집본 ·
`taste.json` 프로젝트 취향 · `decisions.md` 결정 기록 · `plan.json` 장면 계획 · `broll/` 직접 넣는 이미지·영상 · `out/` 결과 · `.props.json` render 가 합친 최종 입력

## 코드 지도
- `src/Short.tsx` 메인 컴포지션 (plan 하나 = 영상 하나), `src/Root.tsx` 크기·길이 계산
- `src/layouts/` Vertical(1080×1920, 분할/컷어웨이) · Side(1920×1080, 왼쪽 아바타 카드) · Avatar(펀치인) · SceneHost
- `src/scenes/` 템플릿 12종, `src/custom/` 커스텀 장면, `src/kit/` 부품(motion, theme, Backdrop, Object3D, KText, Parts, Gradient)
- `src/captions/Captions.tsx` 자막
- `scripts/` new-project · probe · transcribe · align · edit · words · style · timeline · render · still · look · doctor · selftest · sfx · setup
- `examples/demo/` 템플릿 데모 plan · `examples/avatar-v01/` 실제 영상 하나의 전 과정 파일
- `public/fonts` 글꼴(OFL) · `public/objects` 3D 오브젝트 62종 · `public/sfx` 합성 효과음 11종 (git 에 포함. 지워지면 `sfx.py`)

## 규칙
- 영상에서 말하지 않은 숫자·가격·결과·인용을 화면에 만들지 않는다.
- 자막은 말한 그대로 (오탈자만 교정). 편집은 자르기·옮기기만.
- 사용자 원본 파일은 수정·삭제하지 않는다. 작업은 `projects/` 안에서만 (하드링크 금지 — 복사).
- 모든 애니메이션은 프레임 함수(spring/interpolate). CSS transition·Math.random 금지.
- 렌더 후 반드시 `look.py` 시트를 직접 보고 확인한 뒤 결과를 알린다.
- 정책(`style/policy.json`)은 사용자 한 명의 말로 바꾸지 않는다 → "이번 영상만 예외로 둘까요?" 로 묻는다. 취향은 바로 바꾸고 기억한다.
- 커스텀 장면(`src/custom/`)은 저장소 코드가 된다 → 일반적인 이름으로 만들고 결정 요약에 알린다.

## 실제로 겪은 함정 (다시 밟지 않게)
- **스틸로 확인하기 전엔 `render --check`** (또는 `npm run still` 이 알아서). 예전 .props.json 으로 보면 고친 게 안 보인다.
- **kit 부품의 `x, y` 는 가운데 좌표** (Card, Object3D, GradientPanel, Blob). 왼쪽 위로 넣으면 치우친다.
- **morph 는 첫 상태의 `t` 에 나타난다.** 장면 in 보다 늦으면 빈 판 → 첫 상태(알약 등)를 in 쪽에.
- **대사가 화면을 설명하면 그걸 보여 준다**: "빛이 번지죠" → 빛 번짐 장면, `git clone` → 터미널(검색창 아님).
- 영상 색 분석은 **얼굴(피부) 빼고** 배경만 — 안 그러면 모든 영상이 주황으로 뽑힌다.
- 무음을 줄이면 장면이 짧아진다 → 1.2초 정책에 걸리면 in/out 을 넓힌다.
- 재배치 덩어리의 경계는 문장 사이 무음 한가운데 (edit.py). 이웃 덩어리와 원본을 겹쳐 가져가면 같은 소리가 두 번 난다.
- ffmpeg 버전마다 옵션이 다르다 (`-filter_complex_script` 는 7.x 에서 사라짐) → 필터 그래프는 인자로 넘긴다.
- 레퍼런스가 로그인 뒤에 있으면(스레드 등) 캡처가 안 될 수 있다 → 페이지의 `og:image` 나 사용자에게 받은 이미지 주소를 받아 **직접 보고** 판단한다.
- 효과음 wav 를 gitignore 해 두었더니 새로 받은 사람의 `npm run demo` 가 404 로 실패했다 → 렌더에 필요한 자산은 전부 git 에 (시험이 확인).
- macOS 는 한글 파일 이름을 자모로 풀어(NFD) 저장한다 → 이름 비교·slug 전에 `normalize('NFC')`.
- whisper 는 "음, 어" 를 곧잘 지운다 → `initial_prompt` 에 예시로 넣어 둠. 그래도 없으면 `edit.json` 의 `cut` 으로.
- 장면 시각을 파이썬 한 줄로 뽑아 sed 로 고치다 틀린 적이 있다 → `npm run words`.
- 새 함정을 고치면 `scripts/selftest.mjs` 에 시험 한 줄, 이 목록에 한 줄.
