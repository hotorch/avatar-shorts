import React from 'react';
import {Video} from '@remotion/media';
import {AbsoluteFill, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Captions} from '../captions/Captions';
import {Backdrop} from '../kit/Backdrop';
import {fitSize} from '../kit/measure';
import {EASE, lerp} from '../kit/motion';
import {alpha, FONT, useTheme} from '../kit/theme';
import type {Cue, Plan} from '../plan';
import {AvatarVideo} from './Avatar';
import {avatarSideAt, mirrorX} from './sideSwap.js';
import {SceneHost} from './SceneHost';
import {amount, mergeRanges} from './Vertical';

/**
 * 가로 영상 (1920×1080) — 원본을 세로로 자르지 않는다.
 *  - 아바타는 왼쪽의 둥근 9:16 카드 (얼굴 중심 기준으로 카드 안에서만 크롭)
 *  - 오른쪽 빈 공간에서 PPT 처럼 설명 장면이 이어진다 (panel)
 *  - cutaway: 아바타 카드가 왼쪽 아래로 작아지고 장면이 넓게 쓴다
 *  - 장면이 없는 구간: 지금 하는 말을 오른쪽에 큰 글씨로 (빈 화면 없음)
 *  - chapter 장면의 props.avatar = 'right' 면 그 장부터 좌우가 바뀐다 (sideSwap.js — 카드가 작아진 장 카드 동안 옮김)
 */
export const W = 1920;
export const H = 1080;

const CARD = {x: 80, y: 78, w: 520, h: 924}; // 9:16
const SMALL = {x: 56, y: 640, w: 214, h: 380};
const STAGE = {x: 660, y: 70, w: 1190, h: 800};
const WIDE = {x: 330, y: 60, w: 1530, h: 830};
const CAPTION_Y = 920;

export const Side: React.FC<{plan: Plan}> = ({plan}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = frame / fps;
  const cut = amount(mergeRanges(plan.scenes.filter((s) => s.mode === 'cutaway')), now, 0.45);
  const busy = plan.scenes.some((s) => now >= s.in - 0.05 && now < s.out);
  const m = avatarSideAt(plan.scenes, now); // 0 = 아바타 왼쪽, 1 = 오른쪽

  const bw = lerp(CARD.w, SMALL.w, cut);
  const box = {
    x: mirrorX(lerp(CARD.x, SMALL.x, cut), bw, m, W),
    y: lerp(CARD.y, SMALL.y, cut),
    w: bw,
    h: lerp(CARD.h, SMALL.h, cut),
  };

  // 원본 16:9 을 카드 높이에 맞춰 키우고, 얼굴이 카드 가운데 오도록 좌우 이동
  const vw = plan.video?.width ?? 1920;
  const vh = plan.video?.height ?? 1080;
  const scale = (box.h / vh) * 1.04;
  const dispW = vw * scale;
  const dispH = vh * scale;
  const faceX = plan.video?.faceX ?? 0.5;
  const left = Math.min(0, Math.max(box.w - dispW, box.w / 2 - faceX * dispW));
  const top = (box.h - dispH) / 2;

  return (
    <AbsoluteFill>
      <Backdrop />

      {/* 아바타: 배경을 지운 영상이 있으면 사람만(화면 아래에 붙여), 없으면 카드 */}
      {plan.video?.matte ? (
        <Presenter matte={plan.video.matte} cut={cut} m={m} />
      ) : (
      <div
        style={{
          position: 'absolute',
          left: box.x,
          top: box.y,
          width: box.w,
          height: box.h,
          borderRadius: lerp(34, 24, cut),
          overflow: 'hidden',
          boxShadow: `0 30px 70px ${t.shadow}, 0 0 0 ${lerp(8, 5, cut)}px ${t.paper}`,
          background: '#000',
        }}
      >
        {plan.video?.src ? (
          <div style={{position: 'absolute', left, top, width: dispW, height: dispH}}>
            <AvatarVideo video={plan.video} punch={plan.punch} />
          </div>
        ) : (
          <AvatarVideo video={null} />
        )}
      </div>
      )}

      {/* 설명 장면 */}
      {plan.scenes.map((s) => {
        const st = s.mode === 'cutaway' ? WIDE : STAGE;
        const sm = avatarSideAt(plan.scenes, s.out - 0.01); // 장면은 자리를 옮기지 않는다: 그 장면이 끝날 때의 좌우로 고정
        return (
          <SceneHost
            key={s.id}
            scene={s}
            drift={plan.cameraDrift ?? 0}
            stage={{w: st.w, h: st.h, kind: 'side'}}
            style={{left: mirrorX(st.x, st.w, sm, W), top: st.y, width: st.w, height: st.h}}
          />
        );
      })}

      {/* 장면이 없을 때: 말하는 내용을 크게 */}
      {!busy ? <TalkText cues={plan.captions} chapter={currentChapter(plan, now)} left={mirrorX(STAGE.x, STAGE.w, m, W) + 40} /> : null}

      {/* 자막: 장면이 있을 때만 (없을 땐 TalkText 가 대신) */}
      {busy ? (
        <Captions cues={plan.captions} y={CAPTION_Y} x={mirrorX(lerp(STAGE.x, WIDE.x, cut), lerp(STAGE.w, WIDE.w, cut), m, W)} maxW={lerp(STAGE.w, WIDE.w, cut)} size={50 * (plan.captionScale ?? 1)} bigSize={64 * (plan.captionScale ?? 1)} surface="backdrop" karaoke={plan.captionKaraoke ?? false} />
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * 배경을 지운 진행자 (scripts/matte.py → avatar.webm). 카드 틀 없이 화면 아래에 붙여 세운다 — 카드가 "증명사진" 같다는 의견 (ep01-long).
 * 원본도 사람이 화면 아래에서 잘려 있으므로 그 잘린 선이 화면 아래 끝과 겹치게 둔다.
 * cutaway 땐 아래 구석으로 작아지고, 장마다 좌우가 바뀐다 (얼굴은 뒤집지 않음).
 */
export const PRESENTER = {
  big: {scale: 0.76, cx: 330}, // 잘라 낸 영역 너비의 가운데 x. 어깨 끝이 왼쪽 밖으로 조금 나간다
  small: {scale: 0.3, cx: 165}, // cutaway: WIDE 무대(x 330~) 왼쪽 아래 구석
};
const Presenter: React.FC<{matte: NonNullable<NonNullable<Plan['video']>['matte']>; cut: number; m: number}> = ({matte, cut, m}) => {
  const s = lerp(PRESENTER.big.scale, PRESENTER.small.scale, cut);
  const w = matte.crop.w * s;
  const h = matte.crop.h * s;
  const x = mirrorX(lerp(PRESENTER.big.cx, PRESENTER.small.cx, cut) - w / 2, w, m, W);
  const src = matte.src.startsWith('http') ? matte.src : staticFile(matte.src);
  return (
    <div style={{position: 'absolute', left: x, top: H - h, width: w, height: h}}>
      <Video src={src} objectFit="fill" style={{width: '100%', height: '100%'}} />
    </div>
  );
};

/**
 * 지금 장(章): 이미 지나간 마지막 chapter 장면의 번호·제목. 없으면 null.
 * 롱폼에서 큐 번호를 띄우면 "187" 처럼 커져 의미가 없어서, 장이 있으면 장 이름을 띄운다.
 */
export const currentChapter = (plan: Plan, now: number): string | null => {
  const chapters = plan.scenes.filter((s) => s.template === 'chapter');
  const past = chapters.filter((s) => s.in <= now).sort((a, b) => a.in - b.in);
  if (!past.length) return chapters.length ? '' : null; // 장이 있는 영상: 첫 장 전엔 머리말 없음 (큐 번호 "20" 이 뜨던 문제, ep01-long)
  const p = (past[past.length - 1].props ?? {}) as {num?: string; title?: string};
  return [p.num, (p.title ?? '').replace(/[*+]/g, '').replace(/\s+/g, ' ').trim()].filter(Boolean).join('  ');
};

/** 오른쪽 무대에 현재 절을 큰 에디토리얼 타이포로. 큐가 바뀔 때 단어가 솟아오른다. 위의 작은 머리말은 장 이름(없으면 큐 번호). */
const TalkText: React.FC<{cues: Cue[]; chapter?: string | null; left?: number}> = ({cues, chapter, left = STAGE.x + 40}) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const now = frame / fps;
  const idx = cues.findIndex((c) => now >= c.start && now < c.end);
  if (idx < 0) return null;
  const cue = cues[idx];
  const words = cue.text.split(/\s+/);
  const size = fitSize(cue.text, 96, STAGE.w * 1.7, 64);
  const emph = new Set((cue.emph ?? []).flatMap((e) => e.text.split(/\s+/)));
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top: STAGE.y,
        width: STAGE.w - 80,
        height: STAGE.h + 120,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {chapter === '' ? null : (
        <div style={{fontFamily: FONT.sans, fontSize: 30, fontWeight: 700, color: t.accent, marginBottom: 26, letterSpacing: '0.04em'}}>
          {chapter ?? String(idx + 1).padStart(2, '0')}
          <span style={{display: 'inline-block', width: 60, height: 3, background: alpha(t.accent, 0.5), margin: '0 0 8px 16px'}} />
        </div>
      )}
      <div style={{fontFamily: FONT.sans, fontWeight: 800, fontSize: size, lineHeight: 1.18, letterSpacing: '-0.035em', color: t.ink, wordBreak: 'keep-all'}}>
        {words.map((w, i) => {
          // 단어가 말하는 순간 솟아오른다 (cue.w, 노래방식). 없으면 0.07초 간격
          const at = cue.w && cue.w.length === words.length ? cue.w[i] : cue.start + i * 0.07;
          const k = interpolate(now, [at, at + 0.28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.out});
          const hot = emph.has(w);
          return (
            <span key={i} style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', paddingBottom: '0.06em'}}>
              <span style={{display: 'inline-block', transform: `translateY(${(1 - k) * 100}%)`, color: hot ? t.accent : undefined}}>
                {w}
                {i < words.length - 1 ? ' ' : ''}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
