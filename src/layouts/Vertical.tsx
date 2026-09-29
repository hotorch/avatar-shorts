import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from '../captions/Captions';
import {Backdrop} from '../kit/Backdrop';
import {EASE} from '../kit/motion';
import type {Plan, Scene} from '../plan';
import {AvatarVideo} from './Avatar';
import {SceneHost} from './SceneHost';

/**
 * 세로 쇼츠 (1080×1920)
 *  - 기본: 아바타 풀프레임 + 자막
 *  - panel: 화면 위쪽이 B-roll 판으로 내려오고, 아바타는 얼굴이 아래 칸에 오도록 내려간다 (분할 화면)
 *  - cutaway: 화면 전체가 B-roll (자막은 계속)
 *  - 1670px 아래는 플랫폼 UI 자리라 비워 둔다.
 */
export const W = 1080;
export const H = 1920;
const SAFE_TOP = 120;
const SPLIT = 1010; // 분할 시 위 칸 높이
const CAPTION_Y = 1470;

export const Vertical: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = frame / fps;
  const panels = plan.scenes.filter((s) => s.mode === 'panel');
  const cutaways = plan.scenes.filter((s) => s.mode !== 'panel');
  const split = amount(mergeRanges(panels), now, 0.4);
  const onCut = cutaways.some((s) => now >= s.in + 0.1 && now < s.out - 0.1);
  const faceY = plan.video?.faceY ?? 0.36;
  const shift = Math.max(0, Math.min(880, 1265 - faceY * H)) * split;

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* 아바타 */}
      <AbsoluteFill style={{transform: `translateY(${shift}px)`}}>
        <AvatarVideo video={plan.video} punch={plan.punch} />
      </AbsoluteFill>

      {/* 분할 패널: 위 칸 */}
      {split > 0.001 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: W,
            height: SPLIT,
            transform: `translateY(${(split - 1) * SPLIT}px)`,
            borderRadius: '0 0 48px 48px',
            overflow: 'hidden',
            boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
          }}
        >
          <Backdrop />
        </div>
      ) : null}
      {panels.map((s) => (
        <SceneHost
          key={s.id}
          scene={s}
          stage={{w: W, h: SPLIT - SAFE_TOP - 30, kind: 'panel'}}
          style={{top: SAFE_TOP, height: SPLIT - SAFE_TOP - 30, transform: `translateY(${(split - 1) * SPLIT}px)`}}
        />
      ))}

      {/* 전체 컷어웨이 */}
      {cutaways.map((s) => (
        <SceneHost
          key={s.id}
          scene={s}
          stage={{w: W, h: CAPTION_Y - SAFE_TOP - 40, kind: 'full'}}
          style={{top: SAFE_TOP, height: CAPTION_Y - SAFE_TOP - 40}}
          wrap={(children, clock) => (
            <CutawayWipe clock={clock} holdEnd={s.out >= plan.duration - 0.05}>
              {children}
            </CutawayWipe>
          )}
        />
      ))}

      <Captions cues={plan.captions} y={CAPTION_Y} maxW={960} size={64 * (plan.captionScale ?? 1)} bigSize={92 * (plan.captionScale ?? 1)} surface={onCut ? 'backdrop' : 'video'} />
    </AbsoluteFill>
  );
};

/** 컷어웨이 진입/퇴장: 둥근 사각 마스크가 가운데서 열리고 닫힌다 (0.3초, 감속) */
const CutawayWipe: React.FC<{clock: {start: number; end: number}; holdEnd?: boolean; children: React.ReactNode}> = ({clock, holdEnd, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = clock.start + frame / fps;
  const o = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
  const open = interpolate(now, [clock.start, clock.start + 0.32], [0, 1], {...o, easing: EASE.out});
  const close = holdEnd ? 0 : interpolate(now, [clock.end - 0.28, clock.end], [0, 1], {...o, easing: EASE.in});
  const k = open * (1 - close);
  const inset = (1 - k) * 50;
  return (
    <AbsoluteFill style={{clipPath: `inset(${inset}% ${inset * 0.9}% round ${40 + (1 - k) * 200}px)`}}>
      <Backdrop />
      {children}
    </AbsoluteFill>
  );
};

/** 겹치거나 0.6초 이내로 붙은 구간은 하나로 합친다 (분할 화면이 깜빡이지 않게) */
export const mergeRanges = (scenes: Scene[], gap = 0.6) => {
  const r = scenes.map((s) => [s.in, s.out] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const x of r) {
    const last = out[out.length - 1];
    if (last && x[0] - last[1] <= gap) last[1] = Math.max(last[1], x[1]);
    else out.push([...x]);
  }
  return out;
};

/** 구간 안이면 1, 밖이면 0 — 경계에서 dur 초 동안 부드럽게 */
export const amount = (ranges: [number, number][], now: number, dur: number) => {
  let k = 0;
  for (const [a, b] of ranges) {
    const d = Math.min(dur, (b - a) / 2.4);
    const v = interpolate(now, [a - 0.05, a + d, b - d * 0.8, b], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: EASE.inOut,
    });
    k = Math.max(k, v);
  }
  return k;
};
