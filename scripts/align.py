#!/usr/bin/env python3
"""교정된 대본(script.txt)에 음성 인식 단어 타이밍을 붙입니다.

    npm run align -- <이름>

입력
  words.raw.json  음성 인식 결과 (시간은 믿고, 글자는 안 믿는다)
  script.txt      Claude 가 교정한 대본. 한 줄 = 자막 한 큐(절 하나)
                    *단어*   → 강조 (강조색)
                    +단어+   → 돈·혜택 (초록)
                    -단어-   → 문제·경고 (빨강)   ※ 한 줄에 강조는 최대 2개
                    > 로 시작 → big 스타일 (훅·결론, 박스 없이 크게)
                    # 로 시작하는 줄은 무시 (메모)
출력
  words.json      교정된 단어 + 시간  [{text, start, end, cue}]
  captions.json   자막 큐            [{start, end, text, emph, style}]

방법: 두 텍스트를 한글 음절 단위로 맞춰 보고(difflib), 맞은 음절의 시간을 가져온다.
      못 맞춘 단어(숫자 표기 차이 등)는 앞뒤 단어 사이로 보간한다.
"""
from __future__ import annotations

import difflib
import json
import re
import sys
from pathlib import Path

HOLD_LAST = 0.28  # 마지막 큐 유지 시간
MIN_CUE = 0.5
EMPH = [(r"\*(.+?)\*", "key"), (r"\+(.+?)\+", "money"), (r"(?<![\w가-힣])-(.+?)-(?![\w가-힣])", "problem")]

# 숫자·기호를 소리 나는 대로 비교하기 위한 아주 작은 사전 (정렬용, 화면 글자는 안 바뀜)
READ = {"0": "영", "1": "일", "2": "이", "3": "삼", "4": "사", "5": "오", "6": "육", "7": "칠", "8": "팔", "9": "구",
        "%": "퍼센트", "+": "플러스", "&": "앤"}


def norm(s: str) -> str:
    """비교용: 한글·영문·숫자만, 소문자, 숫자는 읽는 소리로"""
    s = s.lower()
    s = "".join(READ.get(c, c) for c in s)
    return re.sub(r"[^0-9a-z가-힣]", "", s)


def parse_script(text: str):
    cues = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        style = "base"
        if line.startswith(">"):
            style, line = "big", line[1:].strip()
        emph = []
        for pat, tone in EMPH:
            for m in re.finditer(pat, line):
                emph.append({"text": m.group(1), "tone": tone, "pos": m.start()})
        clean = line
        for pat, _ in EMPH:
            clean = re.sub(pat, r"\1", clean)
        emph = [{"text": e["text"], "tone": e["tone"]} for e in sorted(emph, key=lambda e: e["pos"])][:2]
        cues.append({"text": clean, "emph": emph, "style": style, "tokens": clean.split()})
    return cues


def main():
    if len(sys.argv) < 2:
        sys.exit("사용법: npm run align -- <이름>")
    proj = Path(sys.argv[1])
    raw = json.loads((proj / "words.raw.json").read_text(encoding="utf-8"))
    script_p = proj / "script.txt"
    if not script_p.exists():
        sys.exit("script.txt 가 없습니다. transcript.txt 를 교정해서 한 줄에 한 절씩 script.txt 로 저장하세요.")
    cues = parse_script(script_p.read_text(encoding="utf-8"))

    # 음성 쪽: 글자별 시간표
    a_chars, a_time = [], []
    for w in raw:
        n = norm(w["text"])
        if not n:
            continue
        span = max(0.01, w["end"] - w["start"])
        for k, c in enumerate(n):
            a_chars.append(c)
            a_time.append((w["start"] + span * k / len(n), w["start"] + span * (k + 1) / len(n)))

    # 대본 쪽: 글자 → (큐, 토큰)
    b_chars, b_owner, tokens = [], [], []
    for ci, cue in enumerate(cues):
        for tok in cue["tokens"]:
            ti = len(tokens)
            tokens.append({"text": tok, "cue": ci, "start": None, "end": None})
            for c in norm(tok):
                b_chars.append(c)
                b_owner.append(ti)

    sm = difflib.SequenceMatcher(None, a_chars, b_chars, autojunk=False)
    matched = 0
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            ti = b_owner[blk.b + k]
            s, e = a_time[blk.a + k]
            tk = tokens[ti]
            tk["start"] = s if tk["start"] is None else min(tk["start"], s)
            tk["end"] = e if tk["end"] is None else max(tk["end"], e)
            matched += 1

    # 못 맞춘 토큰 보간
    guessed = []
    total_end = raw[-1]["end"] if raw else 0
    for i, tk in enumerate(tokens):
        if tk["start"] is not None:
            continue
        prev_end = next((tokens[j]["end"] for j in range(i - 1, -1, -1) if tokens[j]["end"] is not None), 0.0)
        nxt = next((j for j in range(i + 1, len(tokens)) if tokens[j]["start"] is not None), None)
        next_start = tokens[nxt]["start"] if nxt is not None else total_end
        gap_n = (nxt if nxt is not None else len(tokens)) - i + 1
        step = max(0.05, (next_start - prev_end) / gap_n)
        tk["start"] = prev_end + step * 0.1
        tk["end"] = tk["start"] + step * 0.9
        guessed.append(tk["text"])
    for i in range(1, len(tokens)):  # 단조 증가 보장
        if tokens[i]["start"] < tokens[i - 1]["start"]:
            tokens[i]["start"] = tokens[i - 1]["start"] + 0.01
        tokens[i]["end"] = max(tokens[i]["end"], tokens[i]["start"] + 0.05)

    words = [{"text": t["text"], "start": round(t["start"], 3), "end": round(t["end"], 3), "cue": t["cue"]} for t in tokens]

    # 큐: 첫 단어 시작 ~ 다음 큐 시작 (마지막은 끝 단어 + HOLD_LAST)
    out = []
    for ci, cue in enumerate(cues):
        ws = [w for w in words if w["cue"] == ci]
        if not ws:
            continue
        out.append({"start": ws[0]["start"], "end": ws[-1]["end"], "text": cue["text"], "emph": cue["emph"], "style": cue["style"]})
    for i, c in enumerate(out):
        nxt = out[i + 1]["start"] if i + 1 < len(out) else c["end"] + HOLD_LAST
        # 다음 큐까지 1.2초 넘게 비면 끝 단어 뒤 0.5초에서 끊는다 (말 없는 구간에 자막이 떠 있지 않게)
        c["end"] = round(min(nxt, c["end"] + 0.5) if nxt - c["end"] > 1.2 else nxt, 3)
        c["start"] = round(c["start"], 3)
        if c["end"] - c["start"] < MIN_CUE:
            c["end"] = round(c["start"] + MIN_CUE, 3)
        if not c["emph"]:
            del c["emph"]
        if c["style"] == "base":
            del c["style"]

    (proj / "words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
    (proj / "captions.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")

    rate = matched / max(1, len(b_chars))
    print(f"자막 {len(out)}개, 단어 {len(words)}개 정렬 완료 (글자 일치율 {rate:.0%})")
    if guessed:
        print("시간을 추정한 단어:", ", ".join(guessed[:40]))
    if rate < 0.7:
        print("⚠️  일치율이 낮습니다. script.txt 가 실제 말과 많이 다른지 확인하세요.")
    long = [c for c in out if len(c["text"]) > 18]
    if long:
        print("⚠️  한 줄이 긴 자막(18자 초과, 나누면 좋음):", " / ".join(c["text"] for c in long))


if __name__ == "__main__":
    main()
