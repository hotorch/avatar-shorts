#!/usr/bin/env python3
"""입력 영상을 살펴봅니다: 크기·길이·비율 → 레이아웃 결정 + 대표 프레임 4장.

    python3 scripts/probe.py projects/<slug>

결과: projects/<slug>/video.json, projects/<slug>/frames/probe_1..4.jpg
얼굴 위치(faceX, faceY)는 Claude 가 프레임을 보고 video.json 에 채웁니다.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def ffprobe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return json.loads(out)


def video_tones(src: Path, times) -> dict:
    """영상 배경의 색 분위기: 채도 있는 픽셀의 색상 분포(30° 12칸, 합 1) + 평균 밝기.
    취향 look.triad 가 auto 면 style.mjs 가 이걸 보고 어울리는 트라이어드를 고른다."""
    import colorsys
    bins = [0.0] * 12
    light, n = 0.0, 0
    for t in times:
        raw = subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-vf", "scale=36:64", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            capture_output=True, check=True,
        ).stdout
        for i in range(0, len(raw) - 2, 3):
            x, y = (i // 3) % 36, (i // 3) // 36
            if 8 <= x < 28 and y >= 10:  # 가운데(얼굴·피부)는 빼고 배경만 — 양옆 22%, 위 15%
                continue
            h, l, sat = colorsys.rgb_to_hls(raw[i] / 255, raw[i + 1] / 255, raw[i + 2] / 255)
            light += l
            n += 1
            w = sat * (1 - abs(2 * l - 1))  # 선명한 색일수록 크게 (회색·검정·흰색은 거의 0)
            bins[int(h * 12) % 12] += w
    tot = sum(bins) or 1
    return {"hues": [round(b / tot, 3) for b in bins], "chroma": round(tot / max(n, 1), 3), "lightness": round(light / max(n, 1), 3)}


def main():
    if len(sys.argv) < 2:
        sys.exit("사용법: probe.py projects/<slug>")
    proj = Path(sys.argv[1])
    src = next((p for p in proj.glob("input.*")), None)
    if not src:
        sys.exit(f"{proj}/input.* 가 없습니다. 먼저 npm run new -- <영상경로> 를 실행하세요.")

    info = ffprobe(src)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in info["streams"])
    w, h = int(v["width"]), int(v["height"])
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = int(sd["rotation"])
    rot = rot or int(v.get("tags", {}).get("rotate", 0) or 0)
    if abs(rot) in (90, 270):
        w, h = h, w
    dur = float(info["format"].get("duration") or v.get("duration") or 0)
    num, den = (v.get("avg_frame_rate") or "30/1").split("/")
    fps = round(float(num) / float(den or 1), 2) if float(den or 1) else 30

    ratio = w / h
    layout = "vertical" if ratio < 0.9 else "side"
    # 정사각형(0.9~1.1)은 세로 쇼츠로 채움 크롭
    if 0.9 <= ratio <= 1.1:
        layout = "vertical"

    frames = proj / "frames"
    frames.mkdir(exist_ok=True)
    shots = []
    for i, frac in enumerate((0.12, 0.38, 0.62, 0.88), 1):
        t = round(dur * frac, 2)
        out = frames / f"probe_{i}.jpg"
        subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-y", "-ss", str(t), "-i", str(src), "-frames:v", "1",
             "-vf", "scale='min(960,iw)':-2", "-q:v", "3", str(out)],
            check=True,
        )
        shots.append({"t": t, "file": str(out)})

    tones = video_tones(src, [s["t"] for s in shots])

    old = {}
    vj = proj / "video.json"
    if vj.exists():
        old = json.loads(vj.read_text())
    data = {
        "file": src.name,
        "width": w,
        "height": h,
        "duration": round(dur, 3),
        "fps": fps,
        "audio": has_audio,
        "layout": layout,
        "faceX": old.get("faceX"),
        "faceY": old.get("faceY"),
        "frames": shots,
        "tones": tones,
    }
    vj.write_text(json.dumps(data, ensure_ascii=False, indent=2))

    kind = "세로 쇼츠(1080×1920)" if layout == "vertical" else "가로 영상(1920×1080) — 아바타 왼쪽 카드 + 오른쪽 설명 화면"
    print(f"영상: {w}×{h}, {dur:.1f}초, {fps}fps, 오디오 {'있음' if has_audio else '없음'}")
    print(f"레이아웃: {kind}")
    print("대표 프레임:", ", ".join(s["file"] for s in shots))
    if not has_audio:
        print("⚠️  오디오가 없어서 자막을 만들 수 없습니다.")


if __name__ == "__main__":
    main()
