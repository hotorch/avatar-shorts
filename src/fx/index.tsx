import React from 'react';
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from 'remotion';
import {fxBox} from '../layouts/framing.js';
import type {Plan, Scene} from '../plan';
import {FreezeFrame, GlassChart, GradeWipe, OverShoulder, TextBehind, TierList} from './effects';
import type {FxPresenter, Track, Word} from './fx';

// plan.json 의 mode "fx" 장면: template 이름 → 효과. 고르는 기준은 정책 presenterFx (scripts/fx-rules.mjs 가 검사)
export const FX_EFFECTS: Record<string, React.FC<any>> = {
  freeze: FreezeFrame, // 몸짓 정점에서 정지 + 흰 테두리 스티커 + 이름표
  'text-behind': TextBehind, // 머리 뒤에서 큰 단어 하나가 솟는다
  shoulder: OverShoulder, // 발표자를 줄이고 양 어깨 뒤 유리 카드 2장
  'grade-wipe': GradeWipe, // 세로선이 쓸며 보정본으로 (BEFORE/AFTER)
  tier: TierList, // 발표자를 올리고 가슴 아래 S~D 패널
  'glass-chart': GlassChart, // 가슴 위 유리 카드, 합계가 오르고 막대가 솟음
};

/** render 가 fx 장면에 채워 넣는 것: 오려내기 경로와 track (scripts/fx_matte.py), 장면 안 단어(장면 기준 초) */
export type FxScene = Scene & {fx?: {cutout: string; track: Track}; props: Scene['props'] & {words?: Word[]}};

/** fx 장면 하나를 발표자 자리에 그린다 (불투명 — 아래 얼굴 화면을 덮고, 목소리는 아래 영상에서 계속 나온다) */
export const FxHost: React.FC<{scene: FxScene; video: Plan['video']; punch: Plan['punch']}> = ({scene, video, punch}) => {
  const {fps} = useVideoConfig();
  const from = Math.round(scene.in * fps);
  const dur = Math.max(1, Math.round(scene.out * fps) - from);
  const Comp = FX_EFFECTS[scene.template];
  if (!Comp || !scene.fx || !video?.src) return null; // render --check 가 먼저 막는다
  const scale = [...(punch ?? [])].reverse().find((p) => scene.in >= p.t)?.scale ?? 1;
  const p: FxPresenter = {clip: video.src, cutout: scene.fx.cutout, track: scene.fx.track, box: fxBox(video, scale), aspect: video.height / video.width};
  return (
    <Sequence from={from} durationInFrames={dur} layout="none" name={`${scene.id} fx:${scene.template}`}>
      <FxBody Comp={Comp} props={{...scene.props, p, start: from / fps, dur: dur / fps, words: scene.props.words ?? []}} />
    </Sequence>
  );
};

const FxBody: React.FC<{Comp: React.FC<any>; props: Record<string, unknown>}> = ({Comp, props}) => {
  const lf = useCurrentFrame();
  return (
    <AbsoluteFill>
      <Comp {...props} lf={lf} />
    </AbsoluteFill>
  );
};
