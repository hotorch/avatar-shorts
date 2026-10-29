/**
 * 발표자 효과(fx)의 바닥 — 효과 6종(effects.tsx)이 전부 이 위에 선다. 언제 쓰는지: .claude/skills/broll-plan/references/presenter-fx.md
 *
 *   FxPresenter  편집본 영상 + 그 장면만 오려낸 사람(scripts/fx_matte.py 의 cutout.webm) + 프레임마다 잰 머리·어깨(track.json)
 *                + 영상이 그려지는 상자(화면을 덮는 cover 상자 — 얼굴 화면과 같은 자리라 들어오고 나갈 때 튀지 않는다)
 *   FxVideo      영상의 '그 시각' 한 장. 정지(freeze)는 같은 시각을 계속 달라고 하면 된다
 *   shotStats    장면 전체 프레임의 최악값(가장 높은 정수리·가장 낮은 턱·어깨 이탈선) — 배치는 한 프레임이 아니라 모든 프레임을 피한다
 *   onset        장면 안 단어의 시작(장면 기준 초) — 박자는 말에서. 손으로 친 시각 없음
 *
 * 효과는 useCurrentFrame 을 부르지 않는다: 붙이는 곳(FxHost, Vertical.tsx)이 장면 기준 프레임 lf 를 넘긴다.
 */
import React from 'react';
import {OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {FRAME} from '../layouts/framing.js';
import {FONT as FONTS} from '../kit/theme';

export const W = FRAME.W;
export const H = FRAME.H;
export const FONT = FONTS.sans;
/** 그래픽은 자막 줄 위에서 끝난다 (fx 장면의 자막은 기본 자리 CAPTION_Y) */
export const FX_FLOOR = FRAME.CAPTION_Y - 20;
/** 위쪽 플랫폼 UI 아래에만 글자·카드 */
export const TOP_SAFE = FRAME.SAFE_TOP;

type Box4 = [number, number, number, number];
/** scripts/fx_matte.py 가 프레임마다 쓰는 값 (오려내기 해상도 px) */
export type TrackFrame = {face: Box4; face_missed: boolean; chin: number; head_top: number; shoulder_l: number; shoulder_r: number; motion: number};
export type Track = {
  /** t0 = 오려내기 첫 프레임의 영상 시각(렌더 시간 초). width/height = 오려내기 해상도 */
  summary: {frames: number; fps: number; width: number; height: number; t0: number};
  frames: TrackFrame[];
};
export type Word = {text: string; start: number; end: number};
export type Box = {x: number; y: number; w: number};

export type FxPresenter = {
  /** public 기준 경로: 편집본(또는 원본) 영상, 이 장면의 오려내기 */
  clip: string;
  cutout: string;
  track: Track;
  /** 영상이 그려지는 자리: 왼쪽 위 [x, y] 와 폭 (화면 px) */
  box: Box;
  /** 원본 영상 높이/폭 */
  aspect: number;
};

/** 효과마다 받는 것 */
export type FxBase = {
  p: FxPresenter;
  /** 장면 기준 프레임 */
  lf: number;
  /** 장면 시작의 영상 시각(렌더 시간 초) */
  start: number;
  /** 장면 길이(초) */
  dur: number;
  /** 장면 안 단어, 장면 기준 초 */
  words: Word[];
};

/** 발표자 평면: P' = o + (P - o)·s + d (화면 px). 발표자를 줄이거나 올리는 효과는 영상·오려내기·발표자 기준 숫자를 모두 이 평면으로 */
export type Plane = {s: number; ox: number; oy: number; dx: number; dy: number};
export const FLAT: Plane = {s: 1, ox: 0, oy: 0, dx: 0, dy: 0};
export const planeCss = (pl: Plane): React.CSSProperties => ({
  transform: `translate(${pl.dx}px, ${pl.dy}px) scale(${pl.s})`,
  transformOrigin: `${pl.ox}px ${pl.oy}px`,
});
const onPlane = (pl: Plane, v: number, o: number, d: number) => o + (v - o) * pl.s + d;

/** 오려내기 px → 화면 px (상자, 그다음 평면) */
export const mapper = (p: FxPresenter, pl: Plane = FLAT) => {
  const k = p.box.w / p.track.summary.width;
  return {
    k: k * pl.s,
    x: (cx: number) => onPlane(pl, p.box.x + cx * k, pl.ox, pl.dx),
    y: (cy: number) => onPlane(pl, p.box.y + cy * k, pl.oy, pl.dy),
  };
};

/** 장면 기준 초 s 에 보이는 track 프레임 */
export const trackAt = (b: Pick<FxBase, 'p' | 'start'>, s: number): TrackFrame => {
  const t = b.p.track;
  const i = Math.round((b.start + s - t.summary.t0) * t.summary.fps);
  return t.frames[Math.max(0, Math.min(t.frames.length - 1, i))];
};

/** 장면 전체 프레임의 최악값 (화면 px, 평면 pl 을 거쳐) — 배치는 모든 프레임에서 정수리·턱·어깨를 피한다 */
export const shotStats = (b: Pick<FxBase, 'p'>, pl: Plane = FLAT) => {
  const fr = b.p.track.frames;
  if (!fr.length) throw new Error('presenter-fx: track 에 프레임이 없습니다 (npm run fx)');
  const m = mapper(b.p, pl);
  return {
    headTop: m.y(Math.min(...fr.map((q) => q.head_top))),
    chin: m.y(Math.max(...fr.map((q) => q.chin))),
    faceTop: m.y(Math.min(...fr.map((q) => q.face[1]))),
    faceBottom: m.y(Math.max(...fr.map((q) => q.face[1] + q.face[3]))),
    faceH: Math.max(...fr.map((q) => q.face[3])) * m.k,
    faceCx: m.x(fr.reduce((s, q) => s + q.face[0] + q.face[2] / 2, 0) / fr.length),
    /** 몸이 화면 왼쪽/오른쪽 끝에 닿는 가장 낮은 줄 (잰 어깨선) */
    shoulderL: m.y(Math.max(...fr.map((q) => q.shoulder_l))),
    shoulderR: m.y(Math.max(...fr.map((q) => q.shoulder_r))),
  };
};

/** [s0, s1) 장면 기준 초 사이에서 얼굴 밖 움직임이 가장 큰 순간 — 몸짓 정점 (손 모양 모델 대신) */
export const motionPeakAt = (b: Pick<FxBase, 'p' | 'start'>, s0: number, s1: number): number => {
  const t = b.p.track;
  const tf = t.summary.fps;
  const off = b.start - t.summary.t0;
  const f0 = Math.max(0, Math.round((off + s0) * tf));
  const f1 = Math.min(t.frames.length, Math.round((off + s1) * tf));
  let best = f0;
  for (let f = f0; f < f1; f++) if (t.frames[f].motion > t.frames[best].motion) best = f;
  return best / tf - off;
};

const bare = (s: string) => s.normalize('NFC').replace(/[\s.,!?…·~"'“”‘’()]+/g, '');
/** 장면 안에서 `text` 로 시작하는 첫 단어의 시작 (장면 기준 초). 조사·문장부호가 붙어도 찾는다 (render 검사와 같은 규칙) */
export const onset = (words: Word[], text: string): number => {
  const w = words.find((x) => bare(x.text).startsWith(bare(text)));
  if (!w) throw new Error(`presenter-fx: "${text}" 를 이 장면에서 말하지 않습니다 (${words.map((x) => x.text).join(' ')})`);
  return w.start;
};

/** 영상(또는 오려내기)의 영상 시각 t(렌더 시간 초) 한 장을 상자 자리에 그린다. 자기 시계를 그 시각에 맞춘다 */
export const FxVideo: React.FC<{p: FxPresenter; t: number; cutout?: boolean; style?: React.CSSProperties}> = ({p, t, cutout = false, style}) => {
  const now = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = cutout ? t - p.track.summary.t0 : t;
  const src = cutout ? p.cutout : p.clip;
  return (
    <Sequence from={now - Math.round(local * fps)} layout="none">
      <OffthreadVideo
        src={src.startsWith('http') ? src : staticFile(src)}
        muted
        transparent={cutout}
        style={{position: 'absolute', left: p.box.x, top: p.box.y, width: p.box.w, height: p.box.w * p.aspect, display: 'block', ...style}}
      />
    </Sequence>
  );
};

/** 화면 전체 크기의 발표자 평면: 안의 것은 화면 px 로 그리고 pl 로 움직인다 */
export const PlaneLayer: React.FC<{pl: Plane; style?: React.CSSProperties; children: React.ReactNode}> = ({pl, style, children}) => (
  <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, ...planeCss(pl), ...style}}>{children}</div>
);

/* ------------------------------------------------------------------------------------------- 같이 쓰는 작은 부품 */
export const Check: React.FC<{size: number; color?: string}> = ({size, color = '#fff'}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{verticalAlign: '-0.12em', marginLeft: size * 0.25}}>
    <path d="M4 12.5l5 5L20 6.5" fill="none" stroke={color} strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const rgb = (hex: string) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
/** 두 색을 k 만큼 섞는다 (정책 sceneColors: 면은 트라이어드와 그 명암만 → 검정·흰색과 섞는 데 쓴다) */
export const mix = (a: string, b: string, k: number) => {
  const [x, y] = [rgb(a), rgb(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
};

/** 효과들이 같이 쓰는 어두운 유리 면 (트라이어드 진한색에 검정을 섞은 명암) */
export const glass = (dark: string, alpha = 0.55): React.CSSProperties => {
  const [r, g, b] = rgb(mix(dark, '#000000', 0.35));
  return {
    background: `linear-gradient(160deg, rgba(${r},${g},${b},${alpha}) 0%, rgba(${r},${g},${b},${Math.min(1, alpha + 0.2)}) 100%)`,
    border: '2px solid rgba(255,255,255,0.16)',
    boxShadow: '0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
    backdropFilter: 'blur(22px) saturate(1.2)',
    WebkitBackdropFilter: 'blur(22px) saturate(1.2)',
  };
};
