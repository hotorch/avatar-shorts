import React from 'react';
import {interpolate} from 'remotion';
import {along, boxCorners, coinStream, fitIso, IsoBox, IsoCoin, IsoFloor, IsoGlass, IsoMoney, proj, type P3} from '../kit/Iso';
import {EASE, useNow, useProgress, useScene, useSpringAt} from '../kit/motion';
import {useStage} from '../kit/stage';
import {alpha, FONT, useTheme} from '../kit/theme';

/**
 * 돈이 모여 쌓이는 구조 (2.5D): 왼쪽 카드 더미에서 동전이 포물선으로 날아가 오른쪽 유리 금고에 쌓이고, 금고 속 금괴 층이 차오른다.
 * 글자는 작은 이름표 둘 + (말한) 숫자 알약 하나뿐 — 그림이 "선수금이 쌓인다" 를 설명한다 (온돌 롱폼 참고).
 *   props: flowAt(동전이 날기 시작, 원본 초) · flowUntil · fill(0~1 최종 높이) · source/target 이름표 · pill {text, at} · night(어두운 판 + 빛)
 */
export type CoinVaultProps = {
  flowAt: number;
  flowUntil?: number;
  fill?: number;
  source?: string;
  target?: string;
  pill?: {text: string; at: number};
  night?: boolean;
};

export const CoinVault: React.FC<CoinVaultProps> = (p) => {
  const {start} = useScene();
  const now = useNow();
  const {w, h, u} = useStage();
  const t = useTheme();
  const night = !!p.night;
  const line = night ? '#F3EDE2' : t.ink;
  const gold = t.triad.accent;
  const card = t.triad.dark;
  const until = p.flowUntil ?? p.flowAt + 1.6;

  // 무대: 카드 더미 (0, 2.4) · 금고 (3.4, -0.8) 2.4×2.4×2.6
  const V = {x: 3.4, y: -0.8, w: 2.4, d: 2.4, h: 2.6};
  // 맞추는 범위 = 카드 더미 + 금고 + 그 위 알약 자리 (바닥 격자는 넘쳐도 된다)
  const k = fitIso([...boxCorners(-0.2, 2.3, 0, 2.1, 1.6, 0.4), ...boxCorners(V.x, V.y, 0, V.w, V.d, V.h + 1.1)], w, h, 0.8, h * 0.03);

  const appear = useSpringAt(start, 'soft');
  const level = interpolate(now, [p.flowAt + 0.5, until + 0.9], [0, p.fill ?? 0.72], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.inOut});
  const pillK = useSpringAt(p.pill?.at, 'pop');
  const labelK = useProgress(start + 0.2, 0.4, EASE.out);
  const glowId = `cv-glow-${Math.round(start * 100)}`;

  const from: P3 = [0.95, 2.95, 0.42];
  const to: P3 = [V.x + V.w / 2, V.y + V.d / 2, Math.max(0.4, level * V.h) + 0.2];
  const coins = coinStream(now, p.flowAt, until, 14, 0.85);
  const goldH = level * V.h;

  const label = (text: string | undefined, at: P3, dy = 0) => {
    if (!text) return null;
    const [x, y] = proj(k, at);
    return (
      <div
        style={{
          position: 'absolute', left: x - 200 * u, top: y + dy, width: 400 * u, textAlign: 'center', opacity: labelK,
          fontFamily: FONT.sans, fontWeight: 700, fontSize: 40 * u, color: alpha(line, 0.75), letterSpacing: '-0.01em',
        }}
      >
        {text}
      </div>
    );
  };

  return (
    <div style={{position: 'absolute', inset: 0}}>
      {night ? (
        <div style={{position: 'absolute', inset: 0, borderRadius: 40 * u, overflow: 'hidden', background: '#14110E'}}>
          <div
            style={{
              position: 'absolute', inset: 0,
              background: `radial-gradient(circle at ${(proj(k, to)[0] / w) * 100}% ${(proj(k, [to[0], to[1], 0])[1] / h) * 100}%, ${alpha(gold, 0.18 + 0.32 * level)} 0%, transparent 55%)`,
            }}
          />
        </div>
      ) : null}
      <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible', opacity: appear}}>
        <defs>
          <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={k.S * 0.35} />
          </filter>
        </defs>
        <IsoFloor k={k} x0={-0.6} y0={-1.6} x1={6.6} y1={3.8} line={alpha(line, night ? 0.08 : 0.07)} />
        {/* 카드 더미 (손님들이 충전한 카드) */}
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <IsoBox k={k} x={0.1 - i * 0.12} y={2.4 + i * 0.1} z={i * 0.13} w={1.75} d={1.1} h={0.1} color={card} />
            <IsoBox k={k} x={0.1 - i * 0.12} y={2.62 + i * 0.1} z={i * 0.13 + 0.1} w={1.75} d={0.16} h={0.005} color={gold} opacity={0.9} />
          </g>
        ))}
        {/* 금고: 뒤 면 → 금 → 앞 면 */}
        <IsoGlass k={k} {...V} line={line} part="back" />
        {goldH > 0.01 ? (
          <>
            <g filter={`url(#${glowId})`} opacity={night ? 0.85 : 0.45}>
              <IsoBox k={k} x={V.x + 0.15} y={V.y + 0.15} w={V.w - 0.3} d={V.d - 0.3} h={goldH} color={gold} />
            </g>
            <IsoMoney k={k} x={V.x + 0.15} y={V.y + 0.15} w={V.w - 0.3} d={V.d - 0.3} h={goldH} color={gold} />
          </>
        ) : null}
        <IsoGlass k={k} {...V} line={line} part="front" />
        {/* 날아가는 동전 */}
        {coins.map(({u: q, i}) => (
          <IsoCoin key={i} k={k} p={along(from, to, EASE.inOut(q), 1.6)} color={gold} r={0.32} opacity={q > 0.92 ? (1 - q) / 0.08 : 1} />
        ))}
      </svg>
      {label(p.source, [0.75, 3.75, 0], 26 * u)}
      {label(p.target, [V.x + V.w, V.y + V.d, 0], 10 * u)}
      {p.pill && pillK > 0.01 ? (() => {
        const [x, y] = proj(k, [V.x + V.w / 2, V.y + V.d / 2, V.h + 0.75]);
        return (
          <div
            style={{
              position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${pillK})`,
              padding: `${14 * u}px ${34 * u}px`, borderRadius: 999, background: gold, color: '#1A1408',
              fontFamily: FONT.sans, fontWeight: 900, fontSize: 64 * u, letterSpacing: '-0.03em', whiteSpace: 'nowrap',
              boxShadow: `0 ${10 * u}px ${30 * u}px ${alpha(gold, 0.35)}`,
            }}
          >
            {p.pill.text}
          </div>
        );
      })() : null}
    </div>
  );
};
