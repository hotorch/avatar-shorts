#!/usr/bin/env python3
"""편집본을 다시 받아써서 자막과 실제 소리가 맞는지 본다 (npm run recheck -- <이름>).

음성 인식은 단어 시작을 1초 가까이 늦게 잡을 때가 있고(긴 영문 한 단어), 그러면 자막이 소리보다 밀린다.
편집 뒤의 소리를 처음부터 다시 인식해 두 가지를 찾는다.
  - 시각이 어긋난 단어: 자막 시각과 다시 들은 시각의 차이가 --tol(기본 0.5초)을 넘는 단어
  - 안 들리는 단어: 자막에는 있는데 다시 들으니 없는 단어 (편집으로 잘렸거나 인식이 놓친 것)
어긋난 단어가 있으면 원본 시각을 알려 주고 종료 코드 1.

--heard <json> : 다시 받아쓰는 대신 [[단어, 시작, 끝], …] 파일을 쓴다 (시험용).
"""
import argparse
import difflib
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def norm(s):
    return "".join(c for c in s.lower() if c.isalnum())


def compare(caps, heard, tol):
    """caps = [{text, start}], heard = [[단어, 시작, 끝]] → (어긋난 단어, 안 들리는 단어)"""
    a = [norm(w["text"]) for w in caps]
    b = [norm(h[0]) for h in heard]
    drift, missing = [], []
    for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if tag == "equal":
            pairs = zip(range(i1, i2), range(j1, j2))
        elif tag == "replace":
            pairs = [(i1, j1)]  # 표기만 다른 덩어리 (Stripe/strike, getdesign.md/getdesign .md): 첫 단어끼리 비교
        else:
            if tag == "delete":
                missing += [caps[i] for i in range(i1, i2)]
            continue
        for i, j in pairs:
            d = caps[i]["start"] - heard[j][1]
            if abs(d) > tol:
                drift.append({"text": caps[i]["text"], "caption": caps[i]["start"], "heard": heard[j][1], "diff": d})
    return drift, missing


def to_source(cuts, t):
    for s in (cuts or {}).get("segments", []):
        if s["out"][0] <= t <= s["out"][1]:
            return s["src"][0] + (t - s["out"][0])
    return None


def listen(video, model_name, device):
    import wave

    import numpy as np
    from faster_whisper import WhisperModel

    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, "a.wav")
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", wav], check=True)
        with wave.open(wav, "rb") as wf:
            audio = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768.0
    model = WhisperModel(model_name, device=device, compute_type="int8")
    segs, _ = model.transcribe(audio, language="ko", beam_size=5, temperature=0, condition_on_previous_text=False, word_timestamps=True)
    return [[w.word.strip(), float(w.start), float(w.end)] for s in segs for w in s.words]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"))
    ap.add_argument("--device", default=os.environ.get("WHISPER_DEVICE", "auto"))
    ap.add_argument("--tol", type=float, default=0.5)
    ap.add_argument("--heard")
    a = ap.parse_args()

    p = Path(a.project)
    edited = (p / "words.edit.json").exists()
    words_file = p / ("words.edit.json" if edited else "words.json")
    if not words_file.exists():
        print(f"❌ {words_file} 가 없습니다 → npm run align (편집했으면 npm run edit) 먼저")
        sys.exit(2)
    caps = json.loads(words_file.read_text(encoding="utf-8"))
    caps = caps if isinstance(caps, list) else caps["words"]
    cuts_file = p / "cuts.json"
    cuts = json.loads(cuts_file.read_text(encoding="utf-8")) if edited and cuts_file.exists() else None

    if a.heard:
        heard = json.loads(Path(a.heard).read_text(encoding="utf-8"))
    else:
        print(f"다시 받아쓰는 중… (모델 {a.model})")
        heard = listen(p / ("edit.mp4" if edited else "input.mp4"), a.model, a.device)

    drift, missing = compare(caps, heard, a.tol)
    if missing:
        print(f"ℹ️  다시 들으니 없는 단어 {len(missing)}개 (말이 잘렸는지 그 자리를 들어 보세요): " + ", ".join(f"{w['text']}@{w['start']:.2f}" for w in missing))
    if not drift:
        print(f"✅ 자막과 소리가 맞습니다 (단어 {len(caps)}개, 허용 차이 {a.tol}초)")
        return
    for w in drift:
        src = to_source(cuts, w["heard"])
        where = f" → 원본 {src:.2f}초" if src is not None else ""
        print(f"⚠️  \"{w['text']}\": 자막 {w['caption']:.2f}초, 실제 소리 {w['heard']:.2f}초 ({w['diff']:+.2f}초){where}")
    print("→ words.raw.json 에서 그 단어의 start 를 원본 시각으로 고친 뒤 npm run align, npm run edit")
    sys.exit(1)


if __name__ == "__main__":
    main()
