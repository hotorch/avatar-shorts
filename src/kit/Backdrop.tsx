import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useNow} from './motion';
import {alpha, useTheme} from './theme';

/**
 * 모든 장면의 바탕: 단색 + 저대비 점선/십자 격자 + 정확히 2개의 반투명 대각선 + 옅은 종이결.
 * 대각선 2개는 서로 다른 속도로 아주 천천히 움직이고, 절대 시선의 중심이 되지 않는다.
 * (원본 기준 시간으로 움직여서 장면이 바뀌어도 선이 끊기지 않고 이어진다)
 */
export const Backdrop: React.FC<{grid?: boolean; grain?: boolean; gridSize?: number}> = ({
  grid = true,
  grain = true,
  gridSize = 56,
}) => {
  const t = useTheme();
  const {width, height} = useVideoConfig();
  const sec = useNow(); // 장면 안에서도 원본 기준 초 → 선이 끊기지 않음
  const diag = Math.hypot(width, height);

  // 대각선 A: 느리게 오른쪽 아래로, B: 더 느리게 반대로
  const aOff = ((sec * 14) % (diag * 0.6)) - diag * 0.3;
  const bOff = -((sec * 9) % (diag * 0.6)) + diag * 0.3;

  return (
    <AbsoluteFill style={{background: t.bg, overflow: 'hidden'}}>
      {grid ? <Grid size={gridSize} /> : null}
      <Band angle={-32} offset={aOff} thickness={Math.round(width * 0.11)} color={t.line} />
      <Band angle={-32} offset={bOff + diag * 0.18} thickness={Math.round(width * 0.035)} color={t.line} />
      {grain ? <Grain dark={t.dark} /> : null}
    </AbsoluteFill>
  );
};

const Band: React.FC<{angle: number; offset: number; thickness: number; color: string}> = ({
  angle,
  offset,
  thickness,
  color,
}) => (
  <div
    style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: '300%',
      height: thickness,
      marginLeft: '-150%',
      marginTop: -thickness / 2,
      background: color,
      transform: `rotate(${angle}deg) translateY(${offset}px)`,
    }}
  />
);

export const Grid: React.FC<{size?: number; color?: string; kind?: 'dot' | 'cross'}> = ({size = 56, color, kind}) => {
  const t = useTheme();
  const c = color ?? t.grid;
  const k = kind ?? t.grid_kind;
  const id = `grid-${k}-${size}`;
  return (
    <svg width="100%" height="100%" style={{position: 'absolute', inset: 0}}>
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          {k === 'dot' ? (
            <circle cx={size / 2} cy={size / 2} r={1.6} fill={c} />
          ) : (
            <g stroke={c} strokeWidth={1.4} strokeLinecap="round">
              <line x1={size / 2 - 5} y1={size / 2} x2={size / 2 + 5} y2={size / 2} />
              <line x1={size / 2} y1={size / 2 - 5} x2={size / 2} y2={size / 2 + 5} />
            </g>
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
};

/** 종이결: 정적인 노이즈라 프레임마다 깜빡이지 않는다 */
export const Grain: React.FC<{dark?: boolean; opacity?: number}> = ({dark, opacity}) => (
  <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, opacity: opacity ?? (dark ? 0.06 : 0.09), mixBlendMode: dark ? 'screen' : 'multiply'}}>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={7} stitchTiles="stitch" />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter="url(#grain)" />
  </svg>
);

/** 큰 유기적 모서리 도형 (필요할 때만) — 카드 뒤 깊이감용 */
export const Blob: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  rotate?: number;
  radius?: string;
}> = ({x, y, w, h, color, rotate = 0, radius = '46% 54% 42% 58% / 52% 44% 56% 48%'}) => {
  const t = useTheme();
  return (
    <div
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        borderRadius: radius,
        background: color ?? alpha(t.accent, t.dark ? 0.16 : 0.1),
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );
};
