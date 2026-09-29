# 문제 해결

먼저 `npm run doctor` 를 실행하세요. ❌ 가 있으면 그 줄의 → 안내대로 하면 대부분 끝납니다.
그래도 안 되면 이슈에 doctor 출력과 오류 메시지를 붙여 주세요.

## 설치

| 증상 | 원인 | 해결 |
|---|---|---|
| `ffmpeg: command not found` | ffmpeg 미설치 | macOS `brew install ffmpeg` · Windows `winget install ffmpeg` · Ubuntu `sudo apt install ffmpeg` |
| doctor 에 `ffmpeg 필터 없음` | 최소 빌드 ffmpeg | 위 명령으로 전체 빌드 설치 |
| 첫 받아쓰기가 몇 분째 멈춘 듯 | 음성 인식 모델(≈500MB)을 받는 중 | 기다리면 됩니다. `npm run setup` 이 미리 받아 둡니다 |
| 첫 렌더가 한참 걸림 | 렌더용 브라우저(≈100MB)를 받는 중 | 한 번만. 미리: `npx remotion browser ensure` |
| `npm run setup` 중 `pip install` 실패 | 네트워크 문제, 또는 너무 새 파이썬(3.14 등)이라 음성 인식 패키지가 아직 없음 | Python 3.12 를 설치하고(`brew install python@3.12`) `rm -rf .venv` 후 다시 `npm run setup`. 그래도 안 되면 오류 마지막 줄을 이슈에 |
| 모델 받기가 실패·멈춤 (회사망) | 프록시·방화벽이 huggingface.co 를 막음 | 다른 네트워크에서 `npm run setup` 한 번 (모델은 `~/.cache/huggingface` 에 남습니다) |
| Windows 에서 `python3`·`.venv/bin` 오류 | 일반 Windows 터미널은 미지원 | [WSL2](https://learn.microsoft.com/ko-kr/windows/wsl/install)(Ubuntu) 안에서 clone 부터 다시 |

## Claude Code

| 증상 | 원인 | 해결 |
|---|---|---|
| `/shorts` 가 목록에 없음 | Claude Code 를 다른 폴더에서 켰거나, clone 전에 켠 세션 | `cd avatar-shorts` 후 `claude` 를 **새로** 실행 |
| 명령마다 허용할지 물어봄 | 키트 명령이 아니거나, 폴더 밖에서 켬 | 키트 명령은 `.claude/settings.json` 에 허용돼 있습니다. 그 밖의 것은 "계속 허용"을 고르면 이후엔 묻지 않습니다 |
| 중간에 멈추고 대답을 기다림 | 영상 파일을 못 찾았거나 화면에 띄울 고유명사가 불확실 | 질문에 답하면 이어서 끝까지 갑니다 |

## 영상 넣기

| 증상 | 원인 | 해결 |
|---|---|---|
| `영상을 찾을 수 없어요` | 경로 오타·줄임(`.../파일.mp4`) | 파일 이름으로 바탕화면·다운로드·동영상·문서·`projects/` 를 자동으로 찾습니다. 못 찾으면 Finder 에서 파일을 터미널로 끌어다 놓아 전체 경로를 넣기 |
| 아이폰 `.mov`(HEVC) | 렌더가 불안정한 코덱 | 자동으로 H.264 로 변환합니다 (시간이 조금 걸림) |
| 원본이 바뀔까 걱정 | — | `projects/<이름>/input.mp4` 는 **복사본**입니다. 원본은 읽기만 합니다 |

## 자막

| 증상 | 원인 | 해결 |
|---|---|---|
| 고유명사가 틀림 | 음성 인식 한계 | `--hint "제품명, 이름"` 을 주거나, 대본을 같이 주면 대본을 정답으로 씁니다 |
| 전체적으로 부정확 | small 모델 | `--model medium` (느리지만 정확) |
| 일치율 70% 미만 경고 | script.txt 가 실제 말과 다름 | 빠지거나 더한 문장이 없는지 transcript.txt 와 대조 |
| 자막 18자 넘는다고 ❌ | 정책 `captions.maxChars` | script.txt 에서 쉼표·접속어 앞으로 줄을 나누고 `align.py` 다시 |

## 말 편집 (무음·재배치)

| 증상 | 원인 | 해결 |
|---|---|---|
| 무음이 거의 안 줄어듦 | 원래 쉬는 틈이 없는 영상 (AI 아바타 등) | 정상입니다 |
| "음, 어" 가 안 빠짐 | 음성 인식이 그 소리를 글자로 안 적으면 자를 자리를 모름 | `transcript.txt` 에 "음"이 있는지 확인. 없으면 "12초쯤 음 잘라줘" 라고 말하기 → `edit.json` 의 `cut` |
| 말끝이 잘림 | 배경 소음이 커서 무음 판정이 공격적 | 취향 `edit.silence: "natural"` |
| `자막을 다시 정렬했는데 편집본이 예전 것` ❌ | align 후 edit 를 안 돌림 | `python3 scripts/edit.py projects/<이름>` |
| `장면이 재배치 경계를 넘습니다` ❌ | 한 장면이 edit.json 의 두 덩어리에 걸침 | 장면을 나누거나 한 덩어리 안으로 |
| 편집 뒤 `장면이 1.2초보다 짧습니다` ❌ | 무음이 잘려서 장면이 줄어듦 | 옆 문장 쪽으로 in/out 을 늘리기 (plan 은 원본 시간 그대로) |

## 검사·렌더

| 증상 | 원인 | 해결 |
|---|---|---|
| `첫 1초(훅)는 얼굴` ❌ | 정책: 훅에 전체 화면 장면 금지 | 그 장면을 `panel` 로 바꾸거나 1초 뒤로 |
| `빈 판` ❌ | morph 첫 상태가 장면 시작보다 늦음 | 첫 상태를 in 쪽으로 당기기 (예: 알약을 먼저 띄우고 다음 상태로) |
| `트라이어드 … 대비` ❌ | 직접 준 3색이 글자 대비 정책 미달 | 승인 목록 이름을 쓰거나 `look.triad: "auto"` |
| 스틸이 예전 장면을 보여 줌 | (예전 버전) 검사가 .props.json 을 안 씀 | 지금은 `--check` 와 `npm run still` 이 항상 새로 씁니다 |
| 스틸 시각이 어긋남 | 원본 fps(25)·렌더 fps(30)·편집 시간이 다름 | 직접 계산하지 말고 `npm run still -- <이름> <원본 초>` (`--edit` 는 결과 영상 기준) |
| 오브젝트/카드가 한쪽으로 치우침 | kit 부품의 `x, y` 는 **가운데** 좌표 | motion-kit 스킬의 좌표 규칙 참고 |

## 결과물

| 증상 | 해결 |
|---|---|
| 자막이 작다/크다 | "자막 더 크게" 라고 말하기 → 취향 `captions.scale` |
| 색이 마음에 안 듦 | "plum 으로 바꿔줘" · "그라디언트 빼줘" → 취향 `look.triad` · `look.surface` |
| 훅 재배치가 싫음 | "원래 순서로" → 취향 `edit.structure: "as-is"` |
| 명령어가 검색창으로 나옴 | 명령어·코드는 morph `terminal` 상태로 (자동 규칙에 포함) |
