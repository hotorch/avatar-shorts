#!/usr/bin/env python3
"""아바타 배경 지우기: 단색 배경 앞 인물만 남긴 투명 영상(avatar.webm)을 만든다 — 회색 배경 대신 장면과 같은 바탕 위에 사람만 보이게.

    npm run matte -- <이름> [--check]

결과: projects/<이름>/avatar.webm (VP9 + 투명, 소리 포함), projects/<이름>/matte.json (잘라 낸 영역)
render 가 matte.json 을 보면 아바타를 이 영상으로 그린다: 가로는 카드 대신 화면 아래에 선 사람 (`Side.tsx`), 세로는 원래 자리 그대로 바탕만 Backdrop (`Avatar.tsx`, `Vertical.tsx`). 지우면 원래대로.
--check: 프레임 3장만 합성해서 frames/matte_check.png 로 (전체를 만들기 전 눈으로 확인)

원리 (DeepBrain 포토 아바타처럼 무늬 없는 밝은 배경일 때):
  배경색(띠 안쪽 위 구석들의 중앙값)과 Lab 거리가 먼 픽셀 → 바닥에 닿는 가장 큰 덩어리 = 사람 → 안쪽 구멍 메우기(흰 셔츠 깃) → 가장자리 부드럽게.
  배경색이 사람과 비슷하거나 무늬가 있으면 맞지 않는다 → 덩어리가 화면의 70% 를 넘거나 10% 미만이면 멈춘다.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

THRESH = 9.0  # 배경과의 Lab 거리 (밝기는 0.6 배). 배경 잡음은 99% 가 2 아래 (ep01-long)
EMA = 0.35  # 가장자리 깜빡임 줄이기: 앞 프레임 알파를 이만큼 섞는다


def run_json(cmd):
    return json.loads(subprocess.run(cmd, capture_output=True, encoding="utf-8", errors="replace", check=True).stdout)


def grab(src: Path, t: float, w: int, h: int) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-loglevel", "error", "-ss", str(t), "-i", str(src), "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def person_mask(img: np.ndarray, bg: np.ndarray, top: int) -> np.ndarray:
    """0/255 마스크 (가장자리 흐리기 전). top 위(바깥 띠)는 배경."""
    H, W = img.shape[:2]
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    d = lab - bg
    d[..., 0] *= 0.6
    fg = (np.sqrt((d * d).sum(2)) > THRESH).astype(np.uint8)
    fg[:top] = 0
    n, lbl, st, _ = cv2.connectedComponentsWithStats(fg, 8)
    cand = [i for i in range(1, n) if st[i, 1] + st[i, 3] >= H - 2]
    if not cand:
        return np.zeros((H, W), np.uint8)
    best = max(cand, key=lambda i: st[i, 4])
    m = (lbl == best).astype(np.uint8) * 255
    ff = m.copy()
    fill = np.zeros((H + 2, W + 2), np.uint8)
    for x in (0, W - 1):  # 위 두 구석에서 배경을 채우면 남는 곳 = 사람 안쪽 구멍
        if ff[top, x] == 0:
            cv2.floodFill(ff, fill, (x, top), 255)
    m = m | cv2.bitwise_not(ff)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    return cv2.erode(m, np.ones((3, 3), np.uint8))


def soften(m: np.ndarray) -> np.ndarray:
    return cv2.GaussianBlur(m, (0, 0), 1.6)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    check = "--check" in sys.argv
    if not args:
        sys.exit("사용법: npm run matte -- <이름> [--check]")
    proj = Path(args[0])
    src = proj / "edit.mp4" if (proj / "edit.mp4").exists() else proj / "input.mp4"
    if not src.exists():
        sys.exit(f"{src} 가 없습니다. 먼저 npm run new / npm run edit")
    vj = json.loads((proj / "video.json").read_text(encoding="utf-8"))
    info = run_json(["ffprobe", "-v", "error", "-print_format", "json", "-show_streams", "-show_format", str(src)])
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    W, H = int(v["width"]), int(v["height"])
    dur = float(info["format"]["duration"])
    num, den = v["avg_frame_rate"].split("/")
    fps = float(num) / float(den or 1)
    inset = vj.get("inset") or {}
    top = int(round((inset.get("top") or 0) * H)) + 4
    left = int(round((inset.get("left") or 0) * W)) + 4
    right = W - int(round((inset.get("right") or 0) * W)) - 4

    # 1) 배경색: 띠 안쪽 위 구석 (사람이 없는 곳)
    times = [dur * f for f in np.linspace(0.05, 0.95, 16)]
    frames = [grab(src, t, W, H) for t in times]
    ys = slice(top, top + max(20, H // 14))
    xl = slice(left, left + max(40, W // 8))
    xr = slice(right - max(40, W // 8), right)
    samp = np.concatenate([cv2.cvtColor(np.ascontiguousarray(f[ys, x]), cv2.COLOR_BGR2LAB).reshape(-1, 3) for f in frames for x in (xl, xr)]).astype(np.float32)
    bg = np.median(samp, 0)
    noise = np.percentile(np.sqrt((((samp - bg) * [0.6, 1, 1]) ** 2).sum(1)), 99)
    if noise > THRESH * 0.6:
        sys.exit(f"❌ 배경이 단색이 아닙니다 (잡음 {noise:.1f}) — 이 영상은 배경 지우기를 쓸 수 없어요. 원래 화면(배경 그대로)으로 둡니다")

    # 2) 사람이 차지하는 범위 (모든 표본의 합) → 잘라 낼 영역. 바닥까지, 위·옆 여유
    masks = [person_mask(f, bg, top) for f in frames]
    share = [m.mean() / 255 for m in masks]
    if min(share) < 0.10 or max(share) > 0.70:
        sys.exit(f"❌ 사람을 제대로 못 찾았습니다 (화면의 {min(share):.0%}~{max(share):.0%}) — 배경이 사람 색과 비슷한가요? 원래 화면(배경 그대로)으로 둡니다")
    union = np.max(masks, 0)
    yy, xx = np.nonzero(union)
    pad = int(W * 0.03)
    cx0, cx1 = max(0, xx.min() - pad), min(W, xx.max() + pad)
    cy0 = max(0, yy.min() - pad)
    cw, ch = (cx1 - cx0) // 2 * 2, (H - cy0) // 2 * 2
    cy0 = H - ch
    crop = {"x": int(cx0), "y": int(cy0), "w": int(cw), "h": int(ch)}
    print(f"배경색 Lab {bg.round(1).tolist()} (잡음 {noise:.1f}) · 사람 {min(share):.0%}~{max(share):.0%} · 잘라 낼 영역 {cw}×{ch} @({cx0},{cy0})")
    ctop = max(0, top - cy0)

    if check:
        tiles = []
        for f in frames[2::6][:3]:
            c = f[cy0:cy0 + ch, cx0:cx0 + cw]
            a = soften(person_mask(c, bg, ctop))[..., None] / 255.0
            cream = np.zeros_like(c)
            cream[:] = (214, 234, 243)
            cream[::40] = (60, 60, 200)  # 줄무늬: 남은 배경·구멍이 잘 보이게
            tiles.append((c * a + cream * (1 - a)).astype(np.uint8))
        out = proj / "frames" / "matte_check.png"
        out.parent.mkdir(exist_ok=True)
        cv2.imwrite(str(out), np.hstack(tiles))
        print(f"확인용: {out}")
        return

    # 3) 전체: 잘라 낸 프레임을 읽어 알파를 붙여 VP9(투명) + 소리로
    out = proj / "avatar.webm"
    dec = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-i", str(src), "-vf", f"crop={cw}:{ch}:{cx0}:{cy0}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                           stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgra", "-s", f"{cw}x{ch}", "-r", f"{fps:.6f}", "-i", "-",
                            "-i", str(src), "-map", "0:v", "-map", "1:a?", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "0", "-crf", "28",
                            "-deadline", "realtime", "-cpu-used", "8", "-row-mt", "1", "-auto-alt-ref", "0", "-c:a", "libopus", "-b:a", "128k", str(out)],
                           stdin=subprocess.PIPE)
    size = cw * ch * 3
    total = int(dur * fps)
    prev = None
    n = 0
    while True:
        buf = dec.stdout.read(size)
        if len(buf) < size:
            break
        img = np.frombuffer(buf, np.uint8).reshape(ch, cw, 3)
        a = soften(person_mask(img, bg, ctop)).astype(np.float32)
        if prev is not None:
            a = a * (1 - EMA) + prev * EMA
        prev = a
        enc.stdin.write(np.dstack([img, a.astype(np.uint8)]).tobytes())
        n += 1
        if n % 600 == 0:
            print(f"  {n}/{total} 프레임", flush=True)
    enc.stdin.close()
    dec.wait()
    if enc.wait() != 0:
        sys.exit("❌ 투명 영상 인코딩 실패 (ffmpeg libvpx-vp9 확인 → npm run doctor)")
    (proj / "matte.json").write_text(json.dumps({"file": out.name, "source": src.name, "crop": crop, "width": W, "height": H, "frames": n}, indent=2), encoding="utf-8")
    print(f"✅ {out} ({n} 프레임) — render 가 아바타를 이 영상으로 그립니다. 원래대로 돌리려면 matte.json 을 지우세요")


if __name__ == "__main__":
    main()
