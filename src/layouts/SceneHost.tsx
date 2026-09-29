import React from 'react';
import {AbsoluteFill, Sequence, useVideoConfig} from 'remotion';
import {SceneCtx} from '../kit/motion';
import {StageCtx, type Stage} from '../kit/stage';
import {resolveScene} from '../scenes';
import type {Scene} from '../plan';
import {FONT} from '../kit/theme';

export const sceneFrames = (s: Scene, fps: number) => {
  const from = Math.round(s.in * fps);
  const dur = Math.max(1, Math.round(s.out * fps) - from);
  return {from, dur, start: from / fps, end: (from + dur) / fps};
};

/** 장면 하나를 원본 시간 [in, out] 에 올려놓는다. 템플릿은 원본 기준 초를 그대로 쓴다. */
export const SceneHost: React.FC<{
  scene: Scene;
  stage: Stage;
  style?: React.CSSProperties;
  wrap?: (children: React.ReactNode, clock: {start: number; end: number}) => React.ReactNode;
}> = ({scene, stage, style, wrap}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const {from, dur, start, end} = sceneFrames(scene, fps);
  const Comp = resolveScene(scene.template, scene.component);
  const body = Comp ? (
    <Comp {...scene.props} />
  ) : (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', fontFamily: FONT.mono, fontSize: 40, color: '#c00'}}>
      템플릿 없음: {scene.template} {scene.component ?? ''}
    </AbsoluteFill>
  );
  return (
    <Sequence from={from} durationInFrames={dur} layout="none" name={`${scene.id} ${scene.template}`}>
      <SceneCtx.Provider value={{start, end, hold: scene.out >= durationSec - 0.05}}>
        <StageCtx.Provider value={stage}>
          {wrap ? (
            wrap(<div style={{position: 'absolute', inset: 0, ...style}}>{body}</div>, {start, end})
          ) : (
            <div style={{position: 'absolute', inset: 0, ...style}}>{body}</div>
          )}
        </StageCtx.Provider>
      </SceneCtx.Provider>
    </Sequence>
  );
};

/** 지금(원본 기준 초) 활성인 장면 */
export const activeScene = (scenes: Scene[], now: number) => scenes.find((s) => now >= s.in && now < s.out);
