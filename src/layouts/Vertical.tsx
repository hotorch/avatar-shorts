import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from '../captions/Captions';
import {Backdrop} from '../kit/Backdrop';
import {EASE} from '../kit/motion';
import {alpha, useTheme} from '../kit/theme';
import type {Plan, Scene} from '../plan';
import {AvatarVideo} from './Avatar';
import {buildFraming, faceFrame, FRAME, frameAt, ramp, type Segment} from './framing.js';
import {SceneHost} from './SceneHost';

/**
 * 세로 쇼츠 (1080×1920). 아바타와 B-roll 자리는 framing.js 가 머리 위치(video.json track)로 정한다.
 *  - 기본: 아바타 풀프레임 + 자막 (자막은 턱 아래)
 *  - panel: 위 칸이 B-roll 판. 정수리가 판 아래 36px 에 오도록 아바타를 내린다 (머리가 크면 판을 줄인다)
 *  - above: 머리 위에 떠 있는 카드 (모자라면 아바타를 내리고 드러난 위쪽은 흐린 영상)
 *  - below: 턱 아래 가슴 쪽 카드
 *  - cutaway: 화면 전체가 B-roll (자막은 계속)
 *  - 1670px 아래는 플랫폼 UI 자리라 비워 둔다.
 */
export const W = FRAME.W;
export const H = FRAME.H;
const SAFE_TOP = FRAME.SAFE_TOP;

export const Vertical: React.FC<{plan: Plan}> = ({plan}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = frame / fps;
  const segs = useMemo(() => buildFraming(plan.scenes, plan.video), [plan.scenes, plan.video]);
  const base = useMemo(() => faceFrame(plan.video), [plan.video]);
  const f = frameAt(segs, base, now);
  const cutaways = plan.scenes.filter((s) => s.mode === 'cutaway');
  const onCut = cutaways.some((s) => now >= s.in + 0.1 && now < s.out - 0.1);

  // 영상이 화면을 다 못 덮는 쪽(내리거나 줄였을 때)은 가장자리를 부드럽게 지워 흐린 영상과 잇는다
  const fadeTop = f.ty > 0 ? Math.min(160, f.ty) / f.s : 0;
  const fadeBottom = Math.max(0, H - (f.s * H + f.ty)) > 0 ? Math.min(160, H - (f.s * H + f.ty)) / f.s : 0;
  const fadeSide = f.s < 1 ? Math.min(120, (W - f.s * W) / 2) / f.s : 0;
  const masks = [
    fadeTop || fadeBottom ? `linear-gradient(to bottom, transparent 0, #000 ${fadeTop}px, #000 calc(100% - ${fadeBottom}px), transparent 100%)` : null,
    fadeSide ? `linear-gradient(to right, transparent 0, #000 ${fadeSide}px, #000 calc(100% - ${fadeSide}px), transparent 100%)` : null,
  ].filter(Boolean) as string[];
  const mask: React.CSSProperties = masks.length
    ? {WebkitMaskImage: masks.join(', '), maskImage: masks.join(', '), WebkitMaskComposite: 'source-in', maskComposite: 'intersect'}
    : {};

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* 채움: 흐린 같은 영상 (아바타가 화면을 다 못 덮을 때만) */}
      {f.fill > 0.001 && plan.video?.src ? (
        <AbsoluteFill style={{opacity: f.fill, overflow: 'hidden'}}>
          <AvatarVideo video={plan.video} muted style={{filter: 'blur(44px) brightness(0.62) saturate(1.15)', transform: 'scale(1.3)'}} />
        </AbsoluteFill>
      ) : null}

      {/* 아바타 */}
      <AbsoluteFill style={{transform: `translate(${f.tx}px, ${f.ty}px) scale(${f.s})`, transformOrigin: '0 0', ...mask}}>
        <AvatarVideo video={plan.video} punch={plan.punch} punchK={1 - f.k} />
      </AbsoluteFill>

      {segs.map((g, i) => (g.mode === 'panel' ? <PanelSegment key={i} g={g} now={now} /> : <FloatSegment key={i} g={g} />))}

      {/* 전체 컷어웨이 */}
      {cutaways.map((s) => (
        <SceneHost
          key={s.id}
          scene={s}
          stage={{w: W, h: FRAME.CAPTION_Y - SAFE_TOP - 40, kind: 'full'}}
          style={{top: SAFE_TOP, height: FRAME.CAPTION_Y - SAFE_TOP - 40}}
          wrap={(children, clock) => (
            <CutawayWipe clock={clock} holdEnd={s.out >= plan.duration - 0.05}>
              {children}
            </CutawayWipe>
          )}
        />
      ))}

      <Captions
        cues={plan.captions}
        y={onCut ? FRAME.CAPTION_Y : f.capY}
        maxW={960}
        size={64 * (plan.captionScale ?? 1)}
        bigSize={92 * (plan.captionScale ?? 1)}
        surface={onCut ? 'backdrop' : 'video'}
      />
    </AbsoluteFill>
  );
};

/** 분할: 위 칸 판이 내려오고, 판 높이는 머리 크기에 맞춘 값 */
const PanelSegment: React.FC<{g: Segment; now: number}> = ({g, now}) => {
  const k = ramp(g.in, g.out, now);
  const P = g.fit.panel ?? 1010;
  if (k <= 0.001) return null;
  const y = (k - 1) * P;
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: P,
          transform: `translateY(${y}px)`,
          borderRadius: '0 0 48px 48px',
          overflow: 'hidden',
          boxShadow: '0 30px 60px rgba(0,0,0,0.35)',
        }}
      >
        <Backdrop />
      </div>
      {g.scenes.map((s) => (
        <SceneHost
          key={s.id}
          scene={s}
          stage={{w: W, h: P - SAFE_TOP - 30, kind: 'panel'}}
          style={{top: SAFE_TOP, height: P - SAFE_TOP - 30, transform: `translateY(${y}px)`}}
        />
      ))}
    </>
  );
};

/** 머리 위/아래 카드: 장면마다 유리 카드가 머리 쪽에서 살짝 밀려 나오며 열린다. morph 는 자기 모양이 카드라 유리판 없이 */
const FloatSegment: React.FC<{g: Segment}> = ({g}) => {
  const box = g.fit.box!;
  return (
    <>
      {g.scenes.map((s: Scene) => (
        <SceneHost
          key={s.id}
          scene={s}
          stage={{w: box.w, h: box.h, kind: 'float', anchor: g.mode === 'above' ? 'end' : 'start'}}
          wrap={(children, clock) => (
            <FloatCard box={box} clock={clock} from={g.mode === 'above' ? 1 : -1} glass={s.template !== 'morph'}>
              {children}
            </FloatCard>
          )}
        />
      ))}
    </>
  );
};

const FloatCard: React.FC<{
  box: {x: number; y: number; w: number; h: number};
  clock: {start: number; end: number};
  /** 1 = 머리 위(아래에서 올라옴), -1 = 머리 아래(위에서 내려옴) */
  from: number;
  glass: boolean;
  children: React.ReactNode;
}> = ({box, clock, from, glass, children}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = clock.start + frame / fps;
  const o = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
  const open = interpolate(now, [clock.start, clock.start + 0.32], [0, 1], {...o, easing: EASE.out});
  const close = interpolate(now, [clock.end - 0.26, clock.end], [0, 1], {...o, easing: EASE.in});
  const k = open * (1 - close);
  return (
    <div
      style={{
        position: 'absolute',
        left: box.x,
        top: box.y,
        width: box.w,
        height: box.h,
        opacity: k,
        transform: `translateY(${(1 - k) * 28 * from}px) scale(${0.96 + 0.04 * k})`,
        transformOrigin: from > 0 ? '50% 100%' : '50% 0%',
      }}
    >
      {glass ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 44,
            background: alpha(t.bg, 0.82),
            border: `1.5px solid ${alpha(t.dark ? '#ffffff' : '#000000', 0.12)}`,
            boxShadow: `0 30px 70px ${alpha('#000000', 0.35)}`,
            backdropFilter: 'blur(22px)',
            overflow: 'hidden',
          }}
        />
      ) : null}
      <div style={{position: 'absolute', inset: 0}}>{children}</div>
    </div>
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

/** 겹치거나 0.6초 이내로 붙은 구간은 하나로 합친다 (가로 레이아웃에서 컷어웨이가 깜빡이지 않게) */
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
