#!/usr/bin/env python3
"""한국어 음성 → 단어 단위 타이밍 (faster-whisper, 로컬·무료).

    npm run transcribe -- <이름> [--model small|medium] [--hint "고유명사, 제품명"]

결과
  words.raw.json   [{text, start, end, prob}]  ← 음성 인식 그대로 (오탈자 포함)
  transcript.txt   문장 단위 원문 (Claude 가 이걸 읽고 교정본 script.txt 를 씀)

--hint: 영상에 나오는 고유명사를 적어 주면 인식률이 올라갑니다 (예: "클로드 코드, 리모션, 쇼츠")
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--model", default=os.environ.get("WHISPER_MODEL", "small"))
    ap.add_argument("--hint", default="")
    ap.add_argument("--device", default=os.environ.get("WHISPER_DEVICE", "auto"))
    a = ap.parse_args()

    proj = Path(a.project)
    src = next((p for p in proj.glob("input.*")), None)
    if not src:
        sys.exit(f"{proj}/input.* 가 없습니다.")

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("faster-whisper 가 없습니다. npm run setup 을 먼저 실행하세요.")

    with tempfile.TemporaryDirectory() as td:
        wav = Path(td) / "a.wav"
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-vn", "-ac", "1", "-ar", "16000", str(wav)],
            check=True,
        )
        print(f"음성 인식 중… (모델 {a.model}, 처음 한 번은 모델을 내려받습니다)", flush=True)
        model = WhisperModel(a.model, device=a.device, compute_type="int8")
        # wav 를 직접 읽어 배열로 넘긴다 — faster-whisper 의 PyAV 디코더는 av 버전에 따라 깨진다 (av 19: metadata_errors)
        import wave
        import numpy as np
        with wave.open(str(wav), "rb") as wf:
            audio = np.frombuffer(wf.readframes(wf.getnframes()), np.int16).astype(np.float32) / 32768.0
        segments, info = model.transcribe(
            audio,
            language="ko",
            word_timestamps=True,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": 300},
            beam_size=5,
            condition_on_previous_text=False,
            # 예시에 "음, 어" 를 넣어 둬야 whisper 가 군더더기를 지우지 않고 받아 적는다 (edit.py 가 그걸 보고 잘라냄)
            initial_prompt="음, 어, 그러니까 말한 그대로 받아 적은 한국어 영상입니다." + (f" 등장 단어: {a.hint}" if a.hint else ""),
        )
        words, lines = [], []
        for seg in segments:
            lines.append(f"[{seg.start:6.2f}–{seg.end:6.2f}] {seg.text.strip()}")
            for w in seg.words or []:
                t = w.word.strip()
                if not t:
                    continue
                words.append({"text": t, "start": round(w.start, 3), "end": round(w.end, 3), "prob": round(w.probability, 3)})

    words = fix_overlaps(words)
    (proj / "words.raw.json").write_text(json.dumps(words, ensure_ascii=False, indent=1), encoding="utf-8")
    (proj / "transcript.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    low = [w for w in words if w["prob"] < 0.5]
    print(f"단어 {len(words)}개, 문장 {len(lines)}개 → {proj}/words.raw.json, transcript.txt")
    if low:
        print("확신이 낮은 단어(교정 후보):", ", ".join(f"{w['text']}@{w['start']:.1f}s" for w in low[:30]))


def fix_overlaps(words):
    """단어 경계가 겹치거나 거꾸로 된 경우를 정리 (Whisper 가 가끔 그렇다)"""
    for i in range(1, len(words)):
        if words[i]["start"] < words[i - 1]["end"]:
            mid = (words[i]["start"] + words[i - 1]["end"]) / 2
            words[i - 1]["end"] = round(mid, 3)
            words[i]["start"] = round(mid, 3)
        if words[i]["end"] <= words[i]["start"]:
            words[i]["end"] = round(words[i]["start"] + 0.08, 3)
    return words


if __name__ == "__main__":
    main()
