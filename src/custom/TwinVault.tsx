import React from 'react';
import {interpolate, spring, useVideoConfig} from 'remotion';
import {along, boxCorners, fitIso, IsoBox, IsoCoin, IsoFloor, IsoGlass, IsoMoney, proj, type Iso, type P3} from '../kit/Iso';
import {EASE, useNow, useProgress, useScene, useSpringAt} from '../kit/motion';
import {useStage} from '../kit/stage';
import {alpha, FONT, useTheme} from '../kit/theme';

/**
 * 같은 금고 두 개로 비교 (2.5D, 온돌 롱폼의 "같은 방 두 개" 참고): 두 금고에 같은 돈이 들어가고,
 * 왼쪽만 이자 동전이 하나씩 솟아 뚜껑 위에 쌓인다. 오른쪽은 그대로 — "이자 없음" 알약.
 * 글자 카드 둘(compare) 대신 그림이 차이를 보여 준다.
 *   props: left/right {label, at(동전이 들어가는 시각)} · interestAt(왼쪽 이자 시작) · noneAt + noneText(오른쪽 알약) · night
 */
export type TwinVaultProps = {
  left: {label: string; at: number};
  right: {label: string; at: number};
  interestAt: number;
  interestText?: string;
  noneAt?: number;
  noneText?: string;
  night?: boolean;
};

const VW = 2.2;
const VH = 2.2;

export const TwinVault: React.FC<TwinVaultProps> = (p) => {
  const {start, end} = useScene();
  const now = useNow();
  const {fps} = useVideoConfig();
  const {w, h, u} = useStage();
  const t = useTheme();
  const night = !!p.night;
  const line = night ? '#F3EDE2' : t.ink;
  const gold = t.triad.accent;
  // 두 금고는 x+y 가 같아 화면에서 나란히: 왼쪽 (0, 1.7), 오른쪽 (3.1, -1.4)
  const L = {x: 0, y: 1.7};
  const R = {x: 3.1, y: -1.4};
  const k: Iso = fitIso([...boxCorners(L.x, L.y, 0, VW, VW, VH + 1.9), ...boxCorners(R.x, R.y, 0, VW, VW, VH)], w, h, 0.8, h * 0.02);
  const appear = useSpringAt(start, 'soft');
  const labelK = useProgress(start + 0.2, 0.4, EASE.out);
  const glowId = `tv-glow-${Math.round(start * 100)}`;

  // 들어가는 돈: 각 금고에 at 부터 동전 4개가 위에서 떨어지고 금 층이 0.18 → 0.42 로
  const fillOf = (at: number) => interpolate(now, [at, at + 1.2], [0.18, 0.42], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.inOut});
  const drops = (at: number, v: {x: number; y: number}) =>
    [0, 1, 2, 3].flatMap((i) => {
      const q = (now - (at + i * 0.22)) / 0.55;
      if (q <= 0 || q >= 1) return [];
      const p0: P3 = [v.x + VW / 2, v.y + VW / 2, VH + 1.4];
      const p1: P3 = [v.x + VW / 2, v.y + VW / 2, VH * fillOf(at) + 0.1];
      return [<IsoCoin key={`d${at}-${i}`} k={k} p={along(p0, p1, EASE.in(q))} color={gold} opacity={q > 0.85 ? (1 - q) / 0.15 : 1} />];
    });

  // 이자: interestAt 부터 0.45초마다 동전이 금 층에서 솟아 뚜껑 위에 쌓인다 (최대 7개)
  const stack: React.ReactNode[] = [];
  for (let i = 0; i < 7; i++) {
    const at = p.interestAt + i * 0.45;
    if (now < at || at > end - 0.2) continue;
    const s = spring({frame: Math.round((now - at) * fps), fps, config: {damping: 13, stiffness: 160, mass: 0.7}});
    const top: P3 = [L.x + VW / 2, L.y + VW / 2, VH + 0.05 + i * 0.13];
    const from: P3 = [L.x + VW / 2, L.y + VW / 2, VH * fillOf(p.left.at)];
    stack.push(<IsoCoin key={`s${i}`} k={k} p={along(from, top, Math.min(1, s))} color={gold} r={0.34} />);
  }
  const interestK = useSpringAt(p.interestAt, 'pop');
  const noneK = useSpringAt(p.noneAt, 'pop');

  const vault = (v: {x: number; y: number}, at: number, glow: number) => {
    const gh = VH * fillOf(at);
    return (
      <g>
        <IsoGlass k={k} x={v.x} y={v.y} w={VW} d={VW} h={VH} line={line} part="back" />
        <g filter={`url(#${glowId})`} opacity={glow}>
          <IsoBox k={k} x={v.x + 0.14} y={v.y + 0.14} w={VW - 0.28} d={VW - 0.28} h={gh} color={gold} />
        </g>
        <IsoMoney k={k} x={v.x + 0.14} y={v.y + 0.14} w={VW - 0.28} d={VW - 0.28} h={gh} color={gold} />
        <IsoGlass k={k} x={v.x} y={v.y} w={VW} d={VW} h={VH} line={line} part="front" />
      </g>
    );
  };
  const pill = (text: string | undefined, kk: number, at: P3, tone: 'gold' | 'mute') => {
    if (!text || kk < 0.01) return null;
    const [x, y] = proj(k, at);
    return (
      <div
        style={{
          position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${kk})`,
          padding: `${10 * u}px ${28 * u}px`, borderRadius: 999, whiteSpace: 'nowrap',
          background: tone === 'gold' ? gold : night ? '#2A2622' : '#E4DED3', color: tone === 'gold' ? '#1A1408' : alpha(line, 0.7),
          fontFamily: FONT.sans, fontWeight: 800, fontSize: 44 * u, letterSpacing: '-0.02em',
        }}
      >
        {text}
      </div>
    );
  };
  const label = (text: string, v: {x: number; y: number}) => {
    const [x, y] = proj(k, [v.x + VW, v.y + VW, 0]);
    return (
      <div style={{position: 'absolute', left: x - 220 * u, top: y + 14 * u, width: 440 * u, textAlign: 'center', opacity: labelK, fontFamily: FONT.sans, fontWeight: 700, fontSize: 42 * u, color: alpha(line, 0.78)}}>
        {text}
      </div>
    );
  };
  const leftGlow = (night ? 0.55 : 0.3) + (night ? 0.4 : 0.25) * interestK;

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {night ? <div style={{position: 'absolute', inset: 0, borderRadius: 40 * u, background: '#14110E'}} /> : null}
      <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: appear}}>
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={k.S * 0.32} />
          </filter>
        </defs>
        <IsoFloor k={k} x0={-0.8} y0={-2} x1={6} y1={4.6} line={alpha(line, 0.07)} />
        {vault(R, p.right.at, night ? 0.5 : 0.25)}
        {drops(p.right.at, R)}
        {vault(L, p.left.at, leftGlow)}
        {drops(p.left.at, L)}
        {stack}
      </svg>
      {label(p.left.label, L)}
      {label(p.right.label, R)}
      {pill(p.interestText ?? '이자', interestK, [L.x + VW / 2, L.y + VW / 2, VH + 1.6], 'gold')}
      {pill(p.noneText, noneK, [R.x + VW / 2, R.y + VW / 2, VH + 0.9], 'mute')}
    </div>
  );
};
