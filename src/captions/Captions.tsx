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
  /** 노래방식: 지금 말하는 단어에 강조 블록 (cue.w 가 있을 때) */
  karaoke?: boolean;
}> = ({
  cues,
  y,
  maxW,
  size = 64,
  bigSize = 92,
  align = 'center',
  x,
  surface = 'video',
  karaoke = false,
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
      {cue.style === 'big' ? (
        <BigCue cue={cue} size={bigSize} maxW={maxW} onBackdrop={surface === 'backdrop'} karaoke={karaoke} now={now} />
      ) : (
        <StripCue cue={cue} size={size} maxW={maxW} karaoke={karaoke} now={now} />
      )}
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

/**
 * 노래방식 자막 (온돌 롱폼 참고): 지금 말하는 단어만 강조색 블록, 지난 단어는 진하게, 아직 안 한 단어는 흐리게.
 * cue.w(단어별 시작, render 가 words.json 에서) 가 띄어쓰기 단어 수와 같을 때만. 아니면 예전처럼 한 번에.
 * 색만 바뀌고 자리는 그대로 (줄 길이가 흔들리지 않게). 강조 단어(emph)는 말한 뒤 제 색으로.
 */
type Look = 'strip' | 'big' | 'bigBackdrop';
const Karaoke: React.FC<{cue: Cue; accent: string; look: Look; now: number}> = ({cue, accent, look, now}) => {
  const t = useTheme();
  const toks: {text: string; a: number; b: number}[] = [];
  let pos = 0;
  for (const w of cue.text.split(' ')) {
    toks.push({text: w, a: pos, b: pos + w.length});
    pos += w.length + 1;
  }
  const ranges: {a: number; b: number; color: string}[] = [];
  for (const e of (cue.emph ?? []).slice(0, 2)) {
    const i = cue.text.indexOf(e.text);
    if (i >= 0) ranges.push({a: i, b: i + e.text.length, color: e.tone && e.tone !== 'key' ? TONE[e.tone] : accent});
  }
  const w = cue.w ?? [];
  const ink = look === 'big' ? '#FFFFFF' : look === 'bigBackdrop' ? t.ink : '#17171C';
  const block = look === 'strip' ? accent : look === 'big' ? (t.dark ? t.accent : '#FFD84D') : accent;
  return (
    <>
      {toks.map((tk, i) => {
        const emph = ranges.find((r) => tk.a < r.b && tk.b > r.a)?.color;
        const next = i + 1 < w.length ? w[i + 1] : cue.end;
        const active = now >= w[i] && now < next;
        const spoken = now >= next;
        const pop = active ? interpolate(now, [w[i], w[i] + 0.1], [0.92, 1], {extrapolateRight: 'clamp'}) : 1;
        let style: React.CSSProperties;
        if (active && look === 'strip') style = {background: block, color: '#FFFFFF', borderRadius: 6, boxShadow: `0 0 0 0.08em ${block}`};
        else if (active) style = {color: block};
        else if (spoken) style = {color: emph ?? ink};
        else style = {color: emph ?? ink, opacity: look === 'big' ? 0.72 : 0.38}; // 영상 위 큰 흰 글자는 흰 셔츠 깃·밝은 바탕 위에서 0.5 면 안 읽혔다 (ep01 쇼츠)
        return (
          <React.Fragment key={i}>
            {i ? ' ' : ''}
            <span style={{display: 'inline-block', transform: pop !== 1 ? `scale(${pop})` : undefined, ...style}}>{tk.text}</span>
          </React.Fragment>
        );
      })}
    </>
  );
};
const useKaraoke = (cue: Cue, on: boolean) => on && !!cue.w && cue.w.length === cue.text.split(' ').length;

const StripCue: React.FC<{cue: Cue; size: number; maxW: number; karaoke?: boolean; now?: number}> = ({cue, size, maxW, karaoke = false, now = 0}) => {
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
      {useKaraoke(cue, karaoke) ? <Karaoke cue={cue} accent={acc} look="strip" now={now} /> : <Spans cue={cue} accent={acc} />}
    </div>
  );
};

const BigCue: React.FC<{cue: Cue; size: number; maxW: number; onBackdrop?: boolean; karaoke?: boolean; now?: number}> = ({cue, size, maxW, onBackdrop, karaoke = false, now = 0}) => {
  const t = useTheme();
  const fs = fitSize(cue.text, size, maxW, 60);
  const k = useKaraoke(cue, karaoke);
  if (onBackdrop) {
    return (
      <div style={{fontFamily: FONT.emph, fontSize: fs, lineHeight: 1.15, color: t.ink, whiteSpace: 'nowrap', letterSpacing: '-0.01em'}}>
        {k ? <Karaoke cue={cue} accent={t.accent} look="bigBackdrop" now={now} /> : <Spans cue={cue} accent={t.accent} />}
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
      {k ? <Karaoke cue={cue} accent={t.dark ? t.accent : '#FFD84D'} look="big" now={now} /> : <Spans cue={cue} accent={t.dark ? t.accent : '#FFD84D'} />}
    </div>
  );
};
