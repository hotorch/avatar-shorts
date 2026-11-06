import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {KText} from '../kit/KText';
import {useExit, useScene, useSpringAt} from '../kit/motion';
import {gradientSurface} from '../kit/Gradient';
import {useStage} from '../kit/stage';
import {alpha, useTheme} from '../kit/theme';

// 복제 격자: 작은 웹페이지 한 장이 먼저 뜨고, copyAt 에 같은 페이지가 그 자리에서 복사돼 격자를 채운다.
// "다 똑같이 생겼다", "전부 비슷하다"를 말할 때. 페이지는 일부러 내용 없는 틀만 그린다 (실제 사이트·로고 아님).
const Page: React.FC<{w: number; h: number; lit: number}> = ({w, h, lit}) => {
  const t = useTheme();
  const bar = (bw: number, bh: number, c: string): React.CSSProperties => ({width: bw, height: bh, borderRadius: bh / 2, background: c});
  const line = alpha(t.dark ? '#ffffff' : '#000000', 0.16);
  const heroH = h * 0.42;
  const surf = gradientSurface(t.triad, w - h * 0.12, heroH);
  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: 'border-box',
        padding: h * 0.06,
        borderRadius: h * 0.07,
        background: t.paper,
        border: `${Math.max(2, h * 0.009)}px solid ${alpha(t.accent, 0.25 + lit * 0.75)}`,
        boxShadow: `0 ${h * 0.05}px ${h * 0.14}px ${t.shadow}`,
        display: 'flex',
        flexDirection: 'column',
        gap: h * 0.045,
      }}
    >
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={bar(w * 0.2, h * 0.04, line)} />
        <div style={{display: 'flex', gap: w * 0.03}}>
          <div style={bar(w * 0.09, h * 0.03, line)} />
          <div style={bar(w * 0.09, h * 0.03, line)} />
          <div style={bar(w * 0.09, h * 0.03, line)} />
        </div>
      </div>
      <div style={{height: heroH, borderRadius: h * 0.04, overflow: 'hidden', ...surf}} />
      <div style={bar(w * 0.72, h * 0.055, alpha(t.ink, 0.75))} />
      <div style={bar(w * 0.5, h * 0.035, line)} />
      <div style={bar(w * 0.3, h * 0.085, t.accent)} />
    </div>
  );
};

export const CloneGrid: React.FC<{
  title?: string;
  titleTimes?: number[];
  firstAt?: number;
  copyAt?: number;
  cols?: number;
  rows?: number;
}> = ({title, titleTimes, firstAt, copyAt, cols = 2, rows = 3}) => {
  const {start} = useScene();
  const {w, h, u} = useStage();
  const out = useExit(0.3);
  const at0 = firstAt ?? start + 0.05;
  const at1 = copyAt ?? at0 + 1;
  const n = cols * rows;

  const titleH = title ? 190 * u : 0;
  const gap = 34 * u;
  const pw = Math.min((w * 0.9 - gap * (cols - 1)) / cols, ((h - titleH - 40 * u - gap * (rows - 1)) / rows) * 1.22);
  const ph = pw / 1.22;
  const gw = pw * cols + gap * (cols - 1);
  const gh = ph * rows + gap * (rows - 1);
  const x0 = (w - gw) / 2;
  const y0 = titleH + (h - titleH - gh) / 2;

  const first = useSpringAt(at0, 'pop');
  const copies = Array.from({length: n}, (_, i) => useSpringAt(at1, 'pop', i * 3)); // 길이 고정 → 훅 순서 고정
  const lit = useSpringAt(at1 + 0.2, 'soft');

  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      {title ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: y0 - titleH, height: titleH, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <KText text={title} at={at1} times={titleTimes} size={120 * u} align="center" />
        </div>
      ) : null}
      {Array.from({length: n}, (_, i) => {
        const cx = x0 + (i % cols) * (pw + gap);
        const cy = y0 + Math.floor(i / cols) * (ph + gap);
        const s = i === 0 ? first : copies[i];
        // 복사본은 첫 장 자리에서 제자리로 미끄러진다
        // 첫 장은 무대 가운데에 크게 떠 있다가 copyAt 에 제자리로 줄어든다 (빈 화면 방지)
        const c0 = copies[0];
        const dx = i === 0 ? interpolate(c0, [0, 1], [w / 2 - pw / 2 - x0, 0]) : interpolate(s, [0, 1], [x0 - cx, 0]);
        const dy = i === 0 ? interpolate(c0, [0, 1], [h / 2 - ph / 2 - y0, 0]) : interpolate(s, [0, 1], [y0 - cy, 0]);
        const sc = i === 0 ? interpolate(s, [0, 1], [0.92, 1]) * interpolate(c0, [0, 1], [1.7, 1]) : interpolate(s, [0, 1], [0.92, 1]);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: cx,
              top: cy,
              opacity: Math.min(1, s * 2.5),
              transform: `translate(${dx}px, ${dy}px) scale(${sc})`,
              zIndex: n - i,
            }}
          >
            <Page w={pw} h={ph} lit={lit} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
