#!/usr/bin/env python3
"""얼굴을 따라가며 머리 위치(정수리·턱·좌우)를 잽니다. 분할 화면·머리 위/아래 카드 배치가 이 값을 씁니다.

    npm run face -- <이름>   (npm run new 가 알아서 부른다)

결과: video.json 에
  faceX, faceY   얼굴 중심 (0~1, 전체 중앙값) — 예전처럼 눈대중으로 적지 않는다
  head           {top, chin, left, right} 머리 상자 중앙값 (0~1, 원본 영상 기준)
  track          [[원본 초, top, chin, left, right], …] 초당 FPS 장. 얼굴을 못 찾은 순간은 빠진다
얼굴 인식: OpenCV YuNet (models/yunet, MIT). 얼굴 상자는 눈썹~턱이라 머리카락만큼 위로 늘린다 (HAIR).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

FPS = 4          # 초당 몇 장 볼지
SCAN_W = 360     # 인식용으로 줄인 폭 (빠르고, 얼굴 크기엔 충분)
HAIR = 0.42      # 얼굴 상자(앞머리선~턱) 높이 × 이만큼 위가 정수리. 실측 0.3 + 볼륨 머리 여유
EAR = 0.12       # 좌우로 얼굴 폭 × 이만큼 (귀)
CHIN = 0.04      # 턱 아래 여유
MODEL = Path(__file__).resolve().parent.parent / "models" / "yunet" / "face_detection_yunet_2023mar.onnx"


def median(xs):
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def track(src: Path, w: int, h: int):
    import cv2
    import numpy as np

    sw = SCAN_W if w >= SCAN_W else w
    sh = round(h * sw / w / 2) * 2
    det = cv2.FaceDetectorYN.create(str(MODEL), "", (sw, sh), 0.6, 0.3, 5)
    proc = subprocess.Popen(
        ["ffmpeg", "-loglevel", "error", "-i", str(src), "-vf", f"fps={FPS},scale={sw}:{sh}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
        stdout=subprocess.PIPE,
    )
    size = sw * sh * 3
    rows, i = [], 0
    while True:
        buf = proc.stdout.read(size)
        if len(buf) < size:
            break
        img = np.frombuffer(buf, np.uint8).reshape(sh, sw, 3)
        _, faces = det.detect(img)
        t = round(i / FPS + 0.5 / FPS, 3)  # fps 필터는 구간 가운데 프레임을 준다
        i += 1
        if faces is None or not len(faces):
            continue
        x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])[:4]  # 가장 큰 얼굴 = 화자
        top = (y - HAIR * fh) / sh
        chin = (y + fh * (1 + CHIN)) / sh
        left = (x - EAR * fw) / sw
        right = (x + fw * (1 + EAR)) / sw
        rows.append([t, *(round(float(v), 4) for v in (top, chin, left, right))])
    proc.wait()
    # 튀는 값 누르기: 앞뒤 한 장씩과 중앙값
    smooth = []
    for k, r in enumerate(rows):
        win = rows[max(0, k - 1): k + 2]
        smooth.append([r[0], *(round(median([w_[j] for w_ in win]), 4) for j in range(1, 5))])
    return smooth, i


def main():
    if len(sys.argv) < 2:
        sys.exit("사용법: npm run face -- <이름>")
    proj = Path(sys.argv[1])
    vj = proj / "video.json"
    if not vj.exists():
        sys.exit(f"{vj} 가 없습니다. 먼저 npm run new -- <영상경로>")
    try:
        import cv2  # noqa: F401
    except ImportError:
        sys.exit("OpenCV 가 없습니다 → npm run setup")
    video = json.loads(vj.read_text(encoding="utf-8"))
    src = proj / video.get("file", "input.mp4")
    rows, total = track(src, video["width"], video["height"])
    if not rows:
        print("⚠️  얼굴을 찾지 못했습니다. 분할 화면은 faceY 기준으로 배치합니다 (video.json 의 faceX, faceY 를 직접 적으세요).")
        return
    top, chin, left, right = (median([r[j] for r in rows]) for j in range(1, 5))
    fh = (chin - top) / (1 + HAIR + CHIN)  # 얼굴 상자 높이
    video.update(
        faceX=round((left + right) / 2, 3),
        faceY=round(top + fh * (HAIR + 0.5), 3),
        head={"top": round(top, 4), "chin": round(chin, 4), "left": round(left, 4), "right": round(right, 4)},
        track=rows,
    )
    vj.write_text(json.dumps(video, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"머리 위치: 정수리 {top:.2f} · 턱 {chin:.2f} · 좌우 {left:.2f}~{right:.2f} (화면 비율, 중앙값) · "
        f"얼굴 찾은 장면 {len(rows)}/{total}장"
    )
    if len(rows) < total * 0.6:
        print("⚠️  얼굴을 못 찾은 순간이 많습니다 (옆모습·가림). 그 구간은 전체 중앙값으로 배치합니다.")


if __name__ == "__main__":
    main()
