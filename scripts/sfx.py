#!/usr/bin/env python3
"""효과음 11종을 코드로 합성해서 public/sfx/*.wav 로 저장합니다.

파일을 내려받지 않고, 같은 seed 면 항상 같은 소리가 나옵니다. (numpy 만 필요)
    npm run sfx
"""
from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np

SR = 48000
OUT = Path(__file__).resolve().parent.parent / "public" / "sfx"


def n_(ms: float) -> int:
    return int(round(ms * SR / 1000))


def unit(x):
    m = float(np.max(np.abs(x)))
    return x / m if m > 0 else x


def band(x, lo=None, hi=None):
    """FFT 도메인에서 부드러운 경사로 거르는 밴드패스 (lo/hi 가 None 이면 그쪽은 열림)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    g = np.ones_like(f)
    if lo:
        g *= 1 / (1 + (lo / np.maximum(f, 1)) ** 8)
    if hi:
        g *= 1 / (1 + (f / hi) ** 8)
    return np.fft.irfft(X * g, len(x))


def rc(u):
    return 0.5 - 0.5 * np.cos(np.pi * np.clip(u, 0, 1))


def env(n, attack_ms, tau_ms, at=0):
    t = (np.arange(n) - at) / SR
    a = max(attack_ms, 1e-6) / 1000
    body = rc(t / a) * np.exp(-np.clip(t - a, 0, None) / (tau_ms / 1000))
    return np.where(t >= 0, body, 0.0)


def swell(n, peak, rise=1.0, fall=1.5):
    u = np.arange(n) / max(n - 1, 1)
    up = rc(u / peak) ** rise
    down = (1 - rc((u - peak) / (1 - peak))) ** fall
    return np.where(u <= peak, up, down)


def glide(n, f0, f1, tau_ms):
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / (tau_ms / 1000))
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def bell(n, at, f0, ratios, amps, taus, rng):
    t = (np.arange(n) - at) / SR
    tp = np.clip(t, 0, None)
    y = np.zeros(n)
    for r, a, tau in zip(ratios, amps, taus):
        y += a * np.sin(2 * np.pi * f0 * r * t + rng.uniform(0, 6.28)) * np.exp(-tp / (tau / 1000))
    y *= 1 - np.exp(-tp / 0.0004)
    return np.where(t >= 0, y, 0.0)


def sweep_noise(rng, n, points, width_oct=0.5):
    """중심 주파수가 시간에 따라 움직이는 노이즈 (휙 소리의 핵심)."""
    hop, win = 256, 1024
    x = rng.standard_normal(n + win)
    out = np.zeros(n + win)
    w = np.hanning(win)
    f = np.fft.rfftfreq(win, 1 / SR)
    lf = np.log2(np.maximum(f, 1))
    for s in range(0, n, hop):
        u = s / n
        fc = 2 ** np.interp(u, [p[0] for p in points], [math.log2(p[1]) for p in points])
        g = np.exp(-0.5 * ((lf - math.log2(fc)) / width_oct) ** 2)
        seg = np.fft.irfft(np.fft.rfft(x[s:s + win] * w) * g, win)
        out[s:s + win] += seg * w
    return out[:n]


# ---------------------------------------------------------------- 레시피 10종
def whoosh(rng, ms=260, pts=((0, 3200), (0.42, 6200), (1, 4000))):
    n = n_(ms)
    return unit(sweep_noise(rng, n, pts, 0.6)) * swell(n, 0.42)


def pop(rng, f0=2050, ms=80):
    n = n_(ms)
    t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f0 * (2 - np.exp(-t / 0.006))) / SR
    tone = (np.sin(ph) + 0.3 * np.sin(2 * ph)) * env(n, 0.3, 13)
    click = unit(band(rng.standard_normal(n), lo=3000)) * env(n, 0.05, 1)
    return 0.8 * tone + 0.5 * click


def click(rng, ms=90):
    n = n_(ms)
    exc = unit(band(rng.standard_normal(n), lo=1000)) * env(n, 0.05, 0.8)
    return bell(n, 0, 1.0, (3150, 4870, 7230), (1, 0.6, 0.35), (12, 8, 5), rng) + 0.6 * exc


def tick(rng, ms=50):
    n = n_(ms)
    return unit(band(rng.standard_normal(n), lo=2500, hi=9000)) * env(n, 0.05, 2.5)


def thud(rng, ms=220):
    n = n_(ms)
    body = glide(n, 170, 90, 15) * env(n, 0.8, 26)
    low = unit(band(rng.standard_normal(n), hi=320)) * env(n, 0.6, 18)
    slap = unit(band(rng.standard_normal(n), 900, 4500)) * env(n, 0.15, 10)
    return np.tanh(1.4 * (0.6 * body + 0.35 * low + 0.7 * slap))


def paper(rng, ms=320):
    """종이·카드가 미끄러져 들어오는 소리."""
    n = n_(ms)
    y = unit(band(rng.standard_normal(n), 250, 2600))
    u = np.arange(n) / SR * 1000
    rel = 0.55 * ms
    return y * rc(u / 20) * (1 - rc((u - rel) / (ms - rel)))


def sparkle(rng, count=5, span=180, ms=380):
    n = n_(ms)
    penta = (2637, 2960, 3520, 3951, 4435, 5274, 5920)
    idx = np.sort(rng.choice(len(penta), count, replace=False))
    x = np.zeros(n)
    for k, i in enumerate(idx):
        t0 = k * span / (count - 1)
        tau = rng.uniform(28, 45)
        x += (1 - 0.07 * k) * bell(n, n_(t0), penta[i], (1, 2.01), (1, 0.25), (tau, tau / 2), rng)
    return x


def coin(rng, ms=380):
    n = n_(ms)
    r = (1.0, 2.76, 5.40)
    a = bell(n, 0, 1318.5, r, (1, 0.4, 0.15), (40, 20, 10), rng)
    b = bell(n, n_(70), 1975.5, r, (1, 0.45, 0.2), (110, 50, 25), rng)
    return 0.7 * a + 0.8 * b


def marker(rng, ms=240):
    """펜으로 밑줄·체크를 긋는 소리."""
    n = n_(ms)
    base = unit(band(rng.standard_normal(n), 700, 5000))
    grain = band(np.abs(rng.standard_normal(n)), hi=70)
    rough = 0.55 + 0.45 * grain / np.max(grain)
    u = np.arange(n) / SR * 1000
    return base * rough * rc(u / 4) * rc((ms - u) / 50)


def air(rng, ms=900):
    """장면이 바뀔 때 깔리는 아주 옅은 공기감."""
    n = n_(ms)
    return unit(sweep_noise(rng, n, ((0, 900), (0.5, 1800), (1, 1200)), 0.9)) * swell(n, 0.5, 1.5, 1.5)


CUES = {
    "whoosh": (whoosh, {}, 1, "패널·오브젝트가 빠르게 들어올 때"),
    "whoosh-soft": (whoosh, {"ms": 420, "pts": ((0, 2400), (0.5, 4200), (1, 2600))}, 2, "느린 전환"),
    "pop": (pop, {}, 3, "아이콘·배지가 톡 튀어나올 때"),
    "click": (click, {}, 4, "커서 클릭, 토글, 버튼"),
    "tick": (tick, {}, 5, "숫자 카운트, 리스트 항목 하나씩"),
    "thud": (thud, {}, 6, "강조어가 쾅 자리 잡을 때"),
    "paper": (paper, {}, 7, "카드·종이 콜라주가 미끄러질 때"),
    "sparkle": (sparkle, {}, 8, "발견, 아하 모먼트"),
    "coin": (coin, {}, 9, "돈·가격·혜택"),
    "marker": (marker, {}, 10, "밑줄, 체크, 취소선"),
    "air": (air, {}, 11, "장면 전환 배경 공기감(아주 작게)"),
}


def finish(x, peak_db=-1.0):
    x = np.asarray(x, dtype=np.float64)
    x -= np.mean(x)
    nf = min(n_(12), len(x) // 4)
    x[-nf:] *= 1 - rc(np.arange(nf) / (nf - 1))
    ni = min(16, len(x) // 8)
    x[:ni] *= rc(np.arange(ni) / (ni - 1))
    x *= 10 ** (peak_db / 20) / np.max(np.abs(x))
    return np.clip(np.round(x * 32767), -32768, 32767).astype(np.int16)


def write_wav(path: Path, q: np.ndarray):
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(q.tobytes())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (fn, kw, seed, use) in CUES.items():
        q = finish(fn(np.random.default_rng(1000 + seed), **kw))
        write_wav(OUT / f"{name}.wav", q)
        print(f"  {name:12s} {len(q) / SR * 1000:5.0f}ms  {use}")
    print(f"효과음 {len(CUES)}개 → {OUT}")


if __name__ == "__main__":
    main()
