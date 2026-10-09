import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {KText} from '../kit/KText';
import {useNow, useScene} from '../kit/motion';
import {Card} from '../kit/Parts';
import {useStage} from '../kit/stage';
import {FONT, alpha, useTheme} from '../kit/theme';

// 글꼴 견본: 글꼴 이름을 그 글꼴로 크게 써서 보여 준다 ("얇은 명조", "고딕", "손글씨").
// 카드 한 장 = 대사 한 비트. 새 카드가 나오면 앞 카드는 옅어진다.
const FAMILY: Record<string, string> = {
  myeongjo: FONT.myeongjo,
  sans: FONT.sans,
  hand: '"Hakgyoansim Allimjang", sans-serif',
  serif: FONT.serif,
  mono: FONT.mono,
};

type Item = {sample: string; label?: string; font: keyof typeof FAMILY | string; weight?: number; at?: number};

export const TypeSpecimen: React.FC<{
  items: Item[];
  title?: string;
  titleTimes?: number[];
}> = ({items, title, titleTimes}) => {
  const {start} = useScene();
  const {w, h, u, wide} = useStage();
  const t = useTheme();
  const now = useNow();
  const o = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

  const n = Math.max(1, items.length);
  const titleH = title ? 150 * u : 0;
  const gap = 28 * u;
  const cw = w * (wide ? 0.78 : 0.84); // 위 칸 판은 u 가 작아서(높이 기준) 폭은 무대 폭으로
  const ch = Math.min(cw * 0.3, (h - titleH - 100 * u - gap * (n - 1)) / n);
  const top = (h - titleH - (ch * n + gap * (n - 1))) / 2 + titleH;
  const ats = items.map((it, i) => it.at ?? start + 0.1 + i * 0.8);

  return (
    <AbsoluteFill>
      {title ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: top - titleH, height: titleH, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <KText text={title} at={start + 0.05} times={titleTimes} size={(wide ? 80 : 96) * u} align="center" />
        </div>
      ) : null}
      {items.map((it, i) => {
        const next = ats[i + 1];
        const dim = next === undefined ? 0 : interpolate(now, [next - 0.05, next + 0.3], [0, 1], o);
        const y = top + i * (ch + gap) + ch / 2;
        const active = dim < 0.5;
        return (
          <div key={i} style={{opacity: 1 - dim * 0.45}}>
            <Card at={ats[i]} w={cw} h={ch} x={w / 2} y={y} z={0.3 + i * 0.15} from={i % 2 ? 'right' : 'left'} tone="paper" pad={0}>
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: `0 ${ch * 0.3}px`,
                  boxSizing: 'border-box',
                  borderRadius: 28,
                  outline: active ? `${4 * u}px solid ${alpha(t.accent, 0.85)}` : 'none',
                  outlineOffset: -4 * u,
                }}
              >
                <div
                  style={{
                    fontFamily: FAMILY[it.font] ?? it.font,
                    fontWeight: it.weight ?? 400,
                    fontSize: ch * 0.52,
                    lineHeight: 1,
                    color: t.ink,
                    wordBreak: 'keep-all',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.sample}
                </div>
                {it.label ? (
                  <div
                    style={{
                      fontFamily: FONT.sans,
                      fontWeight: 700,
                      fontSize: ch * 0.2,
                      color: active ? t.accent : t.muted,
                      padding: `${ch * 0.05}px ${ch * 0.12}px`,
                      borderRadius: 999,
                      background: alpha(t.accent, active ? 0.12 : 0.06),
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {it.label}
                  </div>
                ) : null}
              </div>
            </Card>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
