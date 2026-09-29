import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Object3D} from '../kit/Object3D';
import {alpha, FONT, useTheme} from '../kit/theme';
import type {Plan} from '../plan';

/** 원본 아바타 영상. 영상이 없으면(데모) 자리표시 카드를 그린다. */
export const AvatarVideo: React.FC<{video: Plan['video']; style?: React.CSSProperties; muted?: boolean; punch?: Plan['punch']; punchK?: number}> = ({
  video,
  style,
  muted,
  punch,
  punchK = 1,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  if (!video?.src) return <Placeholder />;
  const src = video.src.startsWith('http') ? video.src : staticFile(video.src);
  // 펀치인: 컷 순간에만 배율이 바뀐다 (컷이 가려 주므로 보간 없음). 얼굴 중심 기준.
  const now = frame / fps;
  // punchK: 판·카드 배치 중엔 배치가 화면을 정하므로 펀치인을 뺀다 (0 = 펀치인 없음)
  const scale = 1 + (([...(punch ?? [])].reverse().find((p) => now >= p.t)?.scale ?? 1) - 1) * punchK;
  const origin = `${(video.faceX ?? 0.5) * 100}% ${(video.faceY ?? 0.36) * 100}%`;
  return (
    <OffthreadVideo
      src={src}
      muted={muted}
      style={{width: '100%', height: '100%', objectFit: 'cover', transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: origin, ...style}}
    />
  );
};

const Placeholder: React.FC = () => {
  const t = useTheme();
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${t.dark ? '#2a3038' : '#d9d3c6'}, ${t.dark ? '#171b20' : '#bdb4a3'})`,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      <div style={{width: 360, height: 360, position: 'relative'}}>
        <Object3D name="boy" material="clay" size={360} float={6} exit={false} shadow={false} x={180} y={180} />
      </div>
      <div style={{fontFamily: FONT.sans, fontWeight: 700, fontSize: 36, color: alpha(t.dark ? '#ffffff' : '#000000', 0.45)}}>아바타 영상 자리</div>
    </AbsoluteFill>
  );
};
