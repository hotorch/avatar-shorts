# public/fonts — 렌더에 쓰는 글꼴

전부 이 폴더에서 읽는다 (렌더는 오프라인, CDN 금지). 어떤 조합에 쓰이는지는 `style/policy.json` 의 `fonts`, 고르는 법은 `.claude/skills/font-pairing/SKILL.md`.

| 파일 | 원본 | 라이선스 | 손댄 것 |
|---|---|---|---|
| BlackHanSans · Jua · AstaSans | google/fonts | OFL | 한글·라틴만 남김, woff2 |
| Hahmlet · NotoSerifKR | google/fonts | OFL | 700 한 굵기 + 한글·라틴만, woff2 |
| BricolageGrotesque(800) · Newsreader(600) · Caveat(700) | google/fonts | OFL | 한 굵기로 고정, woff2 |
| ArchivoBlack · YoungSerif | google/fonts | OFL | woff2 로 압축만 |
| Yellowtail | google/fonts | Apache-2.0 | woff2 로 압축만 |
| PlayfairDisplay · AbrilFatface · NanumPenScript | google/fonts | OFL (예약 이름 있음) | **글자를 빼지 않고** woff2 로 압축만 |
| A2Z-ExtraBold | 눈누 공식 웹폰트 | `A2Z-LICENSE.txt` | 없음 |
| MaruBuri | 네이버 한글 공식 웹폰트 | `MaruBuri-LICENSE.txt` | 없음 |

- OFL 예약 이름(Reserved Font Name)이 있는 폰트는 고치면 원래 이름을 쓸 수 없다. 새로 들일 때 `*-OFL.txt` 를 먼저 보고, 예약 이름이 있으면 압축만 한다.
- `local/` 은 사용자가 `npm run fonts -- add` 로 넣은 폰트다. 이 PC 에만 있고 git 에 안 올라간다 (파일 재배포가 금지된 폰트도 영상에는 쓸 수 있어서).
