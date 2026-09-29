import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {EASE, useExit, useFloat, useNow, useProgress, useSpringAt} from './motion';
import {gradientSurface} from './Gradient';
import {alpha, FONT, useTheme} from './theme';

/** 2.5D 카드: 깊이(z)가 클수록 그림자가 크고 부유가 크다. 들어올 때 살짝 기울었다 펴진다. */
export const Card: React.FC<{
  at?: number;
  w: number;
  h?: number;
  x?: number;
  y?: number;
  z?: number;
  from?: 'below' | 'left' | 'right' | 'scale';
  tone?: 'paper' | 'accent' | 'ink' | 'deep' | 'gradient';
  radius?: number;
  pad?: number;
  tilt?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}> = ({at, w, h, x, y, z = 0.5, from = 'below', tone = 'paper', radius = 28, pad = 36, tilt = 0, children, style}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'pop');
  const out = useExit(0.3);
  const fy = useFloat(4 + z * 6, 4.4 - z, (x ?? 0) * 0.01 + z);
  const d = 120;
  const dx = from === 'left' ? -d : from === 'right' ? d : 0;
  const dy = from === 'below' ? d : 0;
  const sc = from === 'scale' ? interpolate(s, [0, 1], [0.6, 1]) : interpolate(s, [0, 1], [0.94, 1]);
  const bg =
    tone === 'accent' ? t.accent : tone === 'ink' ? t.ink : tone === 'deep' ? t.paper2 : t.paper;
  const fg = tone === 'accent' ? t.accentInk : tone === 'ink' ? t.bg : tone === 'gradient' ? '#FFFFFF' : t.ink;
  const grad = tone === 'gradient' ? gradientSurface(t.triad, w, h ?? w) : null;
  const pos: React.CSSProperties =
    x !== undefined && y !== undefined ? {position: 'absolute', left: x - w / 2, top: y - (h ?? 0) / 2} : {};
  return (
    <div
      style={{
        ...pos,
        width: w,
        height: h,
        padding: pad,
        borderRadius: radius,
        background: bg,
        color: fg,
        boxSizing: 'border-box',
        border: tone === 'paper' || tone === 'deep' ? `1.5px solid ${alpha(t.dark ? '#ffffff' : '#000000', 0.07)}` : undefined,
        boxShadow: `${grad ? grad.boxShadow + ', ' : ''}0 ${10 + z * 30}px ${30 + z * 50}px ${t.shadow}, 0 2px 6px ${alpha('#000000', 0.06)}`,
        ...(grad ? {background: grad.background, overflow: 'hidden'} : {}),
        opacity: Math.min(1, s * 2) * (1 - out),
        transform: `translate(${interpolate(s, [0, 1], [dx, 0])}px, ${interpolate(s, [0, 1], [dy, 0]) + fy - out * 40}px) rotate(${interpolate(s, [0, 1], [tilt - 5, tilt])}deg) scale(${sc})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** 알약 라벨 */
export const Pill: React.FC<{at?: number; children: React.ReactNode; tone?: 'accent' | 'soft' | 'ink'; size?: number; style?: React.CSSProperties}> = ({
  at,
  children,
  tone = 'soft',
  size = 34,
  style,
}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'pop');
  const bg = tone === 'accent' ? t.accent : tone === 'ink' ? t.ink : t.accentSoft;
  const fg = tone === 'accent' ? t.accentInk : tone === 'ink' ? t.bg : t.accent;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: `${size * 0.36}px ${size * 0.72}px`,
        borderRadius: 999,
        background: bg,
        color: fg,
        fontFamily: FONT.sans,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '-0.02em',
        opacity: Math.min(1, s * 2),
        transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`,
        transformOrigin: 'left center',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** 네 갈래 별 강조 요소 */
export const Star4: React.FC<{at?: number; x: number; y: number; size?: number; color?: string}> = ({at, x, y, size = 60, color}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'pop', 6);
  const now = useNow();
  const r = now * 22;
  const sz = size * s;
  const p = `M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0Z`;
  return (
    <svg width={sz} height={sz} viewBox="0 0 100 100" style={{position: 'absolute', left: x - sz / 2, top: y - sz / 2, transform: `rotate(${r}deg)`}}>
      <path d={p} fill={color ?? t.accent} />
    </svg>
  );
};

/** 손으로 그은 밑줄/동그라미/체크/취소선 — 펜이 지나가듯 그려짐 */
export const Marker: React.FC<{
  at: number;
  kind?: 'underline' | 'circle' | 'check' | 'strike' | 'arrow';
  w: number;
  h?: number;
  x?: number;
  y?: number;
  dur?: number;
  color?: string;
  stroke?: number;
}> = ({at, kind = 'underline', w, h = 40, x = 0, y = 0, dur = 0.45, color, stroke = 10}) => {
  const t = useTheme();
  const p = useProgress(at, dur, EASE.inOut);
  const out = useExit(0.3);
  const d = {
    underline: `M4 ${h * 0.6} C ${w * 0.3} ${h * 0.35}, ${w * 0.65} ${h * 0.75}, ${w - 4} ${h * 0.45}`,
    strike: `M4 ${h / 2} C ${w * 0.4} ${h * 0.42}, ${w * 0.7} ${h * 0.58}, ${w - 4} ${h * 0.48}`,
    circle: `M ${w * 0.52} ${h * 0.04} C ${w * 0.95} ${h * 0.02}, ${w * 1.02} ${h * 0.9}, ${w * 0.5} ${h * 0.96} C ${w * 0.02} ${h}, ${w * -0.02} ${h * 0.12}, ${w * 0.58} ${h * 0.08}`,
    check: `M ${w * 0.08} ${h * 0.55} L ${w * 0.4} ${h * 0.88} L ${w * 0.94} ${h * 0.1}`,
    arrow: `M4 ${h * 0.5} C ${w * 0.35} ${h * 0.2}, ${w * 0.65} ${h * 0.8}, ${w - 20} ${h * 0.5} M ${w - 46} ${h * 0.22} L ${w - 12} ${h * 0.5} L ${w - 46} ${h * 0.78}`,
  }[kind];
  return (
    <svg width={w} height={h} style={{position: 'absolute', left: x, top: y, overflow: 'visible', opacity: 1 - out}}>
      <path
        d={d}
        fill="none"
        stroke={color ?? t.accent}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - p}
      />
    </svg>
  );
};

/** 커서: points 를 따라 이동하고 clicks 시각에 눌림 + 파문 */
export const Cursor: React.FC<{
  path: {t: number; x: number; y: number}[];
  clicks?: number[];
  size?: number;
}> = ({path, clicks = [], size = 54}) => {
  const t = useTheme();
  const now = useNow();
  if (path.length === 0) return null;
  const ts = path.map((p) => p.t);
  const ease = {easing: EASE.inOut, extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
  // 구간별 이징
  let x = path[0].x;
  let y = path[0].y;
  for (let i = 0; i < path.length - 1; i++) {
    if (now >= ts[i]) {
      x = interpolate(now, [ts[i], ts[i + 1]], [path[i].x, path[i + 1].x], ease);
      y = interpolate(now, [ts[i], ts[i + 1]], [path[i].y, path[i + 1].y], ease);
    }
  }
  const appear = interpolate(now, [ts[0] - 0.25, ts[0]], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  let press = 0;
  let ripple = -1;
  for (const c of clicks) {
    const d = now - c;
    if (d >= -0.08 && d < 0.18) press = Math.max(press, 1 - Math.abs(d - 0.02) / 0.12);
    if (d >= 0 && d < 0.5) ripple = d / 0.5;
  }
  return (
    <>
      {ripple >= 0 ? (
        <div
          style={{
            position: 'absolute',
            left: x - 40,
            top: y - 40,
            width: 80,
            height: 80,
            borderRadius: '50%',
            border: `4px solid ${t.accent}`,
            opacity: 1 - ripple,
            transform: `scale(${0.3 + ripple * 1.1})`,
          }}
        />
      ) : null}
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{
          position: 'absolute',
          left: x - size * 0.18,
          top: y - size * 0.1,
          opacity: appear,
          transform: `scale(${1 - Math.max(0, press) * 0.14})`,
          filter: `drop-shadow(0 6px 8px ${alpha('#000000', 0.25)})`,
        }}
      >
        <path d="M4 2.5 L4 19.5 L8.6 15.2 L11.6 21.8 L14.6 20.5 L11.6 14 L18 14 Z" fill={t.dark ? '#ffffff' : '#111111'} stroke={t.dark ? '#111111' : '#ffffff'} strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** 숫자 카운트업 — 영상에서 실제로 말한 숫자에만 쓴다 */
export const Counter: React.FC<{
  at: number;
  to: number;
  from?: number;
  dur?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  size?: number;
  color?: string;
}> = ({at, to, from = 0, dur = 1.1, decimals = 0, prefix = '', suffix = '', size = 220, color}) => {
  const t = useTheme();
  const p = useProgress(at, dur, EASE.out);
  const s = useSpringAt(at, 'pop');
  const v = from + (to - from) * p;
  const txt = v.toLocaleString('ko-KR', {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
  return (
    <div
      style={{
        fontFamily: FONT.sans,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: '-0.05em',
        color: color ?? t.ink,
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
        transform: `scale(${interpolate(s, [0, 1], [0.8, 1])})`,
        opacity: Math.min(1, s * 2),
      }}
    >
      {prefix}
      {txt}
      <span style={{fontSize: '0.45em', marginLeft: '0.06em', color: t.accent}}>{suffix}</span>
    </div>
  );
};

/** 타자 치듯 글자 등장 */
export const TypeText: React.FC<{text: string; at: number; cps?: number; caret?: boolean; style?: React.CSSProperties}> = ({
  text,
  at,
  cps = 18,
  caret = true,
  style,
}) => {
  const now = useNow();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const chars = Array.from(text);
  const n = Math.max(0, Math.min(chars.length, Math.floor((now - at) * cps)));
  const blink = Math.floor(frame / (fps * 0.5)) % 2 === 0;
  const done = n >= chars.length;
  return (
    <span style={style}>
      {chars.slice(0, n).join('')}
      {caret && now >= at && (!done || blink) ? <span style={{opacity: 0.7}}>▍</span> : null}
    </span>
  );
};

/** 앱 창 프레임 (UI 패널) */
export const AppWindow: React.FC<{title?: string; w: number; h: number; children?: React.ReactNode; at?: number; z?: number; x?: number; y?: number}> = ({
  title,
  w,
  h,
  children,
  at,
  z = 0.6,
  x,
  y,
}) => {
  const t = useTheme();
  return (
    <Card at={at} w={w} h={h} x={x} y={y} z={z} pad={0} radius={26} from="scale">
      <div style={{height: 64, display: 'flex', alignItems: 'center', gap: 12, padding: '0 26px', borderBottom: `1.5px solid ${alpha(t.dark ? '#ffffff' : '#000000', 0.07)}`}}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
          <div key={c} style={{width: 18, height: 18, borderRadius: 9, background: t.dark ? alpha('#ffffff', 0.2) : c}} />
        ))}
        {title ? (
          <div style={{marginLeft: 14, fontFamily: FONT.sans, fontSize: 26, fontWeight: 600, color: t.muted}}>{title}</div>
        ) : null}
      </div>
      <div style={{position: 'relative', height: h - 64, overflow: 'hidden'}}>{children}</div>
    </Card>
  );
};

/** 말풍선 */
export const Bubble: React.FC<{at: number; side?: 'left' | 'right'; children: React.ReactNode; size?: number; maxWidth?: number}> = ({
  at,
  side = 'left',
  children,
  size = 34,
  maxWidth = 700,
}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'pop');
  const me = side === 'right';
  return (
    <div style={{display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start'}}>
      <div
        style={{
          maxWidth,
          padding: `${size * 0.55}px ${size * 0.8}px`,
          borderRadius: size * 0.9,
          borderBottomRightRadius: me ? 8 : undefined,
          borderBottomLeftRadius: me ? undefined : 8,
          background: me ? t.accent : t.paper2,
          color: me ? t.accentInk : t.ink,
          fontFamily: FONT.sans,
          fontSize: size,
          fontWeight: 600,
          lineHeight: 1.35,
          wordBreak: 'keep-all',
          opacity: Math.min(1, s * 2),
          transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
          transformOrigin: me ? 'right bottom' : 'left bottom',
        }}
      >
        {children}
      </div>
    </div>
  );
};

/** 막대 하나 (세로) */
export const Bar: React.FC<{at: number; value: number; max: number; h: number; w?: number; highlight?: boolean; label?: string; valueLabel?: string}> = ({
  at,
  value,
  max,
  h,
  w = 120,
  highlight,
  label,
  valueLabel,
}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'soft');
  const bh = (value / max) * h * s;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: w + 40}}>
      <div style={{height: h, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center'}}>
        {valueLabel ? (
          <div style={{fontFamily: FONT.sans, fontWeight: 800, fontSize: 40, color: highlight ? t.accent : t.ink, opacity: Math.min(1, s * 1.5), marginBottom: 10}}>
            {valueLabel}
          </div>
        ) : null}
        <div
          style={{
            width: w,
            height: Math.max(0, bh),
            borderRadius: '18px 18px 6px 6px',
            background: highlight ? t.accent : t.dark ? alpha('#ffffff', 0.18) : alpha(t.ink, 0.14),
            boxShadow: highlight ? `0 16px 30px ${alpha(t.accent, 0.35)}` : undefined,
          }}
        />
      </div>
      {label ? <div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: 32, color: t.muted}}>{label}</div> : null}
    </div>
  );
};

/** 원형 체크 배지 */
export const CheckDot: React.FC<{at: number; size?: number; ok?: boolean}> = ({at, size = 56, ok = true}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'pop');
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        flex: 'none',
        background: ok ? t.accent : alpha(t.ink, 0.12),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `scale(${s})`,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24">
        {ok ? (
          <path d="M4 12.5 L9.5 18 L20 6" fill="none" stroke={t.accentInk} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke={t.muted} strokeWidth={3.4} strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
};
