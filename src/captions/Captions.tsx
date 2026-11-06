import React from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitSize} from '../kit/measure';
import {alpha, contrast, FONT, useTheme} from '../kit/theme';
import type {CaptionStyle, Cue} from '../plan';

/**
 * 자막 규칙
 * - 큐 하나 = 절(의미 단위) 하나, 한 줄만. 폭이 넘치면 글자를 줄이고(최소 52px) 그래도 넘치면 큐를 나눈다.
 * - 글자는 교정된 대본 그대로, 시간만 음성 인식에서 가져온다.
 * - 강조 스팬은 큐당 최대 2개: key(강조색) / money(초록) / problem(빨강)
 * - big 스타일(훅·결론)은 박스 없이 크게. 전체의 40% 이하로.
 * - 모양은 취향 captions.set·font·shape·motion (승인 목록은 정책 captions, 합치는 곳은 scripts/style.mjs).
 *   기본(basic)은 흰 띠에 불투명도만 — 단어 시작 2프레임 안에 나타난다.
 * - 움직임은 전부 프레임 함수이고 정책 captions.motions 의 sec 안에 끝난다 (look.motionSec).
 */
const BASIC: CaptionStyle = {set: 'basic', font: {family: 'SUIT', weight: 700}, shape: 'strip', motion: 'none', motionSec: 0.07, scale: 1};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const stack = (look: CaptionStyle) => `"${look.font.family}", "Pretendard", sans-serif`;

/** 틀 전체의 움직임. type·word 는 글자마다라서 여기선 그대로 */
const useMotion = (cue: Cue, look: CaptionStyle): {style: React.CSSProperties; p: number} => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dt = frame / fps - cue.start;
  const p = interpolate(dt, [0, look.motionSec], [0, 1], clamp);
  const eased = interpolate(dt, [0, look.motionSec], [0, 1], {...clamp, easing: Easing.out(Easing.cubic)});
  const fade = interpolate(dt, [0, 2 / fps], [0, 1], clamp);
  switch (look.motion) {
    case 'slam': {
      const s = spring({frame: frame - Math.round(cue.start * fps), fps, config: {damping: 11, stiffness: 260, mass: 0.55}, durationInFrames: Math.round(look.motionSec * fps)});
      return {style: {opacity: fade, transform: `scale(${1.4 - 0.4 * s})`}, p};
    }
    case 'rise':
      return {style: {opacity: eased, transform: `translateY(${(1 - eased) * 30}px)`}, p};
    case 'focus':
      return {style: {opacity: eased, filter: `blur(${(1 - eased) * 12}px)`}, p};
    case 'type':
    case 'word':
      return {style: {}, p};
    default:
      return {style: {opacity: fade}, p};
  }
};

/** 글자별 불투명도. 자리는 그대로 두고 켜기만 해서 상자 크기가 흔들리지 않는다 */
const revealer = (cue: Cue, look: CaptionStyle, p: number): ((i: number) => number) | undefined => {
  const chars = [...cue.text];
  if (look.motion === 'type') {
    const n = Math.ceil(chars.length * p);
    return (i) => (i < n ? 1 : 0);
  }
  if (look.motion === 'word') {
    const words = cue.text.split(' ').length;
    const wordOf: number[] = [];
    let w = 0;
    chars.forEach((ch) => {
      wordOf.push(w);
      if (ch === ' ') w++;
    });
    return (i) => interpolate(p * words - wordOf[i], [0, 1], [0, 1], clamp);
  }
  return undefined;
};

export const Captions: React.FC<{
  cues: Cue[];
  y: number;
  maxW: number;
  size?: number;
  bigSize?: number;
  align?: 'center' | 'left';
  x?: number;
  /** 자막 뒤가 영상이면 video, 장면 배경이면 backdrop (big 스타일 색이 바뀜) */
  surface?: 'video' | 'backdrop';
  look?: CaptionStyle;
}> = ({cues, y, maxW, size = 64, bigSize = 92, align = 'center', x, surface = 'video', look = BASIC}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const now = frame / fps;
  const cue = cues.find((c) => now >= c.start && now < c.end);
  if (!cue) return null;
  const left = x ?? (width - maxW) / 2;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        width: maxW,
        top: y,
        display: 'flex',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
      }}
    >
      <Moving cue={cue} look={look} size={size * look.scale} bigSize={bigSize * look.scale} maxW={maxW} onBackdrop={surface === 'backdrop'} />
    </div>
  );
};

const Moving: React.FC<{cue: Cue; look: CaptionStyle; size: number; bigSize: number; maxW: number; onBackdrop: boolean}> = ({cue, look, size, bigSize, maxW, onBackdrop}) => {
  const {style, p} = useMotion(cue, look);
  const reveal = revealer(cue, look, p);
  return (
    <div style={{...style, transformOrigin: '50% 50%'}}>
      {cue.style === 'big' ? (
        <BigCue cue={cue} size={bigSize} maxW={maxW} onBackdrop={onBackdrop} look={look} reveal={reveal} />
      ) : look.shape === 'strip' ? (
        <StripCue cue={cue} size={size} maxW={maxW} look={look} reveal={reveal} />
      ) : (
        <ShapeCue cue={cue} size={size} maxW={maxW} look={look} reveal={reveal} onBackdrop={onBackdrop} />
      )}
    </div>
  );
};

const TONE = {key: '', money: '#107C41', problem: '#C0271D'};

const Spans: React.FC<{cue: Cue; accent: string; reveal?: (i: number) => number}> = ({cue, accent, reveal}) => {
  // 강조 텍스트를 원문에서 찾아 색칠
  const parts: {text: string; color?: string}[] = [];
  let rest = cue.text;
  for (const e of (cue.emph ?? []).slice(0, 2)) {
    const i = rest.indexOf(e.text);
    if (i < 0) continue;
    if (i > 0) parts.push({text: rest.slice(0, i)});
    parts.push({text: e.text, color: e.tone && e.tone !== 'key' ? TONE[e.tone] : accent});
    rest = rest.slice(i + e.text.length);
  }
  if (rest) parts.push({text: rest});
  let at = 0;
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} style={{color: p.color}}>
          {reveal
            ? [...p.text].map((ch, k) => (
                <span key={k} style={{opacity: reveal(at++)}}>
                  {ch}
                </span>
              ))
            : p.text}
        </span>
      ))}
    </>
  );
};

type CueProps = {cue: Cue; size: number; maxW: number; look: CaptionStyle; reveal?: (i: number) => number};

const StripCue: React.FC<CueProps> = ({cue, size, maxW, look, reveal}) => {
  const t = useTheme();
  const fs = fitSize(cue.text, size, maxW - 56, 52);
  // 강조색이 흰 띠 위에서 약하면(대비 < 2.5) 트라이어드 진한색, 그것도 약하면 짙은 보라로 대체
  const acc = contrast(t.accent, '#FBF9F3') >= 2.5 ? t.accent : contrast(t.triad.dark, '#FBF9F3') >= 4.5 ? t.triad.dark : '#6A3FD0';
  return (
    <div
      style={{
        background: '#FBF9F3',
        color: '#17171C',
        padding: `${fs * 0.22}px ${fs * 0.42}px`,
        borderRadius: 8,
        border: `1px solid ${alpha('#000000', 0.08)}`,
        boxShadow: `0 8px 24px ${alpha('#000000', 0.18)}`,
        fontFamily: look.set === 'basic' && look.font.family === 'SUIT' ? FONT.suit : stack(look),
        fontWeight: look.font.weight,
        fontSize: fs,
        lineHeight: 1.25,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <Spans cue={cue} accent={acc} reveal={reveal} />
    </div>
  );
};

/** 어두운 면 위에서 읽히는 강조색 (브랜드 색이 어두워도 글자가 사라지지 않게) */
const onDark = (accent: string, bg: string, fallback: string) => (contrast(accent, bg) >= 3 ? accent : fallback);

const ShapeCue: React.FC<CueProps & {onBackdrop?: boolean}> = ({cue, size, maxW, look, reveal, onBackdrop}) => {
  const t = useTheme();
  const fs = fitSize(cue.text, size, maxW - 56, 52);
  const base: React.CSSProperties = {
    fontFamily: stack(look),
    fontWeight: look.font.weight,
    fontSize: fs,
    lineHeight: 1.25,
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
  };
  const stroke = (px: number, color = '#000000'): React.CSSProperties => ({WebkitTextStroke: `${px}px ${color}`, paintOrder: 'stroke fill'});
  if (look.shape === 'band') {
    const bg = '#0E0E11';
    return (
      <div style={{...base, background: bg, color: '#FFFFFF', padding: `${fs * 0.2}px ${fs * 0.5}px`, borderLeft: `${fs * 0.14}px solid ${onDark(t.accent, bg, t.triad.light)}`, boxShadow: `0 8px 24px ${alpha('#000000', 0.3)}`}}>
        <Spans cue={cue} accent={onDark(t.accent, bg, t.triad.light)} reveal={reveal} />
      </div>
    );
  }
  if (look.shape === 'glass') {
    const bg = t.triad.dark;
    return (
      <div style={{...base, background: alpha(bg, 0.8), color: '#FFFFFF', padding: `${fs * 0.24}px ${fs * 0.5}px`, borderRadius: fs * 0.38, border: `2px solid ${alpha('#FFFFFF', 0.28)}`, boxShadow: `0 12px 32px ${alpha('#000000', 0.32)}`}}>
        <Spans cue={cue} accent={onDark(t.accent, bg, t.triad.light)} reveal={reveal} />
      </div>
    );
  }
  if (look.shape === 'console') {
    const bg = '#0B0F0C';
    return (
      <div style={{...base, letterSpacing: 0, background: bg, color: '#7CFF9B', padding: `${fs * 0.24}px ${fs * 0.42}px`, borderRadius: 10, border: `2px solid ${alpha('#7CFF9B', 0.35)}`, boxShadow: `0 10px 28px ${alpha('#000000', 0.4)}`}}>
        <Spans cue={cue} accent="#FFFFFF" reveal={reveal} />
      </div>
    );
  }
  if (look.shape === 'pop') {
    return (
      <div style={{...base, fontWeight: 900, color: '#FFD84D', ...stroke(fs * 0.16), textShadow: `0 6px 0 ${alpha('#000000', 0.55)}`}}>
        <Spans cue={cue} accent="#FFFFFF" reveal={reveal} />
      </div>
    );
  }
  // outline: 상자 없이 흰 글자. 영상 위에선 테두리와 그림자로 읽히지만, 밝은 장면 바탕에선 흰 글자가 사라진다 → 본문 글자색
  if (onBackdrop && !t.dark) {
    return (
      <div style={{...base, color: t.ink}}>
        <Spans cue={cue} accent={t.accent} reveal={reveal} />
      </div>
    );
  }
  return (
    <div style={{...base, color: '#FFFFFF', ...stroke(fs * 0.075, alpha('#000000', 0.7)), textShadow: `0 3px 18px ${alpha('#000000', 0.6)}`}}>
      <Spans cue={cue} accent={onDark(t.accent, '#000000', '#FFD84D')} reveal={reveal} />
    </div>
  );
};

const BigCue: React.FC<CueProps & {onBackdrop?: boolean}> = ({cue, size, maxW, onBackdrop, look, reveal}) => {
  const t = useTheme();
  const fs = fitSize(cue.text, size, maxW, 60);
  // 폰트 조합을 고르면 큰 자막은 강조 칸. 안 고르면 이전처럼 기본 세트만 강조 스택, 나머지는 자막 폰트
  const fontFamily = look.big || look.set === 'basic' ? FONT.emph : stack(look);
  const fontWeight = look.big ? look.big.weight : look.set === 'basic' ? undefined : look.font.weight;
  if (onBackdrop && look.shape !== 'pop') {
    return (
      <div style={{fontFamily, fontWeight, fontSize: fs, lineHeight: 1.15, color: t.ink, whiteSpace: 'nowrap', letterSpacing: '-0.01em'}}>
        <Spans cue={cue} accent={t.accent} reveal={reveal} />
      </div>
    );
  }
  const pop = look.shape === 'pop';
  return (
    <div
      style={{
        fontFamily,
        fontWeight: pop ? 900 : fontWeight,
        fontSize: fs,
        lineHeight: 1.15,
        color: pop ? '#FFD84D' : '#FFFFFF',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        textShadow: `0 4px 24px ${alpha('#000000', 0.55)}, 0 0 2px ${alpha('#000000', 0.6)}`,
        WebkitTextStroke: pop ? `${fs * 0.14}px #000000` : `${Math.max(2, fs * 0.03)}px ${alpha('#000000', 0.35)}`,
        paintOrder: 'stroke fill',
      }}
    >
      <Spans cue={cue} accent={pop ? '#FFFFFF' : t.dark ? t.accent : '#FFD84D'} reveal={reveal} />
    </div>
  );
};
