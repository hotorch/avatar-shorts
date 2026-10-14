import React from 'react';
import {AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {SceneCtx} from '../kit/motion';
import {StageCtx, type Stage} from '../kit/stage';
import {resolveScene} from '../scenes';
import type {Scene, SceneCamera} from '../plan';
import {FONT} from '../kit/theme';

export const sceneFrames = (s: Scene, fps: number) => {
  const from = Math.round(s.in * fps);
  const dur = Math.max(1, Math.round(s.out * fps) - from);
  return {from, dur, start: from / fps, end: (from + dur) / fps};
};

/**
 * 장면 안 카메라 (온돌 롱폼 참고: 그림이 멈춰 있지 않고 카메라가 천천히 다가간다).
 *  - drift: 장면 처음→끝 1 → 1+drift 느린 줌인 (가운데 기준). 들어온 뒤 가만히 서 있으면 PPT 처럼 보인다
 *  - camera: at 초부터 dur 초 동안 무대의 (x, y) 를 가운데 쪽으로 당기며 scale 배 — 대사가 세부를 가리킬 때
 */
const CameraRig: React.FC<{start: number; end: number; drift: number; camera?: SceneCamera; children: React.ReactNode}> = ({start, end, drift, camera, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = start + frame / fps;
  const k = interpolate(now, [start, end], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.sin)});
  let s = 1 + drift * k;
  let tx = 0;
  let ty = 0;
  let origin = '50% 50%';
  if (camera) {
    const c = interpolate(now, [camera.at, camera.at + (camera.dur ?? 0.8)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
    s *= 1 + (camera.scale - 1) * c;
    // 초점 (x, y) 을 기준으로 키우고, 그 점을 가운데 쪽으로 절반쯤 끌어온다
    origin = `${camera.x * 100}% ${camera.y * 100}%`;
    tx = (0.5 - camera.x) * 50 * c;
    ty = (0.5 - camera.y) * 50 * c;
  }
  if (s === 1 && !tx && !ty) return <>{children}</>;
  return (
    <div style={{position: 'absolute', inset: 0, transform: `translate(${tx}%, ${ty}%) scale(${s})`, transformOrigin: origin}}>{children}</div>
  );
};

/** 장면 하나를 원본 시간 [in, out] 에 올려놓는다. 템플릿은 원본 기준 초를 그대로 쓴다. */
export const SceneHost: React.FC<{
  scene: Scene;
  stage: Stage;
  style?: React.CSSProperties;
  wrap?: (children: React.ReactNode, clock: {start: number; end: number}) => React.ReactNode;
  /** 느린 줌인 배율 (plan.cameraDrift) */
  drift?: number;
}> = ({scene, stage, style, wrap, drift = 0}) => {
  const {fps, durationInFrames} = useVideoConfig();
  const durationSec = durationInFrames / fps;
  const {from, dur, start, end} = sceneFrames(scene, fps);
  const Comp = resolveScene(scene.template, scene.component);
  const body = Comp ? (
    <CameraRig start={start} end={end} drift={drift} camera={scene.camera}>
      <Comp {...scene.props} />
    </CameraRig>
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
