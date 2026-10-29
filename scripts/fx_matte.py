#!/usr/bin/env python3
"""발표자 효과(fx) 장면 하나의 사람 오려내기 + 프레임마다 머리·어깨 위치. 그래픽을 발표자 '뒤'에 그리려고 쓴다.

    npm run fx -- <이름>      (scripts/fx.mjs 가 fx 장면마다 이 스크립트를 부른다)
    python fx_matte.py --clip <영상> --from <초> --to <초> --out <폴더/이름> [--debug-frames 0,30]

결과 (out 이 projects/<이름>/fx/<장면 id> 이면):
  <장면 id>.cutout.webm  VP9 알파(yuva420p) — 사람(손에 든 것 포함)만, 나머지는 투명
  <장면 id>.track.json   summary {t0, fps, width, height, frames, src, from, to} + 프레임마다
                         face(얼굴 상자) · chin · head_top(정수리, 오려내기에서) · shoulder_l/r(몸이 화면 옆을 벗어나는 줄) · motion
  <장면 id>.debug-<f>.png  초록 바탕 위 오려내기 + 선 (--debug-frames 일 때만)

오려내기: rembg u2net (CPU, 1080×1920 한 장 ≈ 0.25초). 처음 한 번 모델(≈170MB)을 ~/.u2net 에 받는다.
  u2net 은 벌린 입을 배경으로 읽어서, 화면의 HOLE_MAX_FRAC 보다 작은 구멍은 메운다. 가장자리 깜빡임은 3프레임 중앙값.
얼굴: YuNet (models/yunet, face.py 와 같은 모델), 가장 큰 얼굴, 지난 상자와 섞어(EMA) 떨림을 줄이고 놓친 프레임은 이어 쓴다.
어깨: 셀피 구도에서 '얼굴 아래 + 0.55×얼굴 높이' 같은 미디엄 샷 공식은 가슴에 떨어진다 → 오려내기에서 몸이 옆 끝을 채우는 첫 줄을 잰다.
"""
from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass

MAX_W = 1080           # 오려내기 폭 상한 (4K 원본도 이 폭으로)
HOLE_MAX_FRAC = 0.006  # 1080×1920 에서 1.2만 px: 벌린 입 ≈ 3~6천 px
FACE_EMA = 0.6         # 지난 상자 비중
EDGE_FRAC = 0.022      # 어깨가 채우는 옆 띠 (1080 폭에서 24px)
SCAN_W = 360           # 얼굴 인식용 축소 폭 (face.py 와 같음)
CHIN = 0.04            # 얼굴 상자 아래 턱 여유 (face.py 와 같음)
MODEL = Path(__file__).resolve().parent.parent / "models" / "yunet" / "face_detection_yunet_2023mar.onnx"


def probe(clip):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                          "stream=width,height,r_frame_rate", "-of", "json", str(clip)],
                         capture_output=True, encoding="utf-8", check=True)
    s = json.loads(out.stdout)["streams"][0]
    num, den = s["r_frame_rate"].split("/")
    return int(s["width"]), int(s["height"]), float(num) / float(den)


def frames(clip, t0, dur, w, h):
    """t0 부터 dur 초 동안의 프레임 (w×h rgb). -ss 를 -i 앞에 두면 다시 인코딩할 때 프레임 정확히 자른다"""
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{t0:.6f}", "-i", str(clip), "-t", f"{dur:.6f}",
                          "-vf", f"scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        buf = p.stdout.read(n)
        if len(buf) < n:
            break
        yield np.frombuffer(buf, np.uint8).reshape(h, w, 3)
    p.wait()


def fill_small_holes(mask):
    solid = (mask > 127).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(1 - solid, connectivity=4)
    h, w = mask.shape
    limit = HOLE_MAX_FRAC * h * w
    out = mask.copy()
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        touches_edge = x == 0 or y == 0 or x + bw >= w or y + bh >= h
        if not touches_edge and area < limit:
            out[lab == i] = 255
    return out


def matte(clip, t_from, t_to, out, debug=()):
    from rembg import new_session, remove  # 여기서 import: --help 와 fx.mjs 의 검사는 모델이 필요 없다
    from PIL import Image

    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sw, sh, fps = probe(clip)
    w = min(MAX_W, sw)
    h = round(sh * w / sw / 2) * 2
    k0 = math.ceil(t_from * fps - 1e-6)  # 첫 프레임 번호 → 그 시각이 t0
    t0 = k0 / fps
    dur = max(1 / fps, t_to - t0)
    edge = max(8, round(EDGE_FRAC * w))
    session = new_session("u2net")
    scan_h = round(h * SCAN_W / w / 2) * 2
    det = cv2.FaceDetectorYN.create(str(MODEL), "", (SCAN_W, scan_h), 0.6, 0.3, 5)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{w}x{h}",
                            "-r", f"{fps:g}", "-i", "-", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                            "-b:v", "0", "-crf", "20", "-row-mt", "1", "-auto-alt-ref", "0",
                            str(out.parent / f"{out.name}.cutout.webm")], stdin=subprocess.PIPE)
    track, box, prev_solid = [], None, None
    sx = w / SCAN_W

    def emit(idx, rgb, mask):
        nonlocal box, prev_solid
        small = cv2.cvtColor(cv2.resize(rgb, (SCAN_W, scan_h)), cv2.COLOR_RGB2BGR)
        _, faces = det.detect(small)
        face = None
        if faces is not None and len(faces):
            face = np.array(max(faces, key=lambda f: f[2] * f[3])[:4], np.float64) * sx
            box = face if box is None else FACE_EMA * box + (1 - FACE_EMA) * face
        fx, fy, fw, fh = (box if box is not None else np.array([w * 0.3, h * 0.2, w * 0.4, w * 0.4])).tolist()
        solid = mask > 127
        cols = solid[:, max(0, int(fx)):int(fx + fw)]
        rows_any = np.where(cols.any(axis=1))[0] if cols.size else []
        head_top = int(rows_any[0]) if len(rows_any) else int(fy)

        def exit_row(band):
            r = np.where(band.mean(axis=1) > 0.5)[0]
            return int(r[0]) if len(r) else h
        # 얼굴 밖 움직임: 손을 들거나 몸을 기울이면 커지고, 말만 하면 작다
        motion = 0.0
        if prev_solid is not None:
            diff = solid ^ prev_solid
            diff[max(0, int(fy)):int(fy + fh * 1.2), max(0, int(fx)):int(fx + fw)] = False
            motion = float(diff.mean())
        prev_solid = solid
        track.append({"f": idx, "face": [round(v, 1) for v in (fx, fy, fw, fh)], "face_missed": face is None,
                      "chin": round(fy + fh * (1 + CHIN), 1), "head_top": head_top,
                      "shoulder_l": exit_row(solid[:, :edge]), "shoulder_r": exit_row(solid[:, -edge:]),
                      "motion": round(motion, 5)})
        enc.stdin.write(np.dstack([rgb, mask]).tobytes())
        if idx in debug:
            comp = rgb.astype(np.float32) * (mask[..., None] / 255.0)
            comp[..., 1] += (255 - mask) * 0.8
            dbg = np.clip(comp, 0, 255).astype(np.uint8).copy()
            cv2.rectangle(dbg, (int(fx), int(fy)), (int(fx + fw), int(fy + fh)), (255, 0, 0), 4)
            cv2.line(dbg, (0, int(fy + fh * (1 + CHIN))), (w, int(fy + fh * (1 + CHIN))), (0, 0, 255), 3)
            cv2.line(dbg, (0, head_top), (w, head_top), (255, 255, 0), 3)
            Image.fromarray(dbg).save(str(out.parent / f"{out.name}.debug-{idx}.png"))

    # 3프레임 중앙값: i 번째는 i+1 번째를 오려낸 뒤 내보낸다
    idx, prev_m, cur = 0, None, None
    for rgb in frames(clip, t0, dur, w, h):
        m = fill_small_holes(np.array(remove(Image.fromarray(rgb), session=session, only_mask=True)))
        if cur is None:
            prev_m, cur = m, (rgb, m)
            continue
        emit(idx, cur[0], np.median(np.stack([prev_m, cur[1], m]), axis=0).astype(np.uint8))
        idx += 1
        prev_m, cur = cur[1], (rgb, m)
        if idx % 30 == 0:
            print(f"  {out.name}: {idx}프레임", flush=True)
    if cur is None:
        raise SystemExit(f"❌ {clip} 의 {t_from:.2f}~{t_to:.2f}초에 프레임이 없습니다")
    emit(idx, cur[0], cur[1])
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit(f"❌ ffmpeg 가 {out.name}.cutout.webm 을 못 썼습니다 (libvpx-vp9 가 있는 ffmpeg 필요 → npm run doctor)")

    summary = {"frames": len(track), "fps": fps, "width": w, "height": h, "t0": round(t0, 6),
               "src": Path(clip).name, "from": t_from, "to": t_to,
               "face_miss_rate": round(sum(t["face_missed"] for t in track) / len(track), 3)}
    (out.parent / f"{out.name}.track.json").write_text(json.dumps({"summary": summary, "frames": track}, ensure_ascii=False), encoding="utf-8")
    print(f"  {out.name}: {len(track)}프레임 · 얼굴 놓침 {summary['face_miss_rate']:.0%}", flush=True)
    return summary


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clip", required=True)
    ap.add_argument("--from", dest="t_from", type=float, required=True)
    ap.add_argument("--to", dest="t_to", type=float, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--debug-frames", default="")
    a = ap.parse_args()
    try:
        import rembg  # noqa: F401
    except ImportError:
        sys.exit("❌ 사람 오려내기(rembg)가 없습니다 → npm run setup")
    matte(a.clip, a.t_from, a.t_to, a.out, {int(x) for x in a.debug_frames.split(",") if x.strip()})


if __name__ == "__main__":
    main()
