import React from 'react';
import {Video} from '@remotion/media';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Object3D} from '../kit/Object3D';
import {alpha, FONT, useTheme} from '../kit/theme';
import type {Plan} from '../plan';

/**
 * 원본 아바타 영상. 영상이 없으면(데모) 자리표시 카드를 그린다.
 * <OffthreadVideo> 가 아니라 @remotion/media 의 <Video>: OffthreadVideo 는 남은 메모리가 100MB 아래로 잠깐만 떨어져도
 * 프레임 캐시를 반씩 영영 줄여 0 이 되면 "No frame found at position" 으로 렌더를 죽인다 (롱폼 ep01-long, 16GB PC).
 * <Video> 는 탭 안에서 풀어 메모리가 모자라면 느려질 뿐 멈추지 않는다. 같은 프레임이 나오는 것은 확인함 (PSNR 53dB).
 */
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
  const matte = video.matte;
  if (matte) {
    // 배경 지운 사람(matte.py)만, 원본에서 잘라 낸 자리에 그대로 (원본과 같은 비율의 상자 안이라야 % 가 맞는다). 바탕은 레이아웃이 그린다
    const m = matte.src.startsWith('http') ? matte.src : staticFile(matte.src);
    const pct = (v: number, of: number) => `${(v / of) * 100}%`;
    return (
      <div style={{position: 'relative', width: '100%', height: '100%', transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: origin, ...style}}>
        <div style={{position: 'absolute', left: pct(matte.crop.x, video.width), top: pct(matte.crop.y, video.height), width: pct(matte.crop.w, video.width), height: pct(matte.crop.h, video.height)}}>
          <Video src={m} muted={muted} objectFit="fill" style={{width: '100%', height: '100%'}} />
        </div>
      </div>
    );
  }
  const inset = video.inset;
  if (!inset) {
    return (
      <Video
        src={src}
        muted={muted}
        objectFit="cover"
        style={{width: '100%', height: '100%', transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: origin, ...style}}
      />
    );
  }
  // 바깥 띠(아바타 도구가 인물 화면을 줄여 넣은 단색 테두리, probe.py inset_frame)를 안쪽 배경색으로 덮는다.
  // 영상과 같은 비율의 상자 안이라야 % 가 맞는다 (Side 카드 안쪽 상자 · 세로 전체 화면). 펀치인은 띠와 함께.
  const pad = 0.004; // 경계 몇 px 겹쳐 이음매가 안 보이게
  const band = (s: React.CSSProperties, color: string) => <div style={{position: 'absolute', background: color, ...s}} />;
  return (
    <div style={{position: 'relative', width: '100%', height: '100%', overflow: 'hidden', transform: scale !== 1 ? `scale(${scale})` : undefined, transformOrigin: origin, ...style}}>
      <Video src={src} muted={muted} objectFit="cover" style={{width: '100%', height: '100%'}} />
      {inset.left > 0 ? band({left: 0, top: 0, bottom: 0, width: `${(inset.left + pad) * 100}%`}, inset.colors.left) : null}
      {inset.right > 0 ? band({right: 0, top: 0, bottom: 0, width: `${(inset.right + pad) * 100}%`}, inset.colors.right) : null}
      {inset.top > 0 ? band({left: 0, right: 0, top: 0, height: `${(inset.top + pad) * 100}%`}, inset.colors.top) : null}
    </div>
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
