import React from 'react';
import {interpolate} from 'remotion';
import {useExit, useFloat, useSpringAt} from './motion';
import {alpha, FONT, useTheme, type Theme} from './theme';

// 트라이어드 그라디언트 — style/policy.json 의 gradient 정책을 코드로 옮긴 것.
//  · 색은 트라이어드 3색(dark·accent·light)만. 다른 색을 섞지 않는다.
//  · 진한색 바탕 + 반투명 레이어 4장 + 안쪽 테두리 음영. sRGB 기본 보간(in oklab 금지).
//  · 면 안의 그라디언트는 움직이지 않는다(일렁임·글로우 금지). 면 전체가 등장·부유하는 건 OK.
//  · 글자는 위쪽 진한 영역에만, 흰색으로.
// 기준 좌표는 940×930 패널. 다른 크기에서는 가로·세로를 각각 비례해서 늘린다.

type Triad = Theme['triad'];

export const gradientSurface = (tri: Triad, w: number, h: number): React.CSSProperties => {
  const sx = w / 940;
  const sy = h / 930;
  const u = Math.min(sx, sy);
  const {dark, accent, light} = tri;
  return {
    background: [
      // ⑤ 밝은색 덩어리 — 오른쪽 아래 (아래 띠를 물결로)
      `radial-gradient(ellipse ${399 * sx}px ${335 * sy}px at ${711 * sx}px ${840 * sy}px, ${alpha(light, 0.832)} 0%, ${alpha(light, 0.535)} 37.3%, ${alpha(light, 0)} 100%)`,
      // ④ 밝은색 — 아래에서 올라옴 (오른쪽이 조금 먼저)
      `linear-gradient(174.3deg, ${alpha(light, 0)} 0%, ${alpha(light, 0)} 47.8%, ${alpha(light, 0.236)} 64.9%, ${alpha(light, 0.898)} 85.5%)`,
      // ③ 진한색 덩어리 — 오른쪽 위 (경계를 사선으로)
      `radial-gradient(ellipse ${790 * sx}px ${545 * sy}px at ${883 * sx}px ${-11 * sy}px, ${dark} 0%, ${alpha(dark, 0.771)} 48.9%, ${alpha(dark, 0)} 100%)`,
      // ② 포인트색 — 위에서 아래로 차오름
      `linear-gradient(180deg, ${alpha(accent, 0)} 0%, ${alpha(accent, 0.845)} 30.8%, ${alpha(accent, 0.974)} 41.4%)`,
      // ① 바탕
      dark,
    ].join(', '),
    // ⑥ 안쪽 테두리 음영 — 없으면 평평한 판처럼 보인다
    boxShadow: `inset 0 0 ${90 * u}px ${alpha(dark, 0.12)}`,
    borderRadius: 50 * u,
    overflow: 'hidden',
  };
};

/** 그라디언트 면 한 장. at 에 톡 들어오고, 이후엔 면 전체만 천천히 부유한다. */
export const GradientPanel: React.FC<{
  w: number;
  h: number;
  x?: number; // 가운데 좌표 (주면 absolute 배치)
  y?: number;
  at?: number;
  rotate?: number;
  shadow?: boolean;
  triad?: Triad;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({w, h, x, y, at, rotate = 0, shadow = true, triad, children, style}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'soft');
  const out = useExit(0.3);
  const fy = useFloat(5, 5.2, 0.4);
  const surf = gradientSurface(triad ?? t.triad, w, h);
  return (
    <div
      style={{
        ...(x !== undefined && y !== undefined ? {position: 'absolute', left: x - w / 2, top: y - h / 2} : {position: 'relative'}),
        width: w,
        height: h,
        ...surf,
        boxShadow: shadow ? `${surf.boxShadow}, 0 ${30 * (w / 940)}px ${80 * (w / 940)}px ${t.shadow}` : surf.boxShadow,
        opacity: Math.min(1, s * 1.6) * (1 - out),
        transform: `translateY(${interpolate(s, [0, 1], [60, 0]) + fy - out * 30}px) rotate(${interpolate(s, [0, 1], [rotate - 4, rotate])}deg) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ── 팔레트 카드: 그라디언트 패널 + 겹쳐 쌓인 색 탭 3장 (레퍼런스 구조, 글꼴은 정책에 맞게 Pretendard)
const ICONS = [
  <path key="h" d="M12 21.2 10.6 20C5.4 15.4 2 12.4 2 8.6 2 5.6 4.4 3.2 7.4 3.2c1.7 0 3.4.8 4.6 2.1 1.2-1.3 2.9-2.1 4.6-2.1 3 0 5.4 2.4 5.4 5.4 0 3.8-3.4 6.8-8.6 11.4z" />,
  <path key="b" d="M13.6 1.8 5.2 13.2h5.6l-1.6 9 8.6-11.8h-5.8z" stroke="currentColor" strokeWidth={2.6} strokeLinejoin="round" />,
  <path key="s" d="M12 2.8l2.7 5.9 6.4.7-4.8 4.3 1.4 6.3L12 16.8 6.3 20l1.4-6.3L2.9 9.4l6.4-.7z" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />,
];

export const PaletteCard: React.FC<{w: number; triad?: Triad; names?: string[]; label?: string}> = ({w, triad, names, label}) => {
  const t = useTheme();
  const tri = triad ?? t.triad;
  const u = w / 940;
  const hex = [tri.dark, tri.accent, tri.light];
  // 탭: 실제 173u, 위 50u 는 위 조각 밑에 숨고 123u 만 보인다. 위 모서리는 직각.
  const tabs = [
    {top: 880, z: 3, bg: tri.dark, fg: tri.accent},
    {top: 1004, z: 2, bg: tri.accent, fg: tri.light},
    {top: 1127, z: 1, bg: tri.light, fg: tri.dark},
  ];
  return (
    <div style={{position: 'relative', width: w, height: 1300 * u, fontFamily: FONT.sans}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: w, height: 930 * u, zIndex: 4, ...gradientSurface(tri, w, 930 * u)}}>
        {label ? (
          <div style={{position: 'absolute', right: 82 * u, top: 74 * u, fontWeight: 700, fontSize: 30 * u, lineHeight: `${40 * u}px`, color: '#FFFFFF', letterSpacing: '0.01em'}}>{label}</div>
        ) : null}
      </div>
      {tabs.map((tb, k) => (
        <div
          key={k}
          style={{
            position: 'absolute',
            left: 0,
            top: tb.top * u,
            width: w,
            height: 173 * u,
            zIndex: tb.z,
            background: tb.bg,
            color: tb.fg,
            borderRadius: `0 0 ${50 * u}px ${50 * u}px`,
            display: 'flex',
            alignItems: 'flex-end',
          }}
        >
          <div style={{height: 123 * u, width: '100%', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center'}}>
            <div style={{paddingLeft: 84 * u, fontWeight: 600, fontSize: 20 * u, lineHeight: `${24 * u}px`, letterSpacing: 0.2 * u}}>
              HEX
              <br />
              {hex[k].slice(1).toUpperCase()}
            </div>
            <div style={{fontWeight: 800, fontSize: 38 * u, lineHeight: 1, whiteSpace: 'nowrap'}}>{names?.[k] ?? ''}</div>
            <div style={{display: 'flex', justifyContent: 'flex-end', paddingRight: 84 * u}}>
              <svg width={36 * u} height={36 * u} viewBox="0 0 24 24" fill="currentColor">
                {ICONS[k]}
              </svg>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
