import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig, spring} from 'remotion';
import {SPRING, useExit, useScene} from './motion';
import {FONT, useTheme} from './theme';

/**
 * 한글 키네틱 타이포 — 단어가 마스크 아래에서 솟아오르며 7% 넘쳤다 자리 잡는다.
 *
 * text 표기법:
 *   "집중력은 *습관*이다"  → *…* 부분은 명조/세리프 + 강조색 (짧은 강조에만)
 *   "_작은_ 차이"          → _…_ 부분은 강조색 산세리프
 * times: 단어별 등장 시각(원본 기준 초). 말하는 타이밍에 맞추려면 words.json 의 start 를 넣는다.
 *        없으면 at 부터 gap 간격.
 */
export const KText: React.FC<{
  text: string;
  at?: number;
  times?: number[];
  gap?: number;
  size?: number;
  weight?: number;
  color?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  maxWidth?: number;
  tracking?: number;
  exit?: 'mask' | 'spread' | 'none';
  style?: React.CSSProperties;
  font?: string;
}> = ({
  text,
  at,
  times,
  gap = 0.12,
  size = 120,
  weight = 800,
  color,
  align = 'center',
  lineHeight = 1.12,
  maxWidth,
  tracking = -0.035,
  exit = 'mask',
  style,
  font,
}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {start} = useScene();
  const out = useExit(0.32);
  const lines = text.split('\n');
  let wi = 0;
  const base = at ?? start;

  return (
    <div
      style={{
        fontFamily: font ?? FONT.sans,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        letterSpacing: `${tracking}em`,
        color: color ?? t.ink,
        textAlign: align,
        maxWidth,
        wordBreak: 'keep-all',
        ...style,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{display: 'block'}}>
          {tokenize(line).map((tok, ti) => {
            const i = wi++;
            const at_i = times?.[i] ?? base + i * gap;
            const f0 = Math.round((at_i - start) * fps);
            const s = spring({frame: frame - f0, fps, config: SPRING.pop});
            const y = interpolate(s, [0, 1], [105, 0]);
            const exitY = exit === 'mask' ? out * -105 : 0;
            const spread = exit === 'spread' ? out * 0.25 : 0;
            const op = exit === 'spread' ? 1 - out : 1;
            const isSerif = tok.kind === 'serif';
            return (
              <span
                key={ti}
                style={{
                  display: 'inline-block',
                  overflow: 'hidden',
                  verticalAlign: 'bottom',
                  paddingBottom: '0.08em',
                  marginBottom: '-0.08em',
                  paddingRight: '0.04em',
                  marginRight: ti < tokenize(line).length - 1 ? '0.26em' : 0,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    transform: `translateY(${y + exitY}%)`,
                    opacity: op * Math.min(1, s * 3),
                    letterSpacing: `${tracking + spread}em`,
                    color: tok.kind === 'plain' ? undefined : t.accent,
                    fontFamily: isSerif ? FONT.serif : undefined,
                    fontWeight: isSerif ? 400 : undefined,
                    fontSize: isSerif ? '1.08em' : undefined,
                    fontStyle: 'normal',
                  }}
                >
                  {tok.text}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

type Tok = {text: string; kind: 'plain' | 'serif' | 'accent'};

export const tokenize = (line: string): Tok[] =>
  line
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => {
      if (/^\*.+\*$/.test(w)) return {text: w.slice(1, -1), kind: 'serif'};
      if (/\*/.test(w)) return {text: w.replace(/\*/g, ''), kind: 'serif'};
      if (/^_.+_$/.test(w)) return {text: w.slice(1, -1), kind: 'accent'};
      if (/_/.test(w)) return {text: w.replace(/_/g, ''), kind: 'accent'};
      return {text: w, kind: 'plain'};
    });

/** 단어 수 (times 배열 길이를 맞출 때) */
export const wordCount = (text: string) => text.split('\n').reduce((n, l) => n + tokenize(l).length, 0);

/** 낮은 불투명도의 거대 배경 글자 */
export const GhostText: React.FC<{text: string; size?: number; at?: number; top?: number; drift?: number}> = ({
  text,
  size = 380,
  top = 0,
  drift = 40,
}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const x = -(frame / fps) * drift * 0.5;
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 0,
        whiteSpace: 'nowrap',
        fontFamily: FONT.sans,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: '-0.05em',
        color: t.ink,
        opacity: t.dark ? 0.05 : 0.045,
        transform: `translateX(${x}px)`,
      }}
    >
      {text} {text}
    </div>
  );
};
