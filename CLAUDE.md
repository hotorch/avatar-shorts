# 아바타쇼츠 (avatar-shorts) — Claude 작업 안내

아바타·셀피 영상 하나로 무음 제거·훅 재배치 + B-roll 모션그래픽 + 한국어 자막 + 효과음이 입혀진 쇼츠/릴스를 만드는 키트. Remotion(React) 렌더, 로컬 음성 인식, API 키 없음.
사용자는 초보자일 수 있다. 한국어로, 쉬운 말로. **기본은 묻지 않고 끝까지** 가고(취향 `ask`), 마지막에 결정 요약 한 번.
결정은 `style/policy.json`(정책: 어기면 틀림, render 가 막음)과 `style/taste.json`(취향: 공용 기본값) + `style/me.json`(내 취향: 이 PC 에만, git 제외. 레퍼런스 영상·사용자가 고친 것에서 배움)으로 내린다. 기준은 `style/README.md`.

## 무엇을 할 때 어떤 스킬
| 요청 | 스킬 |
|---|---|
| 영상 주고 "쇼츠/릴스 만들어줘", `/shorts <경로>` | `shorts` (전체 흐름, 이것부터) |
| 자막 받아쓰기·오탈자 교정·다시 만들기 | `transcribe-ko` |
| 무음 제거, 훅 재배치, 길이 줄이기 | `viral-edit` |
| 어디에 어떤 B-roll 을 얹을지, 장면 수정 | `broll-plan` |
| 렌더 전에 장면 미리 보기, "비슷한 장면이 반복돼" | `storyboard` |
| 템플릿으로 안 되는 장면 직접 만들기, 템플릿 고치기 | `motion-kit` |
| 레퍼런스·"앞으로 이렇게" → 정책/취향/부품 | `style-intake` |
| 좋아하는 영상 → 내 취향, "이 영상처럼", "내 취향 보여줘" | `reference-taste` |
| Google Flow 등 생성 도구로 B-roll 을 만들고 싶을 때 | `flow-prompts` |
| 설치·실행이 안 됨 | `npm run doctor` → `docs/TROUBLESHOOTING.md` |

## 새 세션에서 처음
- `node_modules` 나 `.venv` 가 없으면 → `npm run setup` 부터 (5~10분, 모델·브라우저까지 받음). 끝나면 doctor 결과를 쉬운 말로 한 줄.
- "처음이에요", "잘 되는지 보고 싶어요" → `npm run demo` 를 돌리고 `projects/_demo/` 를 알려 준다.
- Windows 도 WSL 없이 그대로 된다. 준비물은 `winget` 한 줄씩 (README), 깔고 나면 터미널을 새로 열라고 안내.
- 파이썬 스크립트는 **항상 `npm run <이름> -- …`** 로 부른다 (`python3`·`.venv/bin/python` 을 직접 쓰지 않음). OS 마다 다른 파이썬 이름·가상환경 경로·UTF-8 설정을 `scripts/platform.mjs` 가 맞춘다.
- plan.json 을 어떻게 쓰는지 감이 필요하면 → `examples/avatar-v01/` (README 영상의 실제 대본·편집·설계도·결정 기록).

## 명령
```bash
npm run setup                      # 처음 한 번 (npm, .venv+faster-whisper, 효과음, 브라우저·모델 미리 받기)
npm run doctor                     # 환경 진단 — 뭔가 안 되면 이것부터
npm run demo                       # 영상 없이 데모 2개 렌더
npm run new -- <영상> [이름]         # projects/<이름>/ 생성(원본 복사) + 분석. 경로가 틀리면 파일 이름으로 찾음
npm run transcribe -- <이름> --hint "고유명사"   # 파이썬 스크립트는 전부 npm run (scripts/py.mjs → .venv 파이썬, UTF-8)
npm run face -- <이름>              # 머리 위치 추적 (npm run new 가 알아서)
npm run align -- <이름>
npm run edit -- <이름> [--list]     # 무음 제거 + edit.json(order, cut) → edit.mp4
npm run words -- <이름> [글자…]    # 단어별 원본 시간 · 편집 시간 · 프레임 (plan 의 at/t 는 여기서)
node scripts/style.mjs <이름>                     # 정책+취향 합친 결과·위반 확인
npm run storyboard -- <이름>       # 렌더 전: 검사 + 장면마다 대표 프레임 시트(out/storyboard.png) + 지문 표(storyboard.md)
npm run reference -- <영상> [이름]  # 좋아하는 영상을 재서 내 취향(style/me.json)에 반영 → projects/_refs/<이름>/sheet.png
npm run me [-- --set 키=값 --why …]  # 내 취향 카드 / 직접 정하기 (--unset, --remove <레퍼런스>)
npm run render -- <이름> --check   # 검사 (+ .props.json, public/_live 준비)
npm run still -- <이름> 16.3 17.0  # 그 순간 스틸 (원본 시간. --edit = 결과 영상 시간, --scene 06)
npm run render -- <이름> --preview # 절반 해상도
npm run render -- <이름>           # 최종 → projects/<이름>/out/final.mp4
npm run look -- <mp4> --plan projects/<이름>/plan.json   # 훅 + 장면별 프레임 시트
npm test                           # 자체 시험 (코드를 고쳤으면 반드시. --quick 은 스틸 렌더 생략)
```

## 시간은 세 종류 — 직접 계산하지 않는다 (`scripts/timeline.mjs`)
| | 기준 | 쓰는 곳 |
|---|---|---|
| **원본 시간** | input.mp4 초 | words.json · captions.json · **plan.json** · `npm run still` 기본 |
| **편집 시간** | edit.mp4 / 결과 영상 초 | words.edit.json · captions.edit.json · cuts.json · look.py 에 직접 준 시각 · `still --edit` |
| **렌더 프레임** | 편집 시간 × 30fps | `remotion still --frame`. 원본 fps(25 등)와 다르다 |
render 가 plan(원본) → 편집 시간으로 옮긴다. 그래서 edit.json 이나 무음 기준을 바꿔도 plan 은 다시 쓰지 않는다.

## 프로젝트 폴더 (`projects/<이름>/`, git 제외. 레퍼런스 측정은 `projects/_refs/<이름>/`)
`input.mp4` 원본 **복사본** · `video.json` 크기/레이아웃/얼굴·머리 위치(head, track)/배경 색(tones) · `transcript.txt`, `words.raw.json` 음성 인식 원본 ·
`script.txt` 교정 대본(한 줄=한 큐) · `words.json`, `captions.json` 정렬 결과 · `edit.json` 순서(`order`)·손으로 자를 곳(`cut`, 원본 초) · `edit.mp4`, `*.edit.json`, `cuts.json` 편집본 ·
`taste.json` 프로젝트 취향 · `decisions.md` 결정 기록 · `plan.json` 장면 계획 · `storyboard.md` 장면 지문 표 · `broll/` 직접 넣는 이미지·영상 · `out/` 결과 · `.props.json` render 가 합친 최종 입력

## 코드 지도
- `src/Short.tsx` 메인 컴포지션 (plan 하나 = 영상 하나), `src/Root.tsx` 크기·길이 계산
- `src/layouts/` Vertical(1080×1920, 분할/머리 위·아래 카드/컷어웨이/아바타 확대 퇴장) · framing.js(머리 위치 → 아바타·판·카드·자막 자리, render 검사와 공용) · Side(1920×1080, 왼쪽 아바타 카드) · Avatar(펀치인) · SceneHost
- `src/scenes/` 템플릿 12종, `src/custom/` 커스텀 장면(StackCarousel · TypeSpecimen · LightBloom · OrbitIdea), `src/kit/` 부품(motion, theme, Backdrop, Object3D, KText, Parts, Gradient)
- `src/captions/Captions.tsx` 자막
- `scripts/` new-project · probe · face · transcribe · align · edit · words · style · me(내 취향) · reference(레퍼런스 측정) · timeline · variety(장면 지문·다양성 검사) · render · still · storyboard · look · doctor · selftest · sfx · setup · platform(OS 차이) · py(파이썬 실행기)
- `examples/demo/` 템플릿 데모 plan · `examples/avatar-v01/` 실제 영상 하나의 전 과정 파일
- `models/yunet` 얼굴 인식 모델(MIT, git 에 포함) · `public/fonts` 글꼴(OFL) · `public/objects` 3D 오브젝트 62종 · `public/sfx` 합성 효과음 11종 (git 에 포함. 지워지면 `sfx.py`)

## 규칙
- 영상에서 말하지 않은 숫자·가격·결과·인용을 화면에 만들지 않는다.
- 자막은 말한 그대로 (오탈자만 교정). 편집은 자르기·옮기기만.
- 사용자 원본 파일은 수정·삭제하지 않는다. 작업은 `projects/` 안에서만 (하드링크 금지 — 복사).
- 모든 애니메이션은 프레임 함수(spring/interpolate). CSS transition·Math.random 금지.
- 렌더 후 반드시 `look.py` 시트를 직접 보고 확인한 뒤 결과를 알린다.
- 정책(`style/policy.json`)은 사용자 한 명의 말로 바꾸지 않는다 → "이번 영상만 예외로 둘까요?" 로 묻는다. 취향은 바로 바꾸고 기억한다 (내 취향 `npm run me -- --set`. 공용 `style/taste.json` 은 팀이 정할 때만).
- 레퍼런스 영상은 읽기만 하고, 구도·리듬만 배운다 (그림·글자·로고는 가져오지 않음).
- 커스텀 장면(`src/custom/`)은 저장소 코드가 된다 → 일반적인 이름으로 만들고 결정 요약에 알린다.

## 실제로 겪은 함정 (다시 밟지 않게)
- **스틸로 확인하기 전엔 `render --check`** (또는 `npm run still` 이 알아서). 예전 .props.json 으로 보면 고친 게 안 보인다.
- **kit 부품의 `x, y` 는 가운데 좌표** (Card, Object3D, GradientPanel, Blob). 왼쪽 위로 넣으면 치우친다.
- **morph 는 첫 상태의 `t` 에 나타난다.** 장면 in 보다 늦으면 빈 판 → 첫 상태(알약 등)를 in 쪽에.
- **대사가 화면을 설명하면 그걸 보여 준다**: "빛이 번지죠" → 빛 번짐 장면, `git clone` → 터미널(검색창 아님).
- 영상 색 분석은 **얼굴(피부) 빼고** 배경만 — 안 그러면 모든 영상이 주황으로 뽑힌다.
- 무음을 줄이면 장면이 짧아진다 → 1.2초 정책에 걸리면 in/out 을 넓힌다. 끝이 당겨져 마지막 요소가 퇴장 직전에 나오기도 한다 (avatar-v01 06 "번지죠") → `npm run storyboard` 가 ⚠️ 로 알린다.
- 재배치 덩어리의 경계는 문장 사이 무음 한가운데 (edit.py). 이웃 덩어리와 원본을 겹쳐 가져가면 같은 소리가 두 번 난다.
- ffmpeg 버전마다 옵션이 다르다 (`-filter_complex_script` 는 7.x 에서 사라짐) → 필터 그래프는 인자로 넘긴다.
- 레퍼런스가 로그인 뒤에 있으면(스레드 등) 캡처가 안 될 수 있다 → 페이지의 `og:image` 나 사용자에게 받은 이미지 주소를 받아 **직접 보고** 판단한다.
- 효과음 wav 를 gitignore 해 두었더니 새로 받은 사람의 `npm run demo` 가 404 로 실패했다 → 렌더에 필요한 자산은 전부 git 에 (시험이 확인).
- macOS 는 한글 파일 이름을 자모로 풀어(NFD) 저장한다 → 이름 비교·slug 전에 `normalize('NFC')`.
- whisper 는 "음, 어" 를 곧잘 지운다 → `initial_prompt` 에 예시로 넣어 둠. 그래도 없으면 `edit.json` 의 `cut` 으로.
- 장면 시각을 파이썬 한 줄로 뽑아 sed 로 고치다 틀린 적이 있다 → `npm run words`.
- 분할 화면에서 **얼굴 중심**만 맞춰 내렸더니 머리가 큰 영상은 정수리가 판 밑으로 190px 들어갔다 → 머리 상자(정수리~턱)를 재서 배치 (`framing.js`, 정책 `face`). 머리 위치를 눈대중하지 않는다.
- Windows 는 `python3`·`.venv/bin` 이 없고, `npx`·`npm` 은 `.cmd` 라 셸 없이 spawn 하면 실패하고, 한국어 Windows 는 파이썬 기본 인코딩이 cp949 → 파이썬·remotion·npm 은 `scripts/platform.mjs` 로 부르고, `.py` 의 파일 읽기·쓰기에는 `encoding="utf-8"`.
- 템플릿 이름만 다르면 통과하던 탓에 머리 위 morph 알약이 세 번 연속 나왔다 (avatar-v01 07~09) → 이웃 장면의 지문 4축(배치·모션·주인공·첫 효과음)을 비교 (`variety.mjs`, 정책 `variety`). 이웃은 **편집 시간 순** (훅을 옮기면 순서가 바뀐다).
- 레퍼런스 리듬을 ffmpeg 장면 점수(하드컷)로 쟀더니 부드럽게 들어오는 모션그래픽 영상이 "컷 0번"으로 나왔다 → 0.25초 사이 화면 밝기 차로 잰다 (`reference.py`).
- faster-whisper 에 wav 경로를 넘겼더니 PyAV 19 에서 `metadata_errors` TypeError 로 받아쓰기가 죽었다 → `transcribe.py` 가 wav 를 numpy 로 읽어 배열로 넘긴다.
- 4초짜리 모션 레퍼런스를 `npm run reference` 숫자로만 봤더니 전환 1~2번·얼굴 비율로 엉뚱하게 읽혔다 → **콘택트 시트(fps=6 tile)를 직접 보고** 움직임을 문장으로 쪼갠다. 사용자가 좋다고 한 부분만 가져온다 (avatar-v03: 사진 틀이 커지는 것 ○, 굵은 표지 타이포 ✗) (`reference-taste` 2-1).
- 아바타 확대 수치를 render.mjs 와 Vertical.tsx 에 따로 적었다 → 정책 `avatarGrow` 한 곳에서 render 가 plan 으로 넘긴다 (시험이 확인).
- 새 함정을 고치면 `scripts/selftest.mjs` 에 시험 한 줄, 이 목록에 한 줄.
