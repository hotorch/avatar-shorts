# 예시: README 의 전 → 후 영상

README 맨 위 영상(`docs/example/before.mp4` → `after.mp4`)을 만들 때 Claude 가 쓴 파일들입니다. 영상은 `docs/example/before.mp4` 에 있습니다.

| 파일 | 무엇 |
|---|---|
| `script.txt` | 교정한 대본 (한 줄 = 자막 한 큐. `*강조*`, `>` 큰 자막) |
| `words.json` · `captions.json` | 단어·자막 시각 (원본 시간) |
| `edit.json` | 말 순서: 15–16번(훅)을 맨 앞으로 |
| `plan.json` | 장면 9개 설계도 (원본 시간) |
| `taste.json` | 이 영상만의 취향 (팔레트) |
| `decisions.md` | 무엇을 왜 정했는지 |

## 직접 다시 만들어 보기
```bash
npm run new -- docs/example/before.mp4 avatar-v01
cp examples/avatar-v01/*.json examples/avatar-v01/script.txt projects/avatar-v01/
npm run edit -- avatar-v01
npm run render -- avatar-v01
```
받아쓰기를 건너뛰고 같은 설계도로 렌더합니다. `plan.json` 을 고쳐 가며 결과가 어떻게 바뀌는지 보기 좋습니다.
