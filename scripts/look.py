#!/usr/bin/env python3
"""렌더 결과(또는 원본)를 Claude 가 직접 보고 검수할 수 있게 프레임 시트를 만듭니다.

    npm run look -- projects/<이름>/out/final.mp4 [t1 t2 ...] [--out sheet.png] [--n 10]

시각을 안 주면 영상 전체에서 --n 장을 고르게 뽑습니다.
plan.json 경로를 --plan 으로 주면 훅(0.5초) + 각 장면의 가운데 시점을 뽑습니다 (편집본이면 옮긴 시간으로).
프레임이 --page(기본 12)장을 넘으면(롱폼) 시트를 <이름>-1.png, -2.png … 로 나눕니다. 한 장이면 1만 px 넘게 길어져 볼 수 없습니다.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from pathlib import Path


def duration(p: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                         capture_output=True, encoding="utf-8", errors="replace", check=True).stdout
    return float(out.strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("times", nargs="*", type=float)
    ap.add_argument("--out")
    ap.add_argument("--n", type=int, default=10)
    ap.add_argument("--plan")
    ap.add_argument("--width", type=int, default=0)
    ap.add_argument("--page", type=int, default=12, help="한 시트에 넣을 프레임 수 (0 = 나누지 않음)")
    a = ap.parse_args()

    v = Path(a.video)
    ts = list(a.times)
    if a.plan:
        # render 가 만든 .props.json 에는 편집본 기준으로 옮긴 시간이 들어 있다 (편집 안 했으면 plan 과 같음)
        props = Path(a.plan).with_name(".props.json")
        plan = json.loads((props if props.exists() else Path(a.plan)).read_text(encoding="utf-8"))
        ts = [0.5] + [round((s["in"] + s["out"]) / 2, 2) for s in plan["scenes"]]  # 0.5초 = 훅 확인
    if not ts:
        d = duration(v)
        ts = [round(d * (i + 0.5) / a.n, 2) for i in range(a.n)]

    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0", str(v)], capture_output=True, encoding="utf-8", errors="replace", check=True).stdout.strip().split(",")
    w, h = int(probe[0]), int(probe[1])
    tw = a.width or (360 if h > w else 640)
    out = Path(a.out) if a.out else v.with_name(v.stem + "_sheet.png")
    size = a.page if a.page and len(ts) > a.page else len(ts)
    pages = [ts[i:i + size] for i in range(0, len(ts), size)]
    cols = min(5 if h > w else 3, size)
    paged = len(pages) > 1

    for p, pts in enumerate(pages, 1):
        sheet = out.with_name(f"{out.stem}-{p}{out.suffix}") if paged else out
        rows = -(-len(pts) // cols)
        with tempfile.TemporaryDirectory() as td:
            for i, t in enumerate(pts):
                subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-i", str(v), "-frames:v", "1",
                                "-vf", f"scale={tw}:-2", f"{td}/{i:03d}.png"], check=True)
            subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-framerate", "1", "-i", f"{td}/%03d.png",
                            "-vf", f"tile={cols}x{rows}:padding=6:color=white", "-frames:v", "1", str(sheet)], check=True)
        print(f"시트: {sheet}")
        for i, t in enumerate(pts):
            print(f"  [{f'{p}쪽 ' if paged else ''}{i // cols + 1}행 {i % cols + 1}열] {t:.2f}s")


if __name__ == "__main__":
    main()
