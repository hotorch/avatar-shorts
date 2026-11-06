#!/usr/bin/env python3
"""폰트 파일 하나를 재서 JSON 으로 알려 준다 (npm run fonts -- add 가 쓴다).

영상에서 실제로 문제가 된 것만 본다: 한글 글자 수, 띄어쓰기 글자, 숫자, 글자 폭, 대문자 높이, 굵기.
"""
import json
import sys

try:
    from fontTools.ttLib import TTFont
except ImportError:
    print("❌ fonttools 가 없습니다 → npm run setup", file=sys.stderr)
    sys.exit(2)

SAMPLE = "가나다라마바사아자차카타파하한글영상자막말"


def measure(path):
    font = TTFont(path, fontNumber=0)
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    hmtx = font["hmtx"]
    os2 = font["OS/2"]
    adv = [hmtx[cmap[ord(c)]][0] / upm for c in SAMPLE if ord(c) in cmap]
    weight = str(os2.usWeightClass)
    if "fvar" in font:
        axis = next((a for a in font["fvar"].axes if a.axisTag == "wght"), None)
        if axis:
            weight = f"{int(axis.minValue)} {int(axis.maxValue)}"
    return {
        "hangul": sum(1 for u in cmap if 0xAC00 <= u <= 0xD7A3),
        "latin": sum(1 for u in cmap if 0x41 <= u <= 0x5A or 0x61 <= u <= 0x7A),
        "space": 0x20 in cmap,
        "digits": all(ord(d) in cmap for d in "0123456789"),
        "advance": round(sum(adv) / len(adv), 3) if adv else None,
        "cap": round(getattr(os2, "sCapHeight", 0) / upm, 3),
        "weight": weight,
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("사용법: npm run fonts -- add <폰트 파일>", file=sys.stderr)
        sys.exit(1)
    try:
        print(json.dumps(measure(sys.argv[1])))
    except Exception as e:  # 깨진 파일·지원하지 않는 형식
        print(f"❌ 폰트 파일을 읽지 못했습니다: {e}", file=sys.stderr)
        sys.exit(1)
