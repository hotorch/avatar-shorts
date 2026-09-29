import React from 'react';
import {AbsoluteFill} from 'remotion';
import {KText} from '../kit/KText';
import {useNow, useScene, useSpringAt} from '../kit/motion';
import {ObjIcon, Object3D} from '../kit/Object3D';
import {useStage} from '../kit/stage';
import {alpha, useTheme} from '../kit/theme';

// 커스텀 장면 예시: 가운데 오브젝트 주위로 작은 오브젝트들이 궤도를 돈다.
// 새 장면을 만들 때 이 파일을 복사해서 시작하면 된다. (kit 의 부품만 조합)
export const OrbitIdea: React.FC<{center: string; satellites: string[]; title: string; titleTimes?: number[]}> = ({
  center,
  satellites,
  title,
  titleTimes,
}) => {
  const {start} = useScene();
  const {w, h, u, wide} = useStage();
  const t = useTheme();
  const now = useNow();
  const R = Math.min(w, h) * (wide ? 0.34 : 0.3);
  const cx = wide ? w * 0.32 : w / 2;
  const cy = wide ? h / 2 : h * 0.4;
  return (
    <AbsoluteFill>
      <svg width={w} height={h} style={{position: 'absolute'}}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={alpha(t.ink, 0.12)} strokeWidth={2} strokeDasharray="4 12" />
      </svg>
      <Object3D name={center} at={start + 0.1} size={320 * u} x={cx} y={cy} />
      {satellites.map((name, i) => (
        <Satellite key={name} name={name} at={start + 0.4 + i * 0.18} angle={(i / satellites.length) * Math.PI * 2 + now * 0.35} cx={cx} cy={cy} R={R} size={130 * u} />
      ))}
      <div style={{position: 'absolute', left: wide ? w * 0.6 : 0, right: wide ? w * 0.04 : 0, top: wide ? h * 0.38 : h * 0.72, display: 'flex', justifyContent: 'center'}}>
        <KText text={title} at={start + 0.5} times={titleTimes} size={(wide ? 90 : 110) * u} align={wide ? 'left' : 'center'} />
      </div>
    </AbsoluteFill>
  );
};

const Satellite: React.FC<{name: string; at: number; angle: number; cx: number; cy: number; R: number; size: number}> = ({name, at, angle, cx, cy, R, size}) => {
  const s = useSpringAt(at, 'pop');
  const r = R * s;
  return (
    <div style={{position: 'absolute', left: cx + Math.cos(angle) * r - size / 2, top: cy + Math.sin(angle) * r * 0.9 - size / 2, transform: `scale(${s})`}}>
      <ObjIcon name={name} size={size} />
    </div>
  );
};
