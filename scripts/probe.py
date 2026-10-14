#!/usr/bin/env python3
"""입력 영상을 살펴봅니다: 크기·길이·비율 → 레이아웃 결정 + 대표 프레임 4장.

    npm run probe -- <이름>

결과: projects/<slug>/video.json, projects/<slug>/frames/probe_1..4.jpg
얼굴·머리 위치(faceX, faceY, head, track)는 이어서 scripts/face.py 가 채웁니다 (npm run new 가 둘 다 부른다).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


def ffprobe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(path)],
        capture_output=True, encoding="utf-8", errors="replace", check=True,
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


def inset_frame(src: Path, times, w: int, h: int):
    """아바타 도구가 인물 화면을 줄여 넣어 생긴 바깥 띠(단색 테두리)를 찾는다.
    예: DeepBrain 포토 아바타는 화면의 약 87% 크기로 아래에 붙여 내보내 위·좌·우에 밝은 띠가 남는다 (ep01-long).
    띠가 한 색이고(std<1.5) 안쪽과 경계가 뚜렷하며(diff>=4) 위·왼쪽·오른쪽이 다 그렇고, 두 프레임이 같은 답을 내야 인정.
    → {"top","left","right": 0~1, "colors": {면: "#rrggbb"(띠 바로 안쪽 배경색)}} 또는 None.
    Avatar.tsx 가 띠를 안쪽 배경색으로 덮어 이음매 없이 보이게 한다 (원본은 그대로)."""
    try:
        import numpy as np
    except ImportError:
        return None
    W, H = (480, 270) if w >= h else (270, 480)
    found = []
    for t in times:
        raw = subprocess.run(
            ["ffmpeg", "-loglevel", "error", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-vf", f"scale={W}:{H}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            capture_output=True, check=True,
        ).stdout
        a = np.frombuffer(raw, np.uint8).reshape(H, W, 3).astype(float)
        g = a.mean(2)
        xs = np.r_[int(.15 * W):int(.3 * W), int(.7 * W):int(.85 * W)]  # 인물을 피한 띠
        ys = np.arange(int(.3 * H), int(.6 * H))
        top_d = [np.abs(g[y, xs] - g[y - 1, xs]).mean() for y in range(2, int(.3 * H))]
        y0 = int(np.argmax(top_d)) + 2
        left_d = [np.abs(g[ys, x] - g[ys, x - 1]).mean() for x in range(2, int(.25 * W))]
        x0 = int(np.argmax(left_d)) + 2
        right_d = [np.abs(g[ys, x] - g[ys, x - 1]).mean() for x in range(int(.75 * W), W - 1)]
        x1 = int(np.argmax(right_d)) + int(.75 * W)
        ok = (max(top_d) >= 4 and g[:y0 - 1][:, xs].std() < 1.5
              and max(left_d) >= 4 and g[ys][:, :x0 - 1].std() < 1.5
              and max(right_d) >= 4 and g[ys][:, x1 + 1:].std() < 1.5)
        if not ok:
            return None
        hexc = lambda px: "#" + "".join(f"{int(round(c)):02x}" for c in px.reshape(-1, 3).mean(0))
        found.append({
            "top": y0 / H, "left": x0 / W, "right": 1 - x1 / W,
            "colors": {"top": hexc(a[y0 + 1:y0 + 6][:, xs]), "left": hexc(a[ys][:, x0 + 1:x0 + 6]), "right": hexc(a[ys][:, x1 - 5:x1])},
        })
    if len(found) < 2 or any(abs(found[0][k] - f[k]) > 0.01 for f in found[1:] for k in ("top", "left", "right")):
        return None
    f = found[0]
    return {"top": round(f["top"], 4), "left": round(f["left"], 4), "right": round(f["right"], 4), "colors": f["colors"]}


def main():
    if len(sys.argv) < 2:
        sys.exit("사용법: npm run probe -- <이름>")
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
    inset = inset_frame(src, [shots[1]["t"], shots[2]["t"]], w, h)

    old = {}
    vj = proj / "video.json"
    if vj.exists():
        old = json.loads(vj.read_text(encoding="utf-8"))
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
        "head": old.get("head"),
        "track": old.get("track"),
        "frames": shots,
        "tones": tones,
        "inset": inset,
    }
    vj.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    kind = "세로 쇼츠(1080×1920)" if layout == "vertical" else "가로 영상(1920×1080) — 아바타 왼쪽 카드 + 오른쪽 설명 화면"
    print(f"영상: {w}×{h}, {dur:.1f}초, {fps}fps, 오디오 {'있음' if has_audio else '없음'}")
    print(f"레이아웃: {kind}")
    print("대표 프레임:", ", ".join(s["file"] for s in shots))
    if inset:
        print(f"바깥 띠: 위 {inset['top']:.0%} · 왼쪽 {inset['left']:.0%} · 오른쪽 {inset['right']:.0%} — 인물 화면이 줄어 들어가 있어 띠를 안쪽 배경색으로 덮습니다 (다음엔 아바타 도구에서 화면 가득 키우면 더 선명)")
    sar = v.get("sample_aspect_ratio") or "1:1"
    if sar not in ("1:1", "0:1", "N/A"):
        # 예전: 세로로 다시 짠 영상에 35:2 가 붙어 렌더(브라우저)에서 얼굴이 가로로 늘어났다 — ffmpeg 프레임으로는 멀쩡해 보인다 (ep01-s1)
        print(f"⚠️  픽셀 비율(SAR)이 {sar} 입니다 — 렌더에서 화면이 늘어납니다. ffmpeg 로 바꿨다면 필터 끝에 setsar=1 을 붙여 다시 만드세요")
    if not has_audio:
        print("⚠️  오디오가 없어서 자막을 만들 수 없습니다.")


if __name__ == "__main__":
    main()
