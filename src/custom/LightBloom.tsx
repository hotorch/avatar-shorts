import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {GhostText, KText} from '../kit/KText';
import {EASE, useNow, useScene, useSpringAt} from '../kit/motion';
import {ObjIcon} from '../kit/Object3D';
import {Card} from '../kit/Parts';
import {useStage} from '../kit/stage';
import {alpha, useTheme} from '../kit/theme';

// 빛 번짐 전환: 화면 A 카드 → bloomAt 에 가운데서 빛이 번지며 화면 B 카드로 바뀐다.
// 빛은 한 번만, 부드럽게 (피크 0.35초, 0.7초 안에 사라짐).
export const LightBloom: React.FC<{
  from: string;
  to: string;
  bloomAt: number;
  title?: string;
  titleTimes?: number[];
  ghost?: string;
}> = ({from, to, bloomAt, title, titleTimes, ghost}) => {
  const {start} = useScene();
  const {w, h, u, wide} = useStage();
  const t = useTheme();
  const now = useNow();
  const o = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};

  // 빛: 반경은 감속으로 퍼지고, 밝기는 올라갔다 내려간다
  const spread = interpolate(now, [bloomAt - 0.25, bloomAt + 0.45], [0.15, 1.35], {...o, easing: EASE.out});
  const glow = interpolate(now, [bloomAt - 0.25, bloomAt + 0.08, bloomAt + 0.75], [0, 0.92, 0], o);
  // 카드 교체는 빛이 가장 밝을 때
  const swap = interpolate(now, [bloomAt - 0.02, bloomAt + 0.12], [0, 1], o);
  const reveal = useSpringAt(bloomAt + 0.04, 'pop');

  const cw = (wide ? 520 : 600) * u;
  const ch = cw * 0.72;
  const cy = h * (wide ? 0.4 : 0.42) - ch / 2; // 카드 위쪽 모서리
  const R = Math.hypot(w, h) * 0.55 * spread;

  return (
    <AbsoluteFill>
      {ghost ? <GhostText text={ghost} at={start} /> : null}

      <div style={{opacity: 1 - swap}}>
        <Card at={start + 0.05} w={cw} h={ch} x={w / 2} y={cy + ch / 2} z={0.6} tone="paper">
          <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <ObjIcon name={from} size={260 * u} />
          </div>
        </Card>
      </div>

      <div
        style={{
          opacity: swap,
          transform: `scale(${interpolate(reveal, [0, 1], [0.92, 1])})`,
          transformOrigin: `${w / 2}px ${cy + ch / 2}px`,
          position: 'absolute',
          inset: 0,
        }}
      >
        <Card at={bloomAt} w={cw} h={ch} x={w / 2} y={cy + ch / 2} z={0.6} tone={t.surface === 'gradient' ? 'gradient' : 'deep'} from="scale">
          <div style={{width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <ObjIcon name={to} size={260 * u} />
          </div>
        </Card>
      </div>

      {/* 번지는 빛 */}
      <div
        style={{
          position: 'absolute',
          left: w / 2 - R,
          top: cy + ch / 2 - R,
          width: R * 2,
          height: R * 2,
          borderRadius: '50%',
          opacity: glow,
          background: `radial-gradient(circle, ${alpha('#FFFFFF', 0.95)} 0%, ${alpha('#FFF3DC', 0.75)} 22%, ${alpha(t.accent, 0.35)} 48%, ${alpha(t.accent, 0)} 72%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      {title ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: cy + ch + 90 * u, display: 'flex', justifyContent: 'center'}}>
          <KText text={title} at={start + 0.3} times={titleTimes} size={(wide ? 96 : 120) * u} align="center" />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
