import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {Blob} from '../kit/Backdrop';
import {GradientPanel, PaletteCard} from '../kit/Gradient';
import {GhostText, KText, wordCount} from '../kit/KText';
import {fitSize, textWidth} from '../kit/measure';
import {EASE, useExit, useProgress, useScene, useSpringAt} from '../kit/motion';
import {Object3D, type Material} from '../kit/Object3D';
import {Counter, Marker, Pill, Star4} from '../kit/Parts';
import {useStage} from '../kit/stage';
import {alpha, FONT, useTheme} from '../kit/theme';

const center: React.CSSProperties = {alignItems: 'center', justifyContent: 'center', display: 'flex'};

// ─────────────────────────────────────────── hero: 주인공 3D 오브젝트 + 핵심어
export type HeroProps = {
  object: string;
  material?: Material;
  title: string; // KText 표기법 (*강조*, _강조_, \n)
  titleTimes?: number[];
  titleAt?: number;
  label?: string; // 위쪽 알약
  sub?: string; // 아래 작은 설명
  objectAt?: number;
  stars?: boolean;
  blob?: boolean;
};

export const Hero: React.FC<HeroProps> = (p) => {
  const {start} = useScene();
  const {w, h, wide, u} = useStage();
  const t = useTheme();
  const oAt = p.objectAt ?? start + 0.12;
  const tAt = p.titleAt ?? oAt + 0.35;
  const objSize = (wide ? 520 : 560) * u;
  return (
    <AbsoluteFill style={{...center, flexDirection: wide ? 'row' : 'column', gap: (wide ? 60 : 30) * u, padding: 60 * u}}>
      {p.blob !== false && t.surface === 'gradient' ? (
        // 정책 그라디언트 면: 오브젝트 뒤 카드 한 장 (글자는 올리지 않는다)
        <GradientPanel x={wide ? w * 0.3 : w * 0.5} y={wide ? h * 0.5 : h * 0.36} w={objSize * 1.12} h={objSize * 1.12} at={oAt - 0.08} rotate={-4} />
      ) : p.blob !== false ? (
        <Blob x={wide ? w * 0.3 : w * 0.5} y={wide ? h * 0.5 : h * 0.36} w={objSize * 1.25} h={objSize * 1.1} rotate={-8} />
      ) : null}
      <div style={{position: 'relative', width: objSize, height: objSize, flex: 'none'}}>
        <Object3D name={p.object} material={p.material} at={oAt} size={objSize} tilt={-4} />
        {p.stars !== false ? (
          <>
            <Star4 at={oAt + 0.3} x={objSize * 0.9} y={objSize * 0.12} size={70 * u} />
            <Star4 at={oAt + 0.45} x={objSize * 0.1} y={objSize * 0.78} size={40 * u} color={t.ink} />
          </>
        ) : null}
      </div>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: wide ? 'flex-start' : 'center', gap: 22 * u, maxWidth: wide ? w * 0.52 : w * 0.9}}>
        {p.label ? <Pill at={tAt - 0.15} size={34 * u}>{p.label}</Pill> : null}
        <KText text={p.title} at={tAt} times={p.titleTimes} size={(wide ? 104 : 124) * u} align={wide ? 'left' : 'center'} />
        {p.sub ? <SubLine text={p.sub} at={tAt + 0.5} align={wide ? 'left' : 'center'} /> : null}
      </div>
    </AbsoluteFill>
  );
};

export const SubLine: React.FC<{text: string; at: number; align?: 'left' | 'center'; size?: number}> = ({text, at, align = 'center', size}) => {
  const t = useTheme();
  const {u} = useStage();
  const p = useProgress(at, 0.5);
  const out = useExit(0.3);
  return (
    <div
      style={{
        fontFamily: FONT.sans,
        fontWeight: 500,
        fontSize: size ?? 46 * u,
        color: t.muted,
        textAlign: align,
        lineHeight: 1.4,
        wordBreak: 'keep-all',
        opacity: p * (1 - out),
        transform: `translateY(${(1 - p) * 20}px)`,
      }}
    >
      {text}
    </div>
  );
};

// ─────────────────────────────────────────── keyword: 타이포 중심
export type KeywordProps = {
  text: string;
  times?: number[];
  at?: number;
  ghost?: string; // 배경 대형 글자
  sub?: string;
  mark?: 'underline' | 'circle' | 'strike';
  markAt?: number;
  label?: string;
};

export const Keyword: React.FC<KeywordProps> = (p) => {
  const {start} = useScene();
  const {w, h, u} = useStage();
  const at = p.at ?? start + 0.1;
  const lastT = p.times?.length ? p.times[p.times.length - 1] : at + 0.12 * wordCount(p.text);
  const markAt = p.markAt ?? lastT + 0.35;
  const size = fitSize(p.text, 150 * u, w * 0.88);
  const lines = p.text.split('\n');
  const lh = size * 1.12;
  const lastW = textWidth(lines[lines.length - 1], size) * 1.04;
  const blockW = textWidth(p.text, size);
  return (
    <AbsoluteFill style={{...center, flexDirection: 'column', gap: 28 * u}}>
      {p.ghost ? <GhostText text={p.ghost} size={h * 0.3} top={h * 0.08} /> : null}
      {p.label ? <Pill at={at - 0.1} size={34 * u}>{p.label}</Pill> : null}
      <div style={{position: 'relative', width: blockW}}>
        <KText text={p.text} at={at} times={p.times} size={size} weight={900} />
        {p.mark ? (
          <Marker
            at={markAt}
            kind={p.mark}
            w={p.mark === 'circle' ? lastW + 140 * u : lastW}
            h={p.mark === 'circle' ? lh * 1.45 : 40 * u}
            x={(blockW - lastW) / 2 - (p.mark === 'circle' ? 70 * u : 0)}
            y={p.mark === 'underline' ? lh * lines.length - 4 * u : p.mark === 'circle' ? lh * (lines.length - 1) - lh * 0.24 : lh * (lines.length - 1) + lh * 0.3}
            stroke={12 * u}
          />
        ) : null}
      </div>
      {p.sub ? <SubLine text={p.sub} at={lastT + 0.3} /> : null}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────── stat: 실제로 말한 숫자
export type StatProps = {
  value: number;
  at?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  object?: string;
  ring?: number; // 0~1, 원형 게이지로 비율 표시 (퍼센트일 때)
};

export const Stat: React.FC<StatProps> = (p) => {
  const {start} = useScene();
  const {u, wide} = useStage();
  const t = useTheme();
  const at = p.at ?? start + 0.2;
  const R = 300 * u;
  const prog = useProgress(at, 1.2, EASE.out);
  return (
    <AbsoluteFill style={{...center, flexDirection: wide ? 'row' : 'column', gap: 40 * u}}>
      <div style={{position: 'relative', width: R * 2, height: R * 2, ...center}}>
        {p.ring !== undefined ? (
          <svg width={R * 2} height={R * 2} style={{position: 'absolute', inset: 0, transform: 'rotate(-90deg)'}}>
            <circle cx={R} cy={R} r={R - 24 * u} fill="none" stroke={alpha(t.ink, 0.08)} strokeWidth={30 * u} />
            <circle
              cx={R}
              cy={R}
              r={R - 24 * u}
              fill="none"
              stroke={t.accent}
              strokeWidth={30 * u}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={1 - p.ring * prog}
            />
          </svg>
        ) : p.object ? (
          <div style={{position: 'absolute', right: -40 * u, top: -60 * u}}>
            <Object3D name={p.object} at={at + 0.25} size={240 * u} float={8} depth={0.9} />
          </div>
        ) : null}
        <Counter at={at} to={p.value} prefix={p.prefix} suffix={p.suffix} decimals={p.decimals} size={(p.ring !== undefined ? 150 : 230) * u} />
      </div>
      <KText text={p.label} at={at + 0.4} size={70 * u} weight={700} maxWidth={900 * u} />
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────── chapter: 소제목 카드
export type ChapterProps = {num?: string; title: string; sub?: string; at?: number};

export const Chapter: React.FC<ChapterProps> = (p) => {
  const {start} = useScene();
  const {u, w} = useStage();
  const t = useTheme();
  const at = p.at ?? start + 0.1;
  const wipe = useProgress(at, 0.55, EASE.out);
  const s = useSpringAt(at + 0.15, 'pop');
  return (
    <AbsoluteFill style={{...center, flexDirection: 'column', gap: 26 * u}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          height: 16 * u,
          width: w * wipe,
          background: t.accent,
          transform: 'translateY(-50%)',
          opacity: 0.18,
        }}
      />
      {p.num ? (
        <div style={{fontFamily: FONT.serif, fontSize: 240 * u, lineHeight: 0.9, color: t.accent, transform: `scale(${s})`}}>
          {p.num}
        </div>
      ) : null}
      <KText text={p.title} at={at + 0.3} size={110 * u} weight={900} />
      {p.sub ? <SubLine text={p.sub} at={at + 0.7} /> : null}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────── palette: 트라이어드 팔레트 카드 (색·브랜드·디자인 이야기에)
export type PaletteProps = {
  triad?: [string, string, string]; // 없으면 영상 트라이어드
  names?: [string, string, string];
  label?: string; // 패널 오른쪽 위 흰 글자
  title?: string; // 카드 옆/아래 KText
  titleTimes?: number[];
  at?: number;
};

export const Palette: React.FC<PaletteProps> = (p) => {
  const {start} = useScene();
  const {w, h, wide, u} = useStage();
  const t = useTheme();
  const at = p.at ?? start + 0.1;
  const s = useSpringAt(at, 'soft');
  const out = useExit(0.3);
  const cw = Math.min((wide ? 0.34 : 0.56) * w, (h * (p.title ? 0.72 : 0.88)) / 1.383);
  const tri = p.triad ? {dark: p.triad[0], accent: p.triad[1], light: p.triad[2]} : undefined;
  return (
    <AbsoluteFill style={{...center, flexDirection: wide ? 'row' : 'column', gap: 50 * u}}>
      <div style={{opacity: Math.min(1, s * 1.6) * (1 - out), transform: `translateY(${interpolate(s, [0, 1], [80, 0]) - out * 30}px) scale(${interpolate(s, [0, 1], [0.92, 1])})`}}>
        <PaletteCard w={cw} triad={tri ?? t.triad} names={p.names} label={p.label} />
      </div>
      {p.title ? <KText text={p.title} at={at + 0.35} times={p.titleTimes} size={(wide ? 96 : 104) * u} align={wide ? 'left' : 'center'} /> : null}
    </AbsoluteFill>
  );
};
