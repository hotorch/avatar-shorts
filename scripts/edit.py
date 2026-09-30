#!/usr/bin/env python3
"""말 편집: 무음·군더더기 제거 + (선택) 순서 재배치 → edit.mp4 와 새 타임라인의 자막

  npm run edit -- <이름> --list     자막 번호 목록 (edit.json 쓸 때 참고)
  npm run edit -- <이름>            편집 실행

입력:  input.mp4, words.json, captions.json (align.py 결과, 원본 시간)
       style (정책+취향: edit.silence / fillers / punchIn), 선택: edit.json
출력:  edit.mp4, words.edit.json, captions.edit.json, cuts.json
       → render.mjs 는 이 파일들이 있으면 자동으로 편집본을 쓴다. plan.json 의 시간도 편집본 기준.

edit.json (없으면 원래 순서 그대로, 무음만 줄인다)
  {"order": [[18, 19], [1, 17], [20, 23]],   # 자막 번호(1부터) 구간을 이 순서로. 빠진 번호는 잘린다.
   "why": "훅: '편집 프로그램은 한 번도 안 켰습니다' 를 맨 앞으로"}
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

SILENCE = {  # 취향 → 남겨 둘 무음 길이(초). 정책 maxSilenceKept 를 넘지 못한다.
    "tight": 0.16,
    "natural": 0.30,
    "off": None,  # 정책 한계까지만
}
NOISE_DB = -35  # 이보다 조용하면 무음
MIN_SILENCE = 0.10


def run_style(slug):
    r = subprocess.run(["node", "scripts/style.mjs", slug], capture_output=True, encoding="utf-8", errors="replace", check=True)
    return json.loads(r.stdout)


def probe(src):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=r_frame_rate:format=duration", "-of", "json", str(src)],
        capture_output=True, encoding="utf-8", errors="replace", check=True,
    ).stdout
    d = json.loads(out)
    n, m = d["streams"][0]["r_frame_rate"].split("/")
    return float(n) / float(m), float(d["format"]["duration"])


def silences(src, dur):
    r = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-vn", "-af", f"silencedetect=noise={NOISE_DB}dB:d={MIN_SILENCE}", "-f", "null", "-"],
        capture_output=True, encoding="utf-8", errors="replace",
    ).stderr
    out, a = [], None
    for line in r.splitlines():
        m = re.search(r"silence_start: ([\d.]+)", line)
        if m:
            a = float(m.group(1))
        m = re.search(r"silence_end: ([\d.]+)", line)
        if m and a is not None:
            out.append((a, float(m.group(1))))
            a = None
    if a is not None:
        out.append((a, dur))
    return out


def subtract(span, cuts):
    """span(a,b) 에서 cuts 구간들을 뺀 나머지"""
    a, b = span
    keep, cur = [], a
    for c0, c1 in sorted(cuts):
        if c1 <= cur or c0 >= b:
            continue
        if c0 > cur:
            keep.append((cur, c0))
        cur = max(cur, c1)
    if cur < b:
        keep.append((cur, b))
    return keep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    proj = Path(a.project)
    words = json.loads((proj / "words.json").read_text(encoding="utf-8"))
    cues = json.loads((proj / "captions.json").read_text(encoding="utf-8"))

    if a.list:
        for i, c in enumerate(cues, 1):
            print(f"{i:3d} [{c['start']:6.2f}–{c['end']:6.2f}] {c['text']}")
        return

    st = run_style(proj.name)
    pol = st["policy"].get("edit", {})
    taste = st["taste"].get("edit", {})
    src = proj / "input.mp4"
    fps, dur = probe(src)

    max_keep = pol.get("maxSilenceKept", 0.45)
    keep_gap = SILENCE.get(taste.get("silence", "natural"), 0.30) or max_keep
    keep_gap = min(keep_gap, max_keep)
    pad = max(pol.get("minPad", 0.04), keep_gap / 2)
    fillers = set(pol.get("fillers", [])) if taste.get("fillers", True) else set()

    # 1) 잘라낼 곳: 길게 남은 무음 + 군더더기 단어
    sil = silences(src, dur)
    cut_regions = [(s0 + pad, s1 - pad) for s0, s1 in sil if s1 - s0 > keep_gap]

    def boundary(x_end, y_start):
        """앞 문장 끝과 다음 문장 시작 사이 경계: 그 사이 무음의 한가운데 (없으면 단어 경계의 가운데)"""
        near = [(max(s0, x_end - 0.25), min(s1, y_start + 0.25)) for s0, s1 in sil if s1 > x_end - 0.25 and s0 < y_start + 0.25]
        near = [(p, q) for p, q in near if q > p]
        if near:
            p, q = max(near, key=lambda r: r[1] - r[0])
            return (p + q) / 2
        return (x_end + y_start) / 2
    strip = lambda t: re.sub(r"[.,!?…~]+$", "", t)
    filler_words = [w for w in words if strip(w["text"]) in fillers or w["text"] in fillers]
    cut_regions += [(w["start"], w["end"]) for w in filler_words]

    # 2) 순서: edit.json 의 자막 번호 구간, 없으면 전체 한 덩어리
    ej = json.loads((proj / "edit.json").read_text(encoding="utf-8")) if (proj / "edit.json").exists() else {}
    order = ej.get("order") or [[1, len(cues)]]
    # 손으로 자를 곳 (원본 초): 인식 안 된 "음", 말실수, 기침 등. 안에 든 단어는 자막에서도 빠진다
    cut_regions += [(float(a), float(b)) for a, b in ej.get("cut", []) if b > a]
    groups = []
    for g in order:
        c0, c1 = g[0] - 1, g[-1] - 1
        if not (0 <= c0 <= c1 < len(cues)):
            sys.exit(f"edit.json: 자막 번호 {g} 가 범위(1–{len(cues)}) 밖입니다")
        ws = [w for w in words if c0 <= w["cue"] <= c1]
        if not ws:
            continue
        prev = max((w["end"] for w in words if w["cue"] < c0), default=None)
        nxt = min((w["start"] for w in words if w["cue"] > c1), default=None)
        # 이웃 덩어리와 같은 경계 함수를 쓰므로 원본에서 겹치는 조각이 생기지 않는다
        a0 = 0.0 if prev is None else boundary(prev, ws[0]["start"])
        b0 = dur if nxt is None else boundary(ws[-1]["end"], nxt)
        groups.append({"cues": list(range(c0, c1 + 1)), "span": (a0, b0)})

    # 3) 구간 → 프레임 격자에 맞춘 조각들
    q = lambda t, up=False: (int(-(-t * fps // 1)) if up else int(t * fps)) / fps
    segs = []
    for gi, g in enumerate(groups):
        for s, e in subtract(g["span"], cut_regions):
            s, e = q(s), q(e, up=True)
            if e - s < 0.12:  # 말 없는 자투리
                continue
            if segs and segs[-1]["group"] == gi and s <= segs[-1]["src"][1] + 1e-6:
                segs[-1]["src"][1] = max(segs[-1]["src"][1], e)
            else:
                segs.append({"src": [s, e], "group": gi})
    t = 0.0
    for sg in segs:
        sg["out"] = [round(t, 4), round(t + sg["src"][1] - sg["src"][0], 4)]
        t = sg["out"][1]
    total = t

    def map_t(x, gi, side):
        """원본 시각 x → 편집본 시각. 잘린 곳이면 가까운 조각 경계로."""
        best = None
        for sg in segs:
            if sg["group"] != gi:
                continue
            s, e = sg["src"]
            if s <= x <= e:
                return sg["out"][0] + x - s
            if side == "start" and x < s and best is None:
                best = sg["out"][0]
            if side == "end" and x > e:
                best = sg["out"][1]
        return best

    # 4) 단어·자막 옮기기
    fset = {id(w) for w in filler_words}
    new_words, new_cues = [], []
    for gi, g in enumerate(groups):
        for ci in g["cues"]:
            c = cues[ci]
            cw = [w for w in words if w["cue"] == ci and id(w) not in fset]
            mapped = []
            for w in cw:
                s, e = map_t(w["start"], gi, "start"), map_t(w["end"], gi, "end")
                if s is None or e is None or e <= s:
                    continue
                mapped.append({"text": w["text"], "start": round(s, 3), "end": round(e, 3), "cue": len(new_cues)})
            if not mapped:
                continue
            nc = dict(c)
            nc["start"] = mapped[0]["start"]
            nc["end"] = round(mapped[-1]["end"] + 0.3, 3)
            nc["src"] = ci + 1
            if len(mapped) != len([w for w in words if w["cue"] == ci]):  # 군더더기를 뺐으면 글자도 뺀다
                nc["text"] = " ".join(w["text"] for w in mapped)
                nc["emph"] = [e for e in c.get("emph", []) if e["text"] in nc["text"]] or None
                if nc["emph"] is None:
                    nc.pop("emph")
            new_words += mapped
            new_cues.append(nc)
    for i, c in enumerate(new_cues):  # 다음 자막이 시작하면 끝, 영상 끝을 넘지 않게
        nxt = new_cues[i + 1]["start"] if i + 1 < len(new_cues) else total
        c["end"] = round(min(max(c["end"], nxt) if nxt - c["end"] < 0.6 else c["end"], nxt, total), 3)

    # 5) 컷마다 줌 (펀치인): 1.00 ↔ 1.08 을 번갈아. 1.5초 안에 두 번 바꾸지 않는다.
    punch = []
    if taste.get("punchIn", False):
        scale, last = 1.0, -9.0
        for i, sg in enumerate(segs[1:], 1):
            jumped = sg["group"] != segs[i - 1]["group"] or sg["src"][0] - segs[i - 1]["src"][1] > 0.2
            if jumped and sg["out"][0] - last >= 1.5:
                scale = 1.08 if scale == 1.0 else 1.0
                punch.append({"t": sg["out"][0], "scale": scale})
                last = sg["out"][0]

    # 6) 영상 자르기 (재인코딩, 경계마다 8ms 페이드로 '틱' 소리 방지)
    fade = pol.get("fadeMs", 8) / 1000
    parts, labels = [], []
    for i, sg in enumerate(segs):
        s, e = sg["src"]
        d = e - s
        parts.append(f"[0:v]trim=start={s:.4f}:end={e:.4f},setpts=PTS-STARTPTS[v{i}]")
        parts.append(
            f"[0:a]atrim=start={s:.4f}:end={e:.4f},asetpts=PTS-STARTPTS,"
            f"afade=t=in:d={fade}:curve=tri,afade=t=out:st={max(0, d - fade):.4f}:d={fade}:curve=tri[a{i}]"
        )
        labels.append(f"[v{i}][a{i}]")
    graph = ";".join(parts) + f";{''.join(labels)}concat=n={len(segs)}:v=1:a=1[v][a]"
    subprocess.run(
        ["ffmpeg", "-loglevel", "error", "-y", "-i", str(src), "-filter_complex", graph, "-map", "[v]", "-map", "[a]",
         "-r", f"{fps}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(proj / "edit.mp4")],
        check=True,
    )

    (proj / "words.edit.json").write_text(json.dumps(new_words, ensure_ascii=False, indent=1), encoding="utf-8")
    (proj / "captions.edit.json").write_text(json.dumps(new_cues, ensure_ascii=False, indent=1), encoding="utf-8")
    (proj / "cuts.json").write_text(json.dumps(
        {"fps": fps, "duration": round(total, 3), "sourceDuration": round(dur, 3), "silence": taste.get("silence"), "keptGap": keep_gap,
         "order": order, "cut": ej.get("cut", []), "why": ej.get("why"), "segments": [{"src": s["src"], "out": s["out"]} for s in segs], "punch": punch},
        ensure_ascii=False, indent=1), encoding="utf-8")

    removed = dur - total
    print(f"편집: {dur:.1f}초 → {total:.1f}초 (−{removed:.1f}초, 조각 {len(segs)}개, 펀치인 {len(punch)}번)")
    if filler_words:
        print("뺀 군더더기:", ", ".join(f"{w['text']}@{w['start']:.1f}s" for w in filler_words))
    if order != [[1, len(cues)]]:
        dropped = sorted(set(range(1, len(cues) + 1)) - {c + 1 for g in groups for c in g["cues"]})
        print("순서:", " → ".join(f"{g[0]}–{g[-1]}" for g in order), "| 뺀 자막:", dropped or "없음")
    for c in new_cues:
        print(f"  [{c['start']:6.2f}] {c['text']}")


if __name__ == "__main__":
    main()
