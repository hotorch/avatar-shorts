/**
 * 발표자 효과 6종. 어느 문장에 무엇을 쓰는지: .claude/skills/broll-plan/references/presenter-fx.md (기준은 정책 presenterFx, render 가 막는다).
 * 발표자 기준 숫자는 전부 track 의 장면 최악값(fx.tsx shotStats), 박자는 전부 단어 시작(onset), 글자·값은 plan 과 데이터 파일에서.
 * 손으로 친 좌표·숫자 없음. 면 색은 트라이어드와 그 명암만 (정책 sceneColors).
 *
 * 목소리는 영상의 주인이라 계속 흐른다: 효과는 시간을 늘이지 않는다. freeze 는 목소리가 이어지는 동안 그림만 멈춘다 (정지 화면 관용구).
 */
import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useVideoConfig} from 'remotion';
import {FRAME, shoulderScaleFor} from '../layouts/framing.js';
import {objectSrc} from '../kit/Object3D';
import {useTheme} from '../kit/theme';
import {Check, FLAT, FONT, FX_FLOOR, FxBase, FxVideo, H, mix, motionPeakAt, onset, Plane, PlaneLayer, shotStats, TOP_SAFE, trackAt, W, glass, mapper} from './fx';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
/** 발표자가 효과의 평면으로 옮겨 가는 시간(초) — 튀지 않고 다시 잡는다 */
const REFRAME_S = 0.35;
const reframe = (lf: number, fps: number) => interpolate(lf, [0, REFRAME_S * fps], [0, 1], {...clamp, easing: easeOut});
const at = (b: FxBase, lf: number, fps: number) => b.start + lf / fps;
/** 발표자를 올렸을 때 드러나는 아래쪽: 같은 영상을 흐리고 키워서 깐다 (빈 검정 면 없음) */
const LiftBackdrop: React.FC<{b: FxBase; t: number}> = ({b, t}) => (
  <FxVideo p={b.p} t={t} style={{transform: 'scale(1.35)', transformOrigin: '50% 100%', filter: 'blur(26px) brightness(0.7)'}} />
);

/* ------------------------------------------------------------------------------------------------------------------ */
/* freeze: 몸짓 정점에서 번쩍 → 그림이 멈추고 배경이 흐려지며 발표자가 흰 테두리 스티커로 튀어나오고 이름표. 목소리는 계속, 끝나면 다시 움직임 */
/* ------------------------------------------------------------------------------------------------------------------ */
export type FreezeProps = FxBase & {
  /** 이름표 — 그 장면에서 말한 이름 (render 가 확인) */
  name: string;
  role?: string;
  /** 멈추는 길이(초). 뒤에 0.5초 이상 움직이는 화면이 남아야 한다 */
  hold?: number;
  /** 몸짓 정점을 찾을 구간의 첫·끝 단어 (기본: 장면 처음 ~ 멈춤이 들어갈 수 있는 마지막 순간) */
  search?: [string, string];
};

const StickerFilter: React.FC = () => (
  <svg width={0} height={0} style={{position: 'absolute'}}>
    <filter id="fx-sticker-outline" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
      <feComponentTransfer in="SourceAlpha" result="hard">
        <feFuncA type="discrete" tableValues="0 1" />
      </feComponentTransfer>
      <feMorphology in="hard" operator="dilate" radius={14} result="grown" />
      <feFlood floodColor="#ffffff" />
      <feComposite in2="grown" operator="in" result="ring" />
      <feMerge>
        <feMergeNode in="ring" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </svg>
);

export const freezeAt = (b: FreezeProps): number => {
  const hold = b.hold ?? 1.3;
  const s0 = b.search ? onset(b.words, b.search[0]) : 0.2;
  const s1 = b.search ? onset(b.words, b.search[1]) : b.dur - hold - 0.5;
  if (s1 <= s0) throw new Error(`presenter-fx freeze: ${b.dur.toFixed(2)}초 장면에 ${hold}초 멈춤이 들어갈 자리가 없습니다`);
  return motionPeakAt(b, s0, s1);
};

export const FreezeFrame: React.FC<FreezeProps> = (b) => {
  const {fps} = useVideoConfig();
  const t = useTheme();
  const {lf, p} = b;
  const HOLD = Math.round((b.hold ?? 1.3) * fps);
  const F = Math.round(freezeAt(b) * fps);
  const k = lf - F;
  const inHold = k >= 0 && k < HOLD;
  const frozenT = at(b, F, fps);
  const tr = trackAt(b, F / fps);
  const m = mapper(p);
  const faceCx = m.x(tr.face[0] + tr.face[2] / 2);
  const pop = spring({frame: k, fps, config: {damping: 13, stiffness: 170, mass: 0.8}});
  const stickerScale = interpolate(pop, [0, 1], [1.0, 1.1]);
  const stickerOut = interpolate(lf, [F + HOLD, F + HOLD + 0.2 * fps], [1, 0], clamp);
  const grey = k < 0 ? 0 : inHold ? interpolate(k, [0, 0.2 * fps], [0, 1], clamp) : interpolate(lf, [F + HOLD, F + HOLD + 0.27 * fps], [1, 0], clamp);
  const flash = k < 0 ? 0 : interpolate(k, [0, 0.27 * fps], [1, 0], clamp); // 멈추는 순간 하얗게
  const tagIn = spring({frame: k - Math.round(0.23 * fps), fps, config: {damping: 14, stiffness: 200}});
  return (
    <AbsoluteFill style={{overflow: 'hidden', fontFamily: FONT}}>
      <StickerFilter />
      <FxVideo
        p={p}
        t={inHold ? frozenT : at(b, lf, fps)}
        style={{filter: `grayscale(${grey}) blur(${10 * grey}px) brightness(${1 - 0.45 * grey})`, transform: `scale(${1 + 0.04 * grey * (inHold ? 1 : 0)})`}}
      />
      {k >= 0 && (inHold || stickerOut > 0) && (
        <AbsoluteFill style={{opacity: stickerOut}}>
          <AbsoluteFill
            style={{
              transform: `scale(${stickerScale}) rotate(${-2.5 * pop}deg)`,
              transformOrigin: `${faceCx}px ${m.y(tr.face[1] + tr.face[3])}px`,
              filter: 'drop-shadow(0 22px 34px rgba(0,0,0,0.55))',
            }}
          >
            <FxVideo p={p} t={frozenT} cutout style={{filter: 'url(#fx-sticker-outline)'}} />
          </AbsoluteFill>
          <div
            style={{
              position: 'absolute',
              left: faceCx,
              top: Math.min(m.y(tr.chin) + 46, FX_FLOOR - 170),
              transform: `translateX(-50%) rotate(-2.5deg) scale(${interpolate(tagIn, [0, 1], [0.6, 1])})`,
              opacity: tagIn,
              background: t.accent,
              borderRadius: 26,
              padding: '20px 40px 22px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
              border: '4px solid #fff',
            }}
          >
            <div style={{color: t.accentInk, fontWeight: 800, fontSize: 58, letterSpacing: '-0.02em', lineHeight: 1.1}}>{b.name}</div>
            {b.role ? <div style={{color: t.accentInk, opacity: 0.88, fontWeight: 600, fontSize: 32, marginTop: 6}}>{b.role}</div> : null}
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{background: '#fff', opacity: flash}} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* text-behind: 머리 뒤에서 큰 단어 하나가 솟는다. 최악 프레임에서도 머리가 글자 높이의 20 % 까지만 가린다. 위 UI 에 닿으면 글자 대신 영상을 내린다 */
/* ------------------------------------------------------------------------------------------------------------------ */
export type TextBehindProps = FxBase & {
  /** 그 장면에서 말한 이름 한 단어 (render 가 확인) */
  text: string;
  /** 글자가 솟는 단어 (기본: text) */
  atWord?: string;
  /** 그린 폭(px). 기본: 글자 수로 어림한 폭, 최대 940 */
  width?: number;
  font?: number;
  /** "word" / "matte": scripts/fx_check.py 가 재는 시험용 스틸 */
  probe?: 'word' | 'matte';
};
const CAP = 0.72; // Pretendard 대문자 높이 / em
const advance = (ch: string) => (/[ㄱ-힣]/.test(ch) ? 0.98 : /[A-Z0-9]/.test(ch) ? 0.7 : 0.56);

export const textBehindLayout = (b: TextBehindProps) => {
  let font = b.font ?? 330;
  const natural = [...b.text].reduce((s, c) => s + advance(c), 0) * font;
  let width = b.width ?? Math.min(940, natural);
  if (!b.width && natural > 940) font *= 940 / natural;
  width = Math.round(width);
  const capH = font * CAP;
  const s = shotStats(b);
  let baseline = s.headTop + 0.2 * capH; // 머리 꼭대기가 글자 아래 20 % 까지만
  const shift = Math.max(0, TOP_SAFE - (baseline - capH)); // 글자를 올리는 대신 영상을 내린다
  baseline += shift;
  if (baseline > FX_FLOOR - 200) throw new Error(`presenter-fx text-behind: 정수리가 ${s.headTop.toFixed(0)}px 라 머리 위에 글자 자리가 없습니다`);
  return {font, width, capH, shift, baseline};
};

export const TextBehind: React.FC<TextBehindProps> = (b) => {
  const {fps} = useVideoConfig();
  const th = useTheme();
  const {lf, p, probe} = b;
  const {font, width, capH, shift, baseline} = textBehindLayout(b);
  const pl: Plane = {...FLAT, dy: shift * (probe ? 1 : reframe(lf, fps))};
  const t = at(b, lf, fps);
  const rise0 = Math.round(onset(b.words, b.atWord ?? b.text) * fps);
  const rise = interpolate(lf, [rise0, rise0 + 0.43 * fps], [1, 0], {...clamp, easing: easeOut});
  const word = (
    <div style={{position: 'absolute', left: (W - width) / 2, top: baseline - capH - 40, width, height: capH + 40, overflow: 'hidden'}}>
      <svg width={width} height={capH + 40} style={{transform: `translateY(${(probe ? 0 : rise) * (capH + 50)}px)`}}>
        <text
          x={0}
          y={capH + 40}
          textLength={width}
          lengthAdjust="spacingAndGlyphs"
          style={{fontFamily: FONT, fontWeight: 900, fontSize: font, fill: probe === 'word' ? '#fff' : th.triad.light}}
        >
          {b.text}
        </text>
      </svg>
    </div>
  );
  if (probe === 'word') return <AbsoluteFill style={{background: '#000'}}>{word}</AbsoluteFill>;
  if (probe === 'matte')
    return (
      <AbsoluteFill style={{background: '#000'}}>
        <PlaneLayer pl={pl}>
          <FxVideo p={p} t={t} cutout style={{filter: 'brightness(0) invert(1)'}} />
        </PlaneLayer>
      </AbsoluteFill>
    );
  const feather = 'linear-gradient(to bottom, transparent 0, #000 90px)';
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
      <FxVideo p={p} t={t} style={{transform: 'scale(1.35)', transformOrigin: '50% 0%', filter: 'blur(26px)'}} />
      <PlaneLayer pl={pl}>
        <FxVideo p={p} t={t} style={{WebkitMaskImage: feather, maskImage: feather}} />
      </PlaneLayer>
      {word}
      <PlaneLayer pl={pl}>
        <FxVideo p={p} t={t} cutout />
      </PlaneLayer>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* shoulder: 양 어깨 뒤에서 유리 카드 2장이 솟고 발표자는 그 앞. 편지 하나가 머리 위로 왼쪽 → 오른쪽 카드로 넘어갈 수 있다            */
/* ------------------------------------------------------------------------------------------------------------------ */
export type SideCard = {chip: string; title: string; line?: string; atWord: string};
export type ShoulderProps = FxBase & {
  left: SideCard;
  right: SideCard & {pill?: string};
  /** 편지가 왼쪽 카드를 떠나는 단어 (없으면 편지 없음) */
  sendWord?: string;
  /** 발표자 배율. 보통 비워 둔다 — render 가 카드 자리에 필요한 만큼만 재서 채운다 (framing.js shoulderScaleFor, 하한 S_MIN) */
  scale?: number;
};
const CARD_W = 430;
const ABOVE_HEAD = FRAME.FX_ABOVE_HEAD; // 카드 내용은 머리 위 높이에 — 아무것도 안 가리는 자리

const SessionCard: React.FC<{
  c: SideCard & {pill?: string};
  right: boolean;
  x: number;
  top: number;
  bottom: number;
  lf: number;
  at: number;
  pillAt?: number;
  fps: number;
}> = ({c, right, x, top, bottom, lf, at: from, pillAt, fps}) => {
  const t = useTheme();
  const h = bottom - top;
  const up = spring({frame: lf - from, fps, config: {damping: 17, stiffness: 110, mass: 0.9}});
  const pill = pillAt === undefined ? 0 : spring({frame: lf - pillAt, fps, config: {damping: 11, stiffness: 220}});
  return (
    // 틈: 카드는 어깨선에서 솟고, 그 아래로는 안 보인다
    <div style={{position: 'absolute', left: x - 40, top: 0, width: CARD_W + 80, height: bottom, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: 40,
          top,
          width: CARD_W,
          height: h,
          borderRadius: 38,
          transform: `translateY(${(1 - up) * (h + 40)}px) rotate(${right ? 2.5 : -2.5}deg)`,
          ...glass(t.triad.dark, 0.62),
          padding: '36px 38px',
          boxSizing: 'border-box',
          color: '#fff',
          textAlign: right ? 'right' : 'left',
          WebkitMaskImage: 'linear-gradient(to bottom, #000 72%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, #000 72%, transparent 100%)',
        }}
      >
        <div
          style={{
            display: 'inline-block',
            fontSize: 30,
            fontWeight: 700,
            padding: '8px 20px',
            borderRadius: 999,
            background: right ? `${t.triad.accent}38` : `${t.triad.light}30`,
            color: right ? t.triad.accent : t.triad.light,
          }}
        >
          {c.chip}
        </div>
        <div style={{fontSize: 78, fontWeight: 800, marginTop: 18, letterSpacing: '-0.03em', lineHeight: 1.05, wordBreak: 'keep-all'}}>{c.title}</div>
        {c.line ? (
          <div style={{fontSize: 38, fontWeight: 600, marginTop: 14, lineHeight: 1.28, color: 'rgba(255,255,255,0.84)', wordBreak: 'keep-all'}}>{c.line}</div>
        ) : null}
        {c.pill ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              marginTop: 22,
              fontSize: 32,
              fontWeight: 700,
              padding: '10px 22px',
              borderRadius: 999,
              background: t.accent,
              color: t.accentInk,
              opacity: pill,
              transform: `scale(${0.5 + 0.5 * pill})`,
              transformOrigin: 'right center',
            }}
          >
            {c.pill}
            <Check size={30} color={t.accentInk} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export const OverShoulder: React.FC<ShoulderProps> = (b) => {
  const {fps} = useVideoConfig();
  const t = useTheme();
  const {lf, p} = b;
  const S = b.scale ?? shoulderScaleFor(shotStats(b).headTop);
  const z = reframe(lf, fps);
  const rest: Plane = {s: S, ox: W / 2, oy: H, dx: 0, dy: 0};
  const pl: Plane = {...rest, s: 1 + (S - 1) * z};
  const s = shotStats(b, rest);
  const top = Math.max(TOP_SAFE, s.headTop - ABOVE_HEAD);
  const bottomL = Math.min(s.shoulderL + 40, FX_FLOOR); // 모든 프레임에서 몸이 화면 옆을 벗어나는 줄 아래로 숨긴다
  const bottomR = Math.min(s.shoulderR + 40, FX_FLOOR);
  const leftAt = Math.round(onset(b.words, b.left.atWord) * fps) + 3;
  const rightAt = Math.round(onset(b.words, b.right.atWord) * fps);
  const sendAt = b.sendWord ? Math.round(onset(b.words, b.sendWord) * fps) : undefined;
  const flyF = Math.round(0.67 * fps);
  const leftX = 24;
  const rightX = W - 24 - CARD_W;
  const q = sendAt === undefined ? 0 : interpolate(lf, [sendAt, sendAt + flyF], [0, 1], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const mx = interpolate(q, [0, 1], [leftX + CARD_W - 90, rightX + 90]);
  const my = top + 120 - Math.sin(q * Math.PI) * 150;
  const now = at(b, lf, fps);
  const side = 'linear-gradient(to right, transparent 0, #000 10%, #000 90%, transparent 100%)';
  const deep = mix(t.triad.dark, '#000000', 0.55);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: deep, fontFamily: FONT}}>
      <AbsoluteFill style={{background: `radial-gradient(120% 80% at 78% 18%, ${t.triad.dark} 0%, ${mix(t.triad.dark, '#000000', 0.3)} 45%, ${deep} 80%)`}} />
      <PlaneLayer pl={pl} style={{opacity: 1 - z}}>
        <FxVideo p={p} t={now} />
      </PlaneLayer>
      <SessionCard c={b.left} right={false} x={leftX} top={top} bottom={bottomL} lf={lf} at={leftAt} fps={fps} />
      <SessionCard
        c={b.right}
        right
        x={rightX}
        top={top}
        bottom={bottomR}
        lf={lf}
        at={rightAt}
        fps={fps}
        pillAt={sendAt === undefined ? (b.right.pill ? rightAt + flyF : undefined) : sendAt + flyF}
      />
      {q > 0 && q < 1 && (
        <div
          style={{
            position: 'absolute',
            left: mx - 50,
            top: my - 38,
            width: 100,
            height: 76,
            borderRadius: 14,
            background: '#fff',
            boxShadow: '0 0 50px rgba(255,255,255,0.75), 0 14px 30px rgba(0,0,0,0.4)',
            transform: `rotate(${interpolate(q, [0, 1], [-12, 12])}deg)`,
          }}
        >
          <svg width={100} height={76} viewBox="0 0 100 76">
            <path d="M12 14 L50 44 L88 14" fill="none" stroke={t.triad.dark} strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
      )}
      <PlaneLayer pl={pl}>
        <FxVideo p={p} t={now} cutout style={{WebkitMaskImage: side, maskImage: side}} />
      </PlaneLayer>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* grade-wipe: 세로선이 왼쪽에서 쓸며 보정본으로. BEFORE 칩은 선이 닿기 전에 사라진다. 화면(색·화질) 자체가 좋아지는 말에만         */
/* ------------------------------------------------------------------------------------------------------------------ */
export type GradeProps = FxBase & {
  atWord: string;
  /** AFTER 보정(CSS filter). 기본은 초안 보정 — 진짜 보정본은 after(broll/ 영상, 장면 시작에 맞춘 것) */
  grade?: string;
  /** render 가 채움: broll/ 의 보정본 public 경로 */
  after?: string;
  labels?: {after: string; before: string};
};
export const DRAFT_GRADE = 'saturate(1.18) contrast(1.1) brightness(0.98)';

const Chip: React.FC<{text: string; style: React.CSSProperties}> = ({text, style}) => (
  <div
    style={{
      position: 'absolute',
      top: TOP_SAFE + 90,
      padding: '14px 26px',
      borderRadius: 999,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 34,
      letterSpacing: '0.08em',
      color: '#fff',
      background: 'rgba(10,10,14,0.55)',
      border: '2px solid rgba(255,255,255,0.35)',
      backdropFilter: 'blur(12px)',
      ...style,
    }}
  >
    {text}
  </div>
);

export const GradeWipe: React.FC<GradeProps> = (b) => {
  const {fps} = useVideoConfig();
  const {lf, p} = b;
  const s = shotStats(b);
  const start = Math.round(onset(b.words, b.atWord) * fps);
  const sweep = Math.round(1.07 * fps);
  const x = interpolate(lf, [start, start + sweep], [0, W], {...clamp, easing: Easing.inOut(Easing.cubic)});
  const handleY = Math.min(s.faceBottom + 0.55 * s.faceH, FX_FLOOR - 60);
  const lineOut = interpolate(lf, [start + sweep - 4, start + sweep + 4], [1, 0], clamp);
  const labels = b.labels ?? {after: 'AFTER', before: 'BEFORE'};
  const beforeLeft = W - 60 - 230;
  const beforeOut = interpolate(x, [beforeLeft - 260, beforeLeft - 40], [1, 0], clamp);
  const afterIn = interpolate(x, [80, 300], [0, 1], clamp);
  const now = at(b, lf, fps);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000'}}>
      <FxVideo p={p} t={now} />
      <AbsoluteFill style={{clipPath: `inset(0 ${W - x}px 0 0)`}}>
        {b.after ? (
          // 보정본은 장면 시작에서 0초 — 오려내기처럼 자기 시계 (t0 = 장면 시작)
          <FxVideo p={{...p, cutout: b.after, track: {...p.track, summary: {...p.track.summary, t0: b.start}}}} t={now} cutout />
        ) : (
          <FxVideo p={p} t={now} style={{filter: b.grade ?? DRAFT_GRADE}} />
        )}
      </AbsoluteFill>
      {x > 0 && lineOut > 0 && (
        <>
          <div style={{position: 'absolute', left: x - 3, top: 0, width: 6, height: H, background: '#fff', opacity: lineOut, boxShadow: '0 0 24px rgba(255,255,255,0.7)'}} />
          <div
            style={{
              position: 'absolute',
              left: x - 44,
              top: handleY - 44,
              width: 88,
              height: 88,
              borderRadius: 44,
              background: '#fff',
              opacity: lineOut,
              boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width={50} height={30} viewBox="0 0 50 30">
              <path d="M14 4 L4 15 L14 26 M36 4 L46 15 L36 26" fill="none" stroke="#111" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </>
      )}
      <Chip text={labels.after} style={{left: 60, opacity: afterIn}} />
      <Chip text={labels.before} style={{left: beforeLeft, opacity: beforeOut}} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* tier: 발표자가 올라가고 턱 아래 어두운 유리 패널. 타일이 D → S 순으로 날아오고 S 가 마지막에 앉는다                            */
/* ------------------------------------------------------------------------------------------------------------------ */
export type TierItem = {name: string; object?: string; src?: string};
export type TierRow = {tier: string; items: TierItem[]};
export type TierProps = FxBase & {
  title: string;
  /** 위가 제일 좋은 칸. 타일 그림은 저장소 3D 오브젝트(object) 또는 broll/ 의 내 이미지(src) — 상표 로고를 저장소에 넣지 않는다 */
  rows: TierRow[];
  /** 첫 타일이 날아오는 단어 */
  atWord: string;
  busy?: string;
  done?: string;
};
const TIER_PANEL_MIN = 700;

export const TierList: React.FC<TierProps> = (b) => {
  const {fps} = useVideoConfig();
  const t = useTheme();
  const {lf, rows} = b;
  const s0 = shotStats(b);
  // 패널이 자막 위로 TIER_PANEL_MIN 을 갖도록 영상을 올린다. 이마 위로는 안 올린다
  const lift = Math.max(0, Math.min(s0.chin + 40 - (FX_FLOOR - TIER_PANEL_MIN), s0.faceTop - 40));
  const z = reframe(lf, fps);
  const pl: Plane = {...FLAT, dy: -lift * z};
  const panelTop = s0.chin - lift + 40;
  const panelBottom = FX_FLOOR;
  const rowH = (panelBottom - panelTop - 130) / rows.length;
  // 칸 색: 위 칸 = 포인트색, 아래로 갈수록 밝은색 → 진한색 쪽 명암
  const tierColor = (i: number) => {
    const k = rows.length > 1 ? i / (rows.length - 1) : 0;
    return k < 0.5 ? mix(t.triad.accent, t.triad.light, k * 2) : mix(t.triad.light, mix(t.triad.dark, '#ffffff', 0.35), (k - 0.5) * 2);
  };
  const order: {tier: string; i: number}[] = [];
  [...rows].reverse().forEach((r) => r.items.forEach((_, i) => order.push({tier: r.tier, i})));
  const stagger = Math.round(0.3 * fps);
  const startAt = Math.round(onset(b.words, b.atWord) * fps) - Math.round(0.2 * fps);
  const landOf = (tier: string, i: number) => startAt + order.findIndex((o) => o.tier === tier && o.i === i) * stagger;
  const sLanded = landOf(rows[0].tier, rows[0].items.length - 1) + Math.round(0.4 * fps);
  const glow = interpolate(lf, [sLanded, sLanded + 0.2 * fps, sLanded + 0.87 * fps], [0, 1, 0.45], clamp);
  const done = lf >= sLanded;
  const dots = '.'.repeat(1 + (Math.floor(lf / (0.2 * fps)) % 3));
  const panelIn = spring({frame: lf - Math.round(0.15 * fps), fps, config: {damping: 18, stiffness: 140}});
  const tileH = Math.min(120, rowH - 26);
  const now = at(b, lf, fps);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000', fontFamily: FONT}}>
      <LiftBackdrop b={b} t={now} />
      <PlaneLayer pl={pl}>
        <FxVideo p={b.p} t={now} />
      </PlaneLayer>
      <div
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          top: panelTop,
          height: panelBottom - panelTop,
          borderRadius: 40,
          ...glass(t.triad.dark, 0.72),
          padding: '26px 28px',
          boxSizing: 'border-box',
          color: '#fff',
          opacity: panelIn,
          transform: `translateY(${(1 - panelIn) * 60}px)`,
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 84}}>
          <div style={{fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em'}}>{b.title}</div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              padding: '10px 22px',
              borderRadius: 999,
              background: done ? t.accent : 'rgba(255,255,255,0.14)',
              color: done ? t.accentInk : '#fff',
            }}
          >
            {done ? (
              <>
                {b.done ?? '순위 완료'}
                <Check size={30} color={t.accentInk} />
              </>
            ) : (
              `${b.busy ?? '순위 매기는 중'}${dots}`
            )}
          </div>
        </div>
        {rows.map((r, ri) => (
          <div key={r.tier} style={{display: 'flex', alignItems: 'center', height: rowH, gap: 22, borderTop: '1px solid rgba(255,255,255,0.08)'}}>
            <div
              style={{
                width: 104,
                height: rowH - 18,
                borderRadius: 22,
                background: tierColor(ri),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: Math.min(64, rowH * 0.6),
                color: t.triad.dark,
                boxShadow: ri === 0 ? `0 0 ${50 * glow}px ${12 * glow}px ${t.triad.accent}${Math.round(0.7 * glow * 255).toString(16).padStart(2, '0')}` : 'none',
              }}
            >
              {r.tier}
            </div>
            {r.items.map((it, i) => {
              const fly = spring({frame: lf - landOf(r.tier, i), fps, config: {damping: 15, stiffness: 150, mass: 0.8}});
              const img = it.src ? staticFile(it.src) : it.object ? objectSrc(it.object, 'clay') : null;
              return (
                <div
                  key={it.name}
                  style={{display: 'flex', alignItems: 'center', gap: 16, opacity: fly > 0.01 ? 1 : 0, transform: `translateX(${(1 - fly) * 820}px) rotate(${(1 - fly) * 10}deg)`}}
                >
                  <div
                    style={{
                      width: tileH,
                      height: tileH,
                      borderRadius: 24,
                      background: mix(t.triad.dark, '#ffffff', 0.14), // 흰 점토 오브젝트가 보이게 어두운 타일
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: ri === 0 ? `0 0 ${40 * glow}px ${t.triad.accent}` : '0 8px 20px rgba(0,0,0,0.3)',
                    }}
                  >
                    {img ? <Img src={img} style={{width: tileH * 0.72, height: tileH * 0.72, objectFit: 'contain'}} /> : null}
                  </div>
                  <div style={{fontSize: 30, fontWeight: 700, width: 170, lineHeight: 1.15, wordBreak: 'keep-all'}}>{it.name}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------------------------------------------------------ */
/* glass-chart: 가슴 위 유리 카드(모든 프레임에서 턱 + 40 아래), 합계가 올라가고 막대가 솟는다. 값은 데이터 파일에서만                */
/* ------------------------------------------------------------------------------------------------------------------ */
export type ChartData = {title: string; period?: string; unit: string; total: number; bars: {label: string; value: number}[]; decimals?: number; source: string};
export type ChartProps = FxBase & {
  /** plan 에는 data: "broll/<파일>.json" 만 적는다. render 가 그 파일을 읽어 chart 로 넣는다 (손으로 친 숫자 금지) */
  chart: ChartData;
};
const CHART_MIN = 620;

export const GlassChart: React.FC<ChartProps> = (b) => {
  const {fps} = useVideoConfig();
  const {lf, chart: c} = b;
  const s0 = shotStats(b);
  const lift = Math.max(0, Math.min(s0.chin + 40 - (FX_FLOOR - CHART_MIN), s0.faceTop - 40));
  const z = reframe(lf, fps);
  const pl: Plane = {...FLAT, dy: -lift * z};
  const top = s0.chin - lift + 40;
  const bottom = FX_FLOOR;
  const dec = c.decimals ?? 1;
  const max = Math.max(...c.bars.map((x) => x.value));
  const count = interpolate(lf, [0.1 * fps, 0.9 * fps], [0, c.total], {...clamp, easing: Easing.out(Easing.cubic)});
  const cardIn = spring({frame: lf - 1, fps, config: {damping: 18, stiffness: 140}});
  const barArea = bottom - top - 290;
  const now = at(b, lf, fps);
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#000', fontFamily: FONT}}>
      <LiftBackdrop b={b} t={now} />
      <PlaneLayer pl={pl}>
        <FxVideo p={b.p} t={now} />
      </PlaneLayer>
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top,
          height: bottom - top,
          borderRadius: 44,
          boxSizing: 'border-box',
          padding: '30px 44px',
          color: '#fff',
          opacity: cardIn,
          transform: `translateY(${(1 - cardIn) * 60}px)`,
          background: 'linear-gradient(160deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.06) 100%)',
          border: '2px solid rgba(255,255,255,0.55)',
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{fontSize: 34, fontWeight: 700, color: 'rgba(255,255,255,0.85)'}}>
          {c.title}
          {c.period ? ` · ${c.period}` : ''}
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4}}>
          <div style={{fontWeight: 900, fontSize: 130, letterSpacing: '-0.04em', lineHeight: 1}}>{count.toFixed(dec)}</div>
          <div style={{fontSize: 52, fontWeight: 800}}>{c.unit}</div>
        </div>
        <div style={{position: 'absolute', left: 44, right: 44, bottom: 30, height: barArea, display: 'flex', alignItems: 'flex-end', gap: 22}}>
          {c.bars.map((x, i) => {
            const g = spring({frame: lf - Math.round(0.27 * fps) - i * Math.round(0.13 * fps), fps, config: {damping: 12, stiffness: 130, mass: 0.7}});
            const h = (barArea - 90) * (x.value / max) * g;
            return (
              <div key={x.label} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%'}}>
                <div style={{fontWeight: 800, fontSize: 30, opacity: g, marginBottom: 6}}>{x.value.toFixed(dec)}</div>
                <div style={{width: '100%', height: Math.max(0, h), borderRadius: 14, background: 'linear-gradient(to top, rgba(255,255,255,0.55), rgba(255,255,255,0.95))'}} />
                <div style={{fontSize: 30, fontWeight: 700, marginTop: 10, whiteSpace: 'nowrap'}}>{x.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
