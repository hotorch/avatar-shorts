import {createContext, useContext} from 'react';
import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

// 모든 움직임은 "시간의 순수 함수"다. CSS transition/animation 은 쓰지 않는다 (렌더에서 깨짐).

// 스프링 3종 — 감쇠비 ζ≈0.65 → 도착점에서 약 7% 오버슈트 후 정지 (디자인 규칙)
export const SPRING = {
  pop: {damping: 17, stiffness: 170, mass: 1}, // 기본: 톡 들어와 살짝 넘치고 멈춤
  soft: {damping: 14, stiffness: 110, mass: 1}, // 큰 패널·카메라
  snap: {damping: 22, stiffness: 260, mass: 1}, // 거의 안 넘치는 빠른 정렬
} as const;

export const EASE = {
  out: Easing.bezier(0.16, 1, 0.3, 1), // expo-out: 퇴장·와이프
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  in: Easing.bezier(0.7, 0, 0.84, 0),
};

// 장면 시계: Sequence 안에서 "원본 영상 기준 초"를 그대로 쓸 수 있게 해 준다.
export type SceneClock = {start: number; end: number; hold?: boolean};
export const SceneCtx = createContext<SceneClock>({start: 0, end: 9999});

/** 현재 시각(원본 기준 초) */
export const useNow = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {start} = useContext(SceneCtx);
  return start + frame / fps;
};

export const useScene = () => useContext(SceneCtx);

/** at(원본 기준 초)에 시작하는 스프링 0→1 (오버슈트 포함) */
export const useSpringAt = (at: number | undefined, kind: keyof typeof SPRING = 'pop', delayFrames = 0) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {start} = useContext(SceneCtx);
  const f0 = Math.round(((at ?? start) - start) * fps) + delayFrames;
  return spring({frame: frame - f0, fps, config: SPRING[kind]});
};

/** at 부터 dur 초 동안 0→1 (이징) */
export const useProgress = (at: number, dur: number, ease = EASE.out) => {
  const now = useNow();
  return interpolate(now, [at, at + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: ease,
  });
};

/** 장면 끝 dur 초 동안 0→1 — 퇴장용 */
export const useExit = (dur = 0.35) => {
  const now = useNow();
  const {end, hold} = useContext(SceneCtx);
  if (hold) return 0;
  return interpolate(now, [end - dur, end], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.in,
  });
};

/** 느린 부유: 레이어마다 다른 위상·속도로 (패럴랙스 깊이감) */
export const useFloat = (amp = 8, period = 4, phase = 0) => {
  const now = useNow();
  return Math.sin(((now + phase) / period) * Math.PI * 2) * amp;
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** 여러 항목의 등장 시각: at 이 있으면 그대로, 없으면 base 부터 gap 초 간격 */
export const stagger = <T extends {at?: number}>(items: T[], base: number, gap = 0.22) =>
  items.map((it, i) => it.at ?? base + i * gap);
