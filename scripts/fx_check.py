#!/usr/bin/env python3
"""text-behind 효과: 머리 뒤 글자가 모든 프레임에서 글자마다 70 % 이상 보이는지 잰다 (정책 presenterFx.textBehindMinVisible).
배치(effects.tsx textBehindLayout)는 이미 '최악 프레임에서 머리가 글자 높이의 20 % 까지만'으로 놓지만, 실제 글자 모양으로 한 번 더 잰다.

    python fx_check.py <word.png> <matte 폴더> [--min 0.7] [--max-y 0.75]     (npm run fx 가 알아서 부른다)

word.png: TextBehind probe="word" 스틸 (검정 위 흰 글자, 다 솟은 자리)
matte 폴더: TextBehind probe="matte" 스틸들 (발표자 오려내기를 흰색으로, 장면과 같은 자리). 프레임 수는 상관없음
글자 = word.png 의 연결된 덩어리(왼쪽부터). 아래쪽 자막 띠는 --max-y(화면 높이 비율) 아래라 뺀다. 실패가 있으면 종료 코드 1.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
import numpy as np


def letters(mask, max_y):
    n, lab, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), connectivity=8)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < 50 or y + h > max_y:
            continue
        out.append((x, lab == i))
    return [m for _, m in sorted(out, key=lambda b: b[0])]


def gray(p):
    img = cv2.imdecode(np.fromfile(str(p), np.uint8), cv2.IMREAD_GRAYSCALE)  # 한글 경로도 읽게
    if img is None:
        raise SystemExit(f"❌ {p} 를 못 읽습니다")
    return img


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("word")
    ap.add_argument("mattes")
    ap.add_argument("--min", type=float, default=0.7)
    ap.add_argument("--max-y", type=float, default=0.75)
    a = ap.parse_args()
    word = gray(a.word) > 128
    ls = letters(word, a.max_y * word.shape[0])
    if not ls:
        raise SystemExit("❌ 글자를 못 찾았습니다 (probe=word 스틸이 비었음)")
    stills = sorted(Path(a.mattes).glob("*.png"))
    if not stills:
        raise SystemExit(f"❌ {a.mattes} 에 matte 스틸이 없습니다")
    worst = [(1.0, "-")] * len(ls)
    for p in stills:
        matte = gray(p) > 128
        for i, m in enumerate(ls):
            vis = 1 - (m & matte).sum() / m.sum()
            if vis < worst[i][0]:
                worst[i] = (vis, p.name)
    ok = True
    for i, (vis, name) in enumerate(worst):
        good = vis >= a.min
        ok &= good
        print(f"  {'✅' if good else '❌'} 글자 {i + 1}: 가장 많이 가려진 프레임에서 {vis:.0%} 보임 ({name})")
    print(f"  {len(stills)}프레임 · 글자 {len(ls)}개 · 기준 {a.min:.0%}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
