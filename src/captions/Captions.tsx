import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {fitSize} from '../kit/measure';
import {alpha, contrast, FONT, useTheme} from '../kit/theme';
import type {Cue} from '../plan';

/**
 * 자막 규칙 (단순화 버전)
 * - 큐 하나 = 절(의미 단위) 하나, 한 줄만. 폭이 넘치면 글자를 줄이고(최소 52px) 그래도 넘치면 큐를 나눈다.
 * - 글자는 교정된 대본 그대로, 시간만 음성 인식에서 가져온다.
 * - 강조 스팬은 큐당 최대 2개: key(강조색) / money(초록) / problem(빨강)
 * - big 스타일(훅·결론)은 박스 없이 크게. 전체의 40% 이하로.
 * - 등장은 단어 시작 2프레임 안에, 움직임 없이 불투명도만.
 */
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
}> = ({
  cues,
  y,
  maxW,
  size = 64,
  bigSize = 92,
  align = 'center',
  x,
  surface = 'video',
}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const now = frame / fps;
  const cue = cues.find((c) => now >= c.start && now < c.end);
  if (!cue) return null;
  const fadeIn = interpolate(now, [cue.start, cue.start + 2 / fps], [0, 1], {extrapolateRight: 'clamp'});
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
        opacity: fadeIn,
      }}
    >
      {cue.style === 'big' ? <BigCue cue={cue} size={bigSize} maxW={maxW} onBackdrop={surface === 'backdrop'} /> : <StripCue cue={cue} size={size} maxW={maxW} />}
    </div>
  );
};

const TONE = {key: '', money: '#107C41', problem: '#C0271D'};

const Spans: React.FC<{cue: Cue; accent: string}> = ({cue, accent}) => {
  const emph = (cue.emph ?? []).slice(0, 2);
  if (!emph.length) return <>{cue.text}</>;
  // 강조 텍스트를 원문에서 찾아 색칠
  const parts: {text: string; color?: string}[] = [];
  let rest = cue.text;
  for (const e of emph) {
    const i = rest.indexOf(e.text);
    if (i < 0) continue;
    if (i > 0) parts.push({text: rest.slice(0, i)});
    parts.push({text: e.text, color: e.tone && e.tone !== 'key' ? TONE[e.tone] : accent});
    rest = rest.slice(i + e.text.length);
  }
  if (rest) parts.push({text: rest});
  return (
    <>
      {parts.map((p, i) => (
        <span key={i} style={{color: p.color}}>
          {p.text}
        </span>
      ))}
    </>
  );
};

const StripCue: React.FC<{cue: Cue; size: number; maxW: number}> = ({cue, size, maxW}) => {
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
        fontFamily: FONT.suit,
        fontWeight: 700,
        fontSize: fs,
        lineHeight: 1.25,
        letterSpacing: '-0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <Spans cue={cue} accent={acc} />
    </div>
  );
};

const BigCue: React.FC<{cue: Cue; size: number; maxW: number; onBackdrop?: boolean}> = ({cue, size, maxW, onBackdrop}) => {
  const t = useTheme();
  const fs = fitSize(cue.text, size, maxW, 60);
  if (onBackdrop) {
    return (
      <div style={{fontFamily: FONT.emph, fontSize: fs, lineHeight: 1.15, color: t.ink, whiteSpace: 'nowrap', letterSpacing: '-0.01em'}}>
        <Spans cue={cue} accent={t.accent} />
      </div>
    );
  }
  return (
    <div
      style={{
        fontFamily: FONT.emph,
        fontSize: fs,
        lineHeight: 1.15,
        color: '#FFFFFF',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        textShadow: `0 4px 24px ${alpha('#000000', 0.55)}, 0 0 2px ${alpha('#000000', 0.6)}`,
        WebkitTextStroke: `${Math.max(2, fs * 0.03)}px ${alpha('#000000', 0.35)}`,
        paintOrder: 'stroke fill',
      }}
    >
      <Spans cue={cue} accent={t.dark ? t.accent : '#FFD84D'} />
    </div>
  );
};
