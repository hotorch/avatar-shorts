# 아바타쇼츠 (avatar-shorts)

**셀카·아바타 영상 하나를 넣으면, 무음이 정리되고 훅이 앞으로 오고, 말하는 단어에 맞춰 모션그래픽이 뜨는 쇼츠·릴스가 나옵니다.**

Claude Code에서 `/shorts 내영상.mp4` 한 줄이면 받아쓰기, 자막 교정, 무음 제거, 훅 재배치, B-roll, 효과음까지 끝까지 만듭니다.

<p align="center">
  <img src="docs/before-after.gif" width="360" alt="왼쪽: 원본 셀카 영상 27.0초 / 오른쪽: 완성된 쇼츠 25.9초" />
</p>
<p align="center">
  소리까지 보기: <a href="docs/example/before.mp4">원본 (27.0초)</a> · <a href="docs/example/after.mp4">결과 (25.9초)</a>
</p>

- **무료, 로컬 실행.** API 키가 없어도 됩니다. 음성 인식과 렌더가 내 컴퓨터에서 돌아갑니다.
- **얼굴을 가리지 않습니다.** 머리 위치를 재서 설명 화면을 머리 위·턱 아래·분할·화면 전체 중 알맞은 자리에 띄웁니다.
- **묻지 않고 끝까지 만듭니다.** 무엇을 왜 정했는지 마지막에 표로 알려 줍니다. 마음에 안 드는 곳만 말하면 됩니다.
- **내 취향을 배웁니다.** 좋아하는 영상을 주거나 결과를 고치면 다음 영상부터 그 취향으로 만듭니다.

> 📚 **교육용 프로젝트입니다.** Claude Code에 스킬·정책·검사를 붙여 일을 끝까지 맡기는 방법을 보여 주려고 공개했습니다. 만든 과정은 유튜브 [@ai.sam_hottman](https://www.youtube.com/@ai.sam_hottman) 에서 소개합니다.

## 빠른 시작

**1. 준비물**

| | macOS | Windows |
|---|---|---|
| [Claude Code](https://claude.com/claude-code) (Claude 유료 요금제) | 사이트 안내대로 | 사이트 안내대로 |
| [Node.js](https://nodejs.org) 18+ | 사이트에서 LTS | `winget install OpenJS.NodeJS.LTS` |
| [Python](https://www.python.org) 3.10~3.13 | `brew install python@3.12` | `winget install Python.Python.3.12` |
| [ffmpeg](https://ffmpeg.org) | `brew install ffmpeg` | `winget install Gyan.FFmpeg` |
| [Git](https://git-scm.com) | 처음 `git` 을 치면 설치 창이 뜸 | `winget install Git.Git` |

Windows는 WSL 없이 PowerShell에서 됩니다. 다 깔고 나면 PowerShell 창을 새로 여세요.

**2. 설치** (한 번만, 5~10분)

```bash
git clone https://github.com/hotorch/avatar-shorts.git
cd avatar-shorts
npm run setup      # 패키지·음성 인식·브라우저를 받고 진단까지
npm run demo       # 영상 없이 데모 렌더 → projects/_demo/
```

**3. 만들기**

같은 폴더에서 `claude` 를 켜고:

```
/shorts ~/Desktop/내영상.mp4
```

대본이 있으면 다음 줄에 붙여 주세요. 자막이 정확해집니다. 30초 영상이면 10~20분 걸리고, 결과는 `projects/<이름>/out/final.mp4` 에 생깁니다.

뭔가 안 되면 `npm run doctor` 를 먼저 실행하고, [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) 를 보세요.

## 이렇게 말해 보세요

- "3번 장면은 얼굴로 두고, 마지막에 결론 카드 넣어줘"
- "자막 조금 더 크게" / "무음 덜 잘라줘" / "45초로 줄여줘"
- "렌더 전에 스토리보드 먼저 보여줘"
- "이 영상처럼 만들고 싶어" (좋아하는 영상 파일과 함께) / "내 취향 보여줘"
- "이 레퍼런스 그라디언트를 우리 정책으로 넣어줘"
- "구글 플로우로 비롤을 만들고 싶어. 프롬프트 줘"

**좋은 영상 조건:** 15~90초 한국어, 조용한 곳, 정면에 머리 위 여유 조금, 문장 사이 반 박자 쉬기. 영상에서 **말하지 않은** 숫자·결과는 화면에 만들지 않습니다.

## 더 알아보기

- [examples/avatar-v01/](examples/avatar-v01/): 위 영상의 대본·설계도·결정 기록
- [style/README.md](style/README.md): 정책(어기면 틀림, 렌더가 막음)과 취향(고르는 것). 내 취향은 `style/me.json` 에 내 PC에만 저장
- [CLAUDE.md](CLAUDE.md): 명령, 코드 지도, 실제로 겪은 함정
- 들어 있는 것: 템플릿 12종, 3D 오브젝트 62종, 글꼴 6종, 합성 효과음 11종, 스킬 9개 (`.claude/skills/`)

## 자주 묻는 것

- **`/shorts` 가 안 보여요.** Claude Code를 이 폴더에서 **새로** 켜야 스킬이 잡힙니다: `cd avatar-shorts && claude`.
- **명령마다 허용할지 물어봐요.** 이 키트가 쓰는 명령과 `projects/` 안 파일 수정은 [.claude/settings.json](.claude/settings.json) 에 미리 허용해 두었습니다. 걱정되면 이 파일을 먼저 읽어 보세요.
- **원본 영상이 바뀌나요?** 아니요. `projects/<이름>/input.mp4` 로 복사해서 씁니다.
- **자막이 부정확해요.** 대본을 같이 주는 게 가장 확실합니다. 고유명사는 처음에 알려 주세요.

## 기여하기

코드를 고쳤으면 `npm test` (1분 안쪽). 버그를 고쳤으면 `scripts/selftest.mjs` 에 시험 한 줄, `CLAUDE.md` 의 "실제로 겪은 함정"에 한 줄.

## 라이선스와 출처

- 코드: MIT. 복사본에 `LICENSE` 파일만 남겨 주세요.
- **출처 표시 부탁** (의무는 아니지만 큰 힘이 됩니다):
  ```
  avatar-shorts by @ai.sam_hottman (YouTube) · hotorch (GitHub)
  https://github.com/hotorch/avatar-shorts
  ```
- 글꼴 OFL (`public/fonts/*-OFL.txt`) · 3D 오브젝트 CC0 (`public/objects/LICENSE`) · 얼굴 인식 [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) MIT (`models/yunet/LICENSE`)
- 렌더 엔진 [Remotion](https://remotion.dev)은 개인과 직원 3명 이하 회사는 무료입니다. 그보다 큰 회사는 [회사 라이선스](https://remotion.pro)가 필요합니다.
