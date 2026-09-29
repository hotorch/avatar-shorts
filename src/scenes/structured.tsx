import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {KText} from '../kit/KText';
import {fitSize} from '../kit/measure';
import {EASE, stagger, useExit, useNow, useProgress, useScene, useSpringAt} from '../kit/motion';
import {ObjIcon, Object3D} from '../kit/Object3D';
import {Bar, Card, CheckDot, Marker, Pill} from '../kit/Parts';
import {useStage} from '../kit/stage';
import {alpha, FONT, useTheme} from '../kit/theme';

const Title: React.FC<{text?: string; at: number; align?: 'left' | 'center'}> = ({text, at, align = 'center'}) => {
  const {u, w} = useStage();
  if (!text) return null;
  const size = fitSize(text, 84 * u, w * 0.86);
  return <KText text={text} at={at} size={size} weight={800} align={align} />;
};

// ─────────────────────────────────────────── compare: A vs B
type Side = {title: string; object?: string; items?: string[]; at?: number; tag?: string};
export type CompareProps = {title?: string; left: Side; right: Side; winner?: 'left' | 'right'; winnerAt?: number; vs?: string};

export const Compare: React.FC<CompareProps> = (p) => {
  const {start, end} = useScene();
  const {w, h, u, wide} = useStage();
  const t = useTheme();
  const tAt = start + 0.1;
  const lAt = p.left.at ?? start + 0.35;
  const rAt = p.right.at ?? lAt + 0.6;
  const winAt = p.winnerAt ?? Math.min(end - 0.8, rAt + 1.2);
  const win = useProgress(winAt, 0.45, EASE.out);
  const colW = wide ? w * 0.36 : w * 0.38;
  const hasItems = (p.left.items?.length ?? 0) + (p.right.items?.length ?? 0) > 0;
  const colH = hasItems ? (wide ? h * 0.66 : h * 0.5) : undefined;
  const vs = useSpringAt(rAt - 0.15, 'pop');

  const col = (s: Side, at: number, which: 'left' | 'right') => {
    const isWin = p.winner === which;
    const dim = p.winner && !isWin ? 1 - win * 0.45 : 1;
    const lift = isWin ? -win * 24 * u : 0;
    return (
      <div style={{opacity: dim, transform: `translateY(${lift}px) scale(${isWin ? 1 + win * 0.04 : 1})`}}>
        <Card at={at} w={colW} h={colH} z={isWin ? 0.9 : 0.5} from={which} tone={isWin && win > 0.5 ? 'paper' : 'paper'} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 * u, outline: isWin ? `${6 * u * win}px solid ${alpha(t.accent, win)}` : undefined}}>
          {s.tag ? <Pill at={at + 0.1} size={28 * u}>{s.tag}</Pill> : null}
          {s.object ? <ObjIcon name={s.object} size={(wide ? 210 : 230) * u} /> : null}
          <div style={{fontFamily: FONT.sans, fontWeight: 800, fontSize: fitSize(s.title, 66 * u, colW - 60 * u), color: isWin ? t.accent : t.ink, textAlign: 'center', letterSpacing: '-0.03em'}}>
            {s.title}
          </div>
          {(s.items ?? []).map((it, i) => (
            <Row key={i} at={at + 0.35 + i * 0.25} text={it} size={46 * u} />
          ))}
        </Card>
      </div>
    );
  };

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 40 * u}}>
      <Title text={p.title} at={tAt} />
      <div style={{display: 'flex', alignItems: 'center', gap: 30 * u}}>
        {col(p.left, lAt, 'left')}
        <div style={{fontFamily: FONT.serif, fontSize: 90 * u, color: t.accent, transform: `scale(${vs})`}}>{p.vs ?? 'vs'}</div>
        {col(p.right, rAt, 'right')}
      </div>
    </AbsoluteFill>
  );
};

const Row: React.FC<{at: number; text: string; size: number; ok?: boolean}> = ({at, text, size, ok}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'pop');
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: size * 0.5, alignSelf: 'stretch', opacity: Math.min(1, s * 2), transform: `translateX(${interpolate(s, [0, 1], [-30, 0])}px)`}}>
      {ok !== undefined ? <CheckDot at={at} size={size * 1.4} ok={ok} /> : <div style={{width: size * 0.36, height: size * 0.36, borderRadius: 99, background: t.accent, flex: 'none'}} />}
      <div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: size, color: t.ink, lineHeight: 1.3, wordBreak: 'keep-all'}}>{text}</div>
    </div>
  );
};

// ─────────────────────────────────────────── steps: 계단처럼 올라가는 과정
export type StepsProps = {title?: string; steps: {text: string; at?: number; object?: string}[]};

export const Steps: React.FC<StepsProps> = (p) => {
  const {start} = useScene();
  const {w, h, u, wide} = useStage();
  const t = useTheme();
  const n = p.steps.length;
  const times = stagger(p.steps, start + 0.45, 0.5);
  const areaW = w * 0.88;
  const areaH = (p.title ? h * 0.62 : h * 0.78);
  const stepW = areaW / n;
  const riseH = (areaH * 0.62) / Math.max(1, n - 1);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 30 * u}}>
      <Title text={p.title} at={start + 0.1} />
      <div style={{position: 'relative', width: areaW, height: areaH}}>
        {p.steps.map((s, i) => {
          const blockH = areaH * 0.3 + riseH * i;
          return (
            <StepBlock key={i} i={i} at={times[i]} x={i * stepW} w={stepW - 14 * u} h={blockH} top={areaH - blockH} text={s.text} object={s.object} last={i === n - 1} wide={wide} />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const StepBlock: React.FC<{i: number; at: number; x: number; w: number; h: number; top: number; text: string; object?: string; last: boolean; wide: boolean}> = ({i, at, x, w, h, top, text, object, last}) => {
  const t = useTheme();
  const {u} = useStage();
  const s = useSpringAt(at, 'pop');
  const out = useExit(0.3);
  const size = fitSize(text, 52 * u, w - 40 * u, 30 * u);
  return (
    <div style={{position: 'absolute', left: x, top: top + (1 - s) * 80, width: w, height: h, opacity: Math.min(1, s * 2) * (1 - out)}}>
      {object ? (
        <div style={{position: 'absolute', left: w / 2 - 70 * u, top: -150 * u}}>
          <ObjIcon name={object} size={140 * u} />
        </div>
      ) : null}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: `${22 * u}px ${22 * u}px 0 0`,
          background: last ? t.accent : i % 2 ? t.paper : t.paper2,
          boxShadow: `0 20px 40px ${t.shadow}`,
          padding: 20 * u,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: 8 * u,
        }}
      >
        <div style={{fontFamily: FONT.serif, fontSize: 70 * u, lineHeight: 1, color: last ? t.accentInk : t.accent}}>{String(i + 1).padStart(2, '0')}</div>
        <div style={{fontFamily: FONT.sans, fontWeight: 700, fontSize: size, color: last ? t.accentInk : t.ink, lineHeight: 1.25, wordBreak: 'keep-all'}}>{text}</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────── list: 체크리스트
export type ListProps = {title?: string; items: {text: string; at?: number; ok?: boolean}[]; object?: string};

export const List: React.FC<ListProps> = (p) => {
  const {start} = useScene();
  const {w, u, wide} = useStage();
  const times = stagger(p.items, start + 0.4, 0.45);
  const cardW = wide ? w * 0.72 : w * 0.88;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 34 * u}}>
      {p.object ? <Object3D name={p.object} at={start + 0.05} size={260 * u} float={8} /> : null}
      <Title text={p.title} at={start + 0.15} />
      <Card at={start + 0.25} w={cardW} z={0.6} pad={44 * u} style={{display: 'flex', flexDirection: 'column', gap: 30 * u}}>
        {p.items.map((it, i) => (
          <Row key={i} at={times[i]} text={it.text} size={fitSize(it.text, 64 * u, cardW - 200 * u, 36 * u)} ok={it.ok ?? true} />
        ))}
      </Card>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────── chart: 막대 / 추세선
export type ChartProps = {
  title?: string;
  kind?: 'bars' | 'line';
  bars?: {label: string; value: number; highlight?: boolean; at?: number; valueLabel?: string}[];
  trend?: 'up' | 'down' | 'flat-up';
  at?: number;
  endLabel?: string;
};

export const Chart: React.FC<ChartProps> = (p) => {
  const {start} = useScene();
  const {w, h, u, wide} = useStage();
  const t = useTheme();
  const at = p.at ?? start + 0.35;
  const cw = wide ? w * 0.78 : w * 0.86;
  const ch = wide ? h * 0.58 : h * 0.46;
  const line = useProgress(at, 1.4, EASE.inOut);
  const now = useNow();

  if ((p.kind ?? (p.bars ? 'bars' : 'line')) === 'bars' && p.bars) {
    const max = Math.max(...p.bars.map((b) => b.value));
    const times = stagger(p.bars, at, 0.28);
    const bw = Math.min(150 * u, (cw / p.bars.length) * 0.6);
    return (
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 40 * u}}>
        <Title text={p.title} at={start + 0.1} />
        <Card at={start + 0.2} w={cw} z={0.5} pad={40 * u} style={{display: 'flex', justifyContent: 'space-around', alignItems: 'flex-end'}}>
          {p.bars.map((b, i) => (
            <Bar key={i} at={times[i]} value={b.value} max={max} h={ch} w={bw} highlight={b.highlight} label={b.label} valueLabel={b.valueLabel} />
          ))}
        </Card>
      </AbsoluteFill>
    );
  }

  // 추세선: 수치 없이 방향만 보여준다 (지어낸 숫자 금지)
  const trend = p.trend ?? 'up';
  const pts =
    trend === 'down'
      ? [[0, 0.2], [0.2, 0.3], [0.35, 0.25], [0.55, 0.5], [0.7, 0.55], [0.85, 0.75], [1, 0.9]]
      : trend === 'flat-up'
        ? [[0, 0.8], [0.25, 0.78], [0.5, 0.76], [0.62, 0.7], [0.75, 0.5], [0.88, 0.3], [1, 0.1]]
        : [[0, 0.85], [0.18, 0.72], [0.34, 0.76], [0.5, 0.55], [0.66, 0.58], [0.82, 0.32], [1, 0.12]];
  const P = pts.map(([x, y]) => [x * (cw - 80 * u) + 40 * u, y * (ch - 60 * u) + 30 * u]);
  const d = P.map((q, i) => {
    if (i === 0) return `M ${q[0]} ${q[1]}`;
    const pr = P[i - 1];
    const mx = (pr[0] + q[0]) / 2;
    return `C ${mx} ${pr[1]}, ${mx} ${q[1]}, ${q[0]} ${q[1]}`;
  }).join(' ');
  const last = P[P.length - 1];
  const dot = useSpringAt(at + 1.35, 'pop');
  const color = trend === 'down' ? '#D6452F' : t.accent;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 40 * u}}>
      <Title text={p.title} at={start + 0.1} />
      <Card at={start + 0.2} w={cw} h={ch + 80 * u} z={0.5} pad={40 * u}>
        <svg width={cw - 80 * u} height={ch} style={{overflow: 'visible'}}>
          {[0.25, 0.5, 0.75].map((g) => (
            <line key={g} x1={0} x2={cw - 80 * u} y1={g * ch} y2={g * ch} stroke={alpha(t.ink, 0.08)} strokeWidth={2} strokeDasharray="6 10" />
          ))}
          <path d={`${d} L ${last[0]} ${ch} L ${P[0][0]} ${ch} Z`} fill={alpha(color, 0.1 * line)} />
          <path d={d} fill="none" stroke={color} strokeWidth={10 * u} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - line} />
          <circle cx={last[0]} cy={last[1]} r={18 * u * dot} fill={color} />
          <circle cx={last[0]} cy={last[1]} r={18 * u + ((now * 30) % 30) * u} fill="none" stroke={color} strokeWidth={3} opacity={dot * (1 - ((now * 30) % 30) / 30)} />
        </svg>
        {p.endLabel ? (
          <div style={{position: 'absolute', right: 50 * u, top: 20 * u}}>
            <Pill at={at + 1.4} tone="accent" size={34 * u}>{p.endLabel}</Pill>
          </div>
        ) : null}
      </Card>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────── marker 강조가 들어간 한 줄 인용
export type QuoteProps = {text: string; by?: string; object?: string; at?: number; times?: number[]};

export const Quote: React.FC<QuoteProps> = (p) => {
  const {start} = useScene();
  const {w, h, u, wide} = useStage();
  const t = useTheme();
  const at = p.at ?? start + 0.3;
  const cardW = wide ? w * 0.8 : w * 0.86;
  const size = fitSize(p.text, 84 * u, cardW - 120 * u, 48 * u);
  const q = useSpringAt(start + 0.15, 'pop');
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      {/* 종이 콜라주: 기울어진 종이 두 장 */}
      <Paper at={start} w={cardW * 0.9} h={h * 0.42} rot={-5} dx={-30 * u} dy={20 * u} color={t.paper2} />
      <Paper at={start + 0.08} w={cardW * 0.94} h={h * 0.4} rot={3} dx={24 * u} dy={-10 * u} color={alpha(t.accent, t.dark ? 0.25 : 0.14)} />
      <Card at={start + 0.12} w={cardW} z={0.8} pad={60 * u} style={{display: 'flex', flexDirection: 'column', gap: 24 * u}}>
        <div style={{fontFamily: FONT.serif, fontSize: 200 * u, lineHeight: 0.6, color: t.accent, height: 80 * u, transform: `scale(${q})`, transformOrigin: 'left top'}}>“</div>
        <KText text={p.text} at={at} times={p.times} size={size} weight={700} align="left" lineHeight={1.3} />
        {p.by ? <div style={{fontFamily: FONT.sans, fontSize: 34 * u, fontWeight: 600, color: t.muted}}>— {p.by}</div> : null}
      </Card>
      {p.object ? (
        <div style={{position: 'absolute', right: wide ? w * 0.04 : w * 0.02, bottom: wide ? h * 0.06 : h * 0.18}}>
          <Object3D name={p.object} material="halftone" at={at + 0.4} size={260 * u} depth={1} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

const Paper: React.FC<{at: number; w: number; h: number; rot: number; dx: number; dy: number; color: string}> = ({at, w, h, rot, dx, dy, color}) => {
  const s = useSpringAt(at, 'soft');
  const out = useExit(0.3);
  return (
    <div
      style={{
        position: 'absolute',
        width: w,
        height: h,
        background: color,
        borderRadius: 10,
        transform: `translate(${dx}px, ${dy + (1 - s) * 100}px) rotate(${rot * s}deg)`,
        opacity: Math.min(1, s * 2) * (1 - out),
      }}
    />
  );
};

export {Marker};
