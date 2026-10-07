#!/usr/bin/env python3
"""레퍼런스 영상(좋아하는 쇼츠 등)을 숫자로 잽니다: 화면 전환 리듬, 말 사이 쉼, 얼굴이 보이는 비율, 배경 색. + 컷마다 한 장 시트.

    npm run reference -- <영상> [이름]   (scripts/reference.mjs 가 부르고, 결과로 style/me.json 을 다시 계산한다)
    직접: node scripts/py.mjs reference <영상> <결과폴더>

결과: <결과폴더>/reference.json, <결과폴더>/sheet.png
영상은 읽기만 한다 (복사·수정 없음). 구도·리듬만 재고, 그림·글자·로고는 가져오지 않는다.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from probe import ffprobe, video_tones

RATE = 4          # 초당 몇 장 비교할지
CHANGE = 12       # 0.25초 사이 평균 밝기 차(0~255)가 이 이상이면 화면이 바뀐 것 (말하는 얼굴만이면 5 안쪽, 장면 등장·퇴장은 20~70)
MERGE = 0.5       # 이보다 가까운 변화는 한 번 (등장 애니메이션이 여러 장에 걸친다)
PAUSE_DB = -35     # 이보다 조용하면 쉼
PAUSE_MIN = 0.12   # 이보다 짧은 쉼은 숨소리
FACE_MIN = 0.2     # 머리(정수리~턱)가 화면 높이의 이만큼 이상이면 "얼굴이 보인다"
SHEET_MAX = 20


def median(xs):
    s = sorted(xs)
    n = len(s)
    return None if not n else s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def changes(src: Path, w: int, h: int) -> list[float]:
    """화면이 크게 바뀐 순간들. 하드컷만 보는 ffmpeg scene 점수는 부드럽게 들어오는 모션그래픽을 못 잡아서 직접 잰다"""
    sw, sh = (36, 64) if h > w else (64, 36)
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", str(src), "-vf", f"fps={RATE},scale={sw}:{sh}", "-f", "rawvideo", "-pix_fmt", "gray", "-"],
                         capture_output=True, check=True).stdout
    n = sw * sh
    frames = [raw[i:i + n] for i in range(0, len(raw) - n + 1, n)]
    ts, last = [], -9.0
    for k in range(1, len(frames)):
        t = k / RATE
        if sum(abs(a - b) for a, b in zip(frames[k - 1], frames[k])) / n >= CHANGE:
            if t - last > MERGE:
                ts.append(round(t, 2))
            last = t
    return ts


def pauses(src: Path, dur: float) -> list[float]:
    """말 사이 쉼 길이들 (영상 처음·끝의 무음은 뺀다)"""
    out = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af", f"silencedetect=noise={PAUSE_DB}dB:d={PAUSE_MIN}", "-vn", "-f", "null", "-"],
                         capture_output=True, encoding="utf-8", errors="replace").stderr
    ends = [(float(e), float(d)) for e, d in re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", out)]
    return [round(d, 3) for e, d in ends if e - d > 0.05 and e < dur - 0.05]


def face_ratio(src: Path, w: int, h: int):
    """얼굴(머리)이 크게 보이는 프레임 비율. opencv 가 없으면 None"""
    try:
        import cv2  # noqa: F401
    except ImportError:
        return None
    from face import track
    rows, n = track(src, w, h)
    return round(sum(1 for r in rows if r[2] - r[1] >= FACE_MIN) / max(n, 1), 3)


def main():
    if len(sys.argv) < 3:
        sys.exit("사용법: node scripts/py.mjs reference <영상> <결과폴더>")
    src, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    info = ffprobe(src)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in info["streams"])
    w, h = int(v["width"]), int(v["height"])
    dur = float(info["format"].get("duration") or v.get("duration") or 0)

    cs = changes(src, w, h)
    bounds = [0.0, *cs, dur]
    mids = [round((a + b) / 2, 2) for a, b in zip(bounds, bounds[1:]) if b - a > 0.05]
    ps = pauses(src, dur) if has_audio else []
    data = {
        "file": src.name,
        "width": w,
        "height": h,
        "duration": round(dur, 2),
        "layout": "vertical" if w / h < 1.1 else "side",
        "audio": has_audio,
        "changes": len(cs),
        "changesPerMin": round(len(cs) / dur * 60, 1) if dur else 0,
        "avgShot": round(dur / (len(cs) + 1), 2),
        "pauseMedian": median(ps) if has_audio else None,
        "pauses": len(ps),
        "faceRatio": face_ratio(src, w, h),
        "tones": video_tones(src, mids[:: max(1, len(mids) // 24)][:24]),
    }

    # 시트: 화면 전환 사이마다 가운데 한 장 (많으면 고르게 SHEET_MAX 장)
    pick = mids[:: max(1, -(-len(mids) // SHEET_MAX))]
    cols = min(len(pick), 5 if h > w else 3)
    tw = 360 if h > w else 640
    with tempfile.TemporaryDirectory() as td:
        for i, t in enumerate(pick):
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-vf", f"scale={tw}:-2", f"{td}/{i:03d}.png"], check=True)
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", "1", "-i", f"{td}/%03d.png", "-vf", f"tile={cols}x{-(-len(pick) // cols)}:padding=6:color=white",
                        "-frames:v", "1", str(out / "sheet.png")], check=True)
    data["sheet"] = [round(t, 2) for t in pick]
    (out / "reference.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: data[k] for k in ("duration", "changes", "changesPerMin", "avgShot", "pauseMedian", "faceRatio")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
