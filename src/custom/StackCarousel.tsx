import React from 'react';
import {AbsoluteFill, interpolate, interpolateColors} from 'remotion';
import {useExit, useScene, useSpringAt} from '../kit/motion';
import {fitSize} from '../kit/measure';
import {ObjIcon} from '../kit/Object3D';
import {useStage} from '../kit/stage';
import {contrast, FONT, useTheme} from '../kit/theme';

// 세로 타일 캐러셀: 가로로 긴 띠들이 세로로 쌓이고, 가운데 한 장만 크게 펼쳐진다.
// 항목의 at 마다 다음 띠가 가운데로 올라오며 펼쳐지고(snap), 바탕색도 그 항목 색을 따라 바뀐다.
// 접힌 띠는 펼친 내용의 가운데 한 줄만 보인다 (잘린 단면). 색은 트라이어드에서만.
type Item = {title: string; object?: string; at?: number};

const mix = (hex: string, to: string, k: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').slice(i - 1, i + 1), 16));
  const [a, b] = [p(hex), p(to)];
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

export const StackCarousel: React.FC<{items: Item[]; label?: string}> = ({items, label}) => {
  const {start} = useScene();
  const {w, h, u} = useStage();
  const t = useTheme();
  const out = useExit(0.3);
  const n = Math.max(1, items.length);

  // 항목 색: 진한색 · 포인트색 · 밝은색 · 강조색 순환. 바탕은 그 색을 한 단계 어둡게.
  const tiles = [t.triad.dark, t.triad.accent, t.triad.light, t.accent];
  const tile = (i: number) => tiles[((i % tiles.length) + tiles.length) % tiles.length];
  const ground = (i: number) => mix(tile(i), '#000000', contrast(tile(i), '#000000') > 8 ? 0.45 : 0.15);

  // 지금 가운데 있는 항목 (소수 = 넘어가는 중)
  const ats = items.map((it, i) => it.at ?? start + 0.2 + i * 0.9);
  const sp = ats.map((at, i) => useSpringAt(i === 0 ? start : at, 'snap')); // 길이 고정 → 훅 순서 고정
  const a = sp.slice(1).reduce((s, v) => s + v, 0);
  const open = sp[0];

  const bigW = w * 0.62;
  const bigH = h * 0.5;
  const smallW = w * 0.5;
  const smallH = h * 0.042;
  const gap = 6 * u;
  const R = 4; // 위아래로 보이는 접힌 띠 수
  const js: number[] = [];
  for (let j = -R; j <= n - 1 + R; j++) js.push(j);
  const size = (j: number) => {
    const d = Math.min(1, Math.abs(j - a));
    const far = Math.min(R, Math.abs(j - a));
    return {
      w: interpolate(d, [0, 1], [bigW, smallW * (1 - far * 0.05)]),
      h: interpolate(d, [0, 1], [bigH, smallH]) * open,
    };
  };
  // 위쪽 가장자리 누적 → a 의 가운데가 무대 가운데에 오게 민다
  const tops: number[] = [];
  let y = 0;
  for (const j of js) {
    tops.push(y);
    y += size(j).h + gap;
  }
  const fl = Math.floor(a);
  const fr = a - fl;
  const idx = (j: number) => js.indexOf(j);
  const cA = tops[idx(fl)] + size(fl).h / 2;
  const cB = idx(fl + 1) >= 0 ? tops[idx(fl + 1)] + size(fl + 1).h / 2 : cA;
  const shift = h * 0.5 - (cA + (cB - cA) * fr);

  const groundNow = interpolateColors(a, items.map((_, i) => i), items.map((_, i) => ground(i)));
  const label12: React.CSSProperties = {fontFamily: FONT.mono, fontSize: 22 * u, letterSpacing: 2 * u, textTransform: 'uppercase', color: '#FFFFFF', opacity: 0.85};

  return (
    <AbsoluteFill style={{background: n > 1 ? groundNow : ground(0), opacity: 1 - out, overflow: 'hidden'}}>
      {js.map((j, k) => {
        const s = size(j);
        const d = Math.abs(j - a);
        if (d > R + 0.5) return null;
        const i = ((j % n) + n) % n;
        const it = items[i];
        const bg = tile(i);
        const ink = contrast(bg, '#FFFFFF') >= 3 ? '#FFFFFF' : t.ink;
        const titleOn = interpolate(d, [0, 0.4], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return (
          <div
            key={j}
            style={{
              position: 'absolute',
              left: (w - s.w) / 2,
              top: tops[k] + shift,
              width: s.w,
              height: s.h,
              overflow: 'hidden',
              background: bg,
              opacity: interpolate(d, [R - 0.5, R + 0.5], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            }}
          >
            {/* 펼친 크기의 내용을 가운데 맞춤 → 접히면 가운데 단면만 */}
            <div style={{position: 'absolute', left: (s.w - bigW) / 2, top: (s.h - bigH) / 2, width: bigW, height: bigH}}>
              <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <ObjIcon name={it.object ?? 'picture'} size={bigH * 0.62} material="color" />
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 36 * u,
                  right: 36 * u,
                  bottom: 30 * u,
                  fontFamily: FONT.sans,
                  fontWeight: 800,
                  fontSize: fitSize(it.title, 64 * u, bigW - 72 * u),
                  color: ink,
                  opacity: titleOn,
                  wordBreak: 'keep-all',
                  whiteSpace: 'nowrap',
                }}
              >
                {it.title}
              </div>
            </div>
          </div>
        );
      })}
      {label ? (
        <div style={{position: 'absolute', left: 40 * u, right: 40 * u, top: 30 * u, display: 'flex', justifyContent: 'space-between', ...label12}}>
          <span>{label}</span>
          <span>
            {String(Math.min(n, Math.round(a) + 1)).padStart(2, '0')} / {String(n).padStart(2, '0')}
          </span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
