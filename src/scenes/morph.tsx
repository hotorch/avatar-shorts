import React from 'react';
import {AbsoluteFill, Img, interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {KText} from '../kit/KText';
import {fitSize, textWidth} from '../kit/measure';
import {SPRING, useExit, useNow, useScene, useSpringAt} from '../kit/motion';
import {ObjIcon} from '../kit/Object3D';
import {Bubble, Cursor, TypeText} from '../kit/Parts';
import {useStage} from '../kit/stage';
import {alpha, FONT, useTheme} from '../kit/theme';

/**
 * morph: 도형 하나가 끊기지 않고 pill → card → chat → toggle … 로 변신한다.
 * 한 번의 변신 = 대사 한 비트. 각 상태의 t 는 그 말을 하는 단어의 시작 시각.
 */
export type MorphState =
  | {t: number; kind: 'pill'; text: string; object?: string}
  | {t: number; kind: 'card'; title: string; sub?: string; object?: string}
  | {t: number; kind: 'chat'; prompt: string; reply?: string; app?: string}
  | {t: number; kind: 'toggle'; label: string; on?: boolean}
  | {t: number; kind: 'search'; query: string}
  /** 터미널: command 를 타이핑하고 enterAt(생략 시 타이핑 끝)에 실행, output 줄이 차례로 뜬다 */
  | {t: number; kind: 'terminal'; command: string; enterAt?: number; output?: string[]; title?: string};

export type MorphProps = {states: MorphState[]; cursor?: boolean};

const sizeOf = (s: MorphState, u: number, W: number, H: number) => {
  const maxW = W * 0.9;
  switch (s.kind) {
    case 'pill':
      return {w: Math.min(maxW, textWidth(s.text, 70 * u, -0.03) + (s.object ? 240 : 160) * u), h: 160 * u, r: 80 * u};
    case 'card':
      return {w: Math.min(maxW, 880 * u), h: Math.min(H * 0.8, 640 * u), r: 44 * u};
    case 'chat':
      return {w: Math.min(maxW, 900 * u), h: Math.min(H * 0.86, 980 * u), r: 36 * u};
    case 'toggle':
      return {w: Math.min(maxW, 860 * u), h: 280 * u, r: 140 * u};
    case 'search':
      return {w: Math.min(maxW, 900 * u), h: 150 * u, r: 75 * u};
    case 'terminal':
      return {w: Math.min(maxW, 940 * u), h: Math.min(H * 0.8, (220 + 64 * (1 + (s.output?.length ?? 0))) * u), r: 30 * u};
  }
};

export const Morph: React.FC<MorphProps> = ({states, cursor = true}) => {
  const t = useTheme();
  const {start} = useScene();
  const {w: W, h: H, u} = useStage();
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const out = useExit(0.35);
  const now = useNow();

  // 스프링 누적: 상태가 바뀔 때마다 목표치 차이만큼 스프링 하나씩 더한다
  const sizes = states.map((s) => sizeOf(s, u, W, H));
  const springs = states.map((s) => spring({frame: frame - Math.round((s.t - start) * fps), fps, config: SPRING.pop}));
  let w = sizes[0].w * springs[0];
  let h = sizes[0].h * springs[0];
  let r = sizes[0].r;
  for (let i = 1; i < states.length; i++) {
    w += (sizes[i].w - sizes[i - 1].w) * springs[i];
    h += (sizes[i].h - sizes[i - 1].h) * springs[i];
    r += (sizes[i].r - sizes[i - 1].r) * Math.min(1, springs[i]);
  }
  // 현재 보이는 상태
  let cur = 0;
  states.forEach((s, i) => {
    if (now >= s.t) cur = i;
  });

  // 커서 경로: 상태별 상호작용 지점
  const cx = W / 2;
  const cy = H / 2;
  const path: {t: number; x: number; y: number}[] = [];
  const clicks: number[] = [];
  states.forEach((s, i) => {
    const sz = sizes[i];
    if (s.kind === 'chat') {
      const tSend = s.t + 0.35 + Array.from(s.prompt).length / 22;
      path.push({t: s.t + 0.2, x: cx + sz.w * 0.55, y: cy + sz.h * 0.5});
      path.push({t: tSend - 0.05, x: cx + sz.w / 2 - 70 * u, y: cy + sz.h / 2 - 70 * u});
      clicks.push(tSend);
    } else if (s.kind === 'toggle') {
      path.push({t: s.t + 0.1, x: cx + sz.w * 0.6, y: cy + sz.h * 0.9});
      path.push({t: s.t + 0.45, x: cx + sz.w / 2 - 110 * u, y: cy + 10 * u});
      clicks.push(s.t + 0.55);
    } else if (s.kind === 'card' || s.kind === 'pill') {
      path.push({t: s.t + 0.25, x: cx + sz.w * 0.35, y: cy + sz.h * 0.4});
    }
  });

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', opacity: 1 - out}}>
      <div
        style={{
          position: 'relative',
          width: Math.max(0, w),
          height: Math.max(0, h),
          borderRadius: r,
          background: t.paper,
          boxShadow: `0 40px 80px ${t.shadow}, 0 2px 6px ${alpha('#000000', 0.06)}`,
          border: `1.5px solid ${alpha(t.dark ? '#ffffff' : '#000000', 0.07)}`,
          overflow: 'hidden',
          transform: `translateY(${-out * 40}px)`,
        }}
      >
        {states.map((s, i) => {
          const inP = Math.min(1, springs[i] * 1.4);
          const outP = i + 1 < states.length ? Math.min(1, springs[i + 1] * 2.2) : 0;
          const op = inP * (1 - outP);
          if (op <= 0.001) return null;
          return (
            <div key={i} style={{position: 'absolute', inset: 0, opacity: op, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <Content s={s} u={u} size={sizes[i]} active={i === cur} />
            </div>
          );
        })}
      </div>
      {cursor && path.length ? <Cursor path={path} clicks={clicks} size={60 * u} /> : null}
    </AbsoluteFill>
  );
};

const Content: React.FC<{s: MorphState; u: number; size: {w: number; h: number}; active: boolean}> = ({s, u, size}) => {
  const t = useTheme();
  const now = useNow();
  switch (s.kind) {
    case 'pill':
      return (
        <div style={{display: 'flex', alignItems: 'center', gap: 20 * u, whiteSpace: 'nowrap', fontFamily: FONT.sans, fontWeight: 800, fontSize: 70 * u, color: t.ink, letterSpacing: '-0.03em'}}>
          {s.object ? <ObjIcon name={s.object} size={112 * u} /> : <div style={{width: 22 * u, height: 22 * u, borderRadius: 99, background: t.accent}} />}
          {s.text}
        </div>
      );
    case 'card':
      return (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 * u, padding: 40 * u, textAlign: 'center'}}>
          {s.object ? <ObjIcon name={s.object} size={220 * u} /> : null}
          <KText text={s.title} at={s.t + 0.15} size={fitSize(s.title, 88 * u, size.w - 100 * u)} exit="none" />
          {s.sub ? <div style={{fontFamily: FONT.sans, fontSize: 42 * u, color: t.muted, fontWeight: 500}}>{s.sub}</div> : null}
        </div>
      );
    case 'chat': {
      const tSend = s.t + 0.35 + Array.from(s.prompt).length / 22;
      const sent = now >= tSend;
      return (
        <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column'}}>
          <div style={{height: 76 * u, display: 'flex', alignItems: 'center', gap: 12 * u, padding: `0 ${30 * u}px`, borderBottom: `1.5px solid ${alpha(t.ink, 0.07)}`}}>
            {[0, 1, 2].map((k) => (
              <div key={k} style={{width: 18 * u, height: 18 * u, borderRadius: 99, background: alpha(t.ink, 0.15)}} />
            ))}
            <div style={{marginLeft: 12 * u, fontFamily: FONT.sans, fontWeight: 700, fontSize: 30 * u, color: t.muted}}>{s.app ?? 'AI Chat'}</div>
          </div>
          <div style={{flex: 1, padding: 34 * u, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 24 * u}}>
            {sent ? <Bubble at={tSend} side="right" size={44 * u} maxWidth={size.w * 0.78}>{s.prompt}</Bubble> : null}
            {sent && s.reply ? (
              <Bubble at={tSend + 0.7} side="left" size={44 * u} maxWidth={size.w * 0.8}>
                <TypeText text={s.reply} at={tSend + 0.8} cps={26} caret={false} />
              </Bubble>
            ) : null}
          </div>
          <div style={{margin: 26 * u, marginTop: 0, height: 96 * u, borderRadius: 48 * u, background: t.paper2, display: 'flex', alignItems: 'center', padding: `0 ${14 * u}px 0 ${34 * u}px`, gap: 16 * u}}>
            <div style={{flex: 1, fontFamily: FONT.sans, fontSize: 38 * u, color: sent ? t.muted : t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
              {sent ? '메시지 입력…' : <TypeText text={s.prompt} at={s.t + 0.35} cps={22} />}
            </div>
            <div style={{width: 70 * u, height: 70 * u, borderRadius: 99, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg width={34 * u} height={34 * u} viewBox="0 0 24 24"><path d="M12 19 V5 M5 12 L12 5 L19 12" stroke={t.accentInk} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        </div>
      );
    }
    case 'toggle': {
      const k = interpolate(now, [s.t + 0.55, s.t + 0.8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
      const on = s.on === false ? 1 - k : k;
      const tw = 200 * u;
      const th = 112 * u;
      return (
        <div style={{display: 'flex', alignItems: 'center', gap: 40 * u, padding: `0 ${60 * u}px`, width: '100%', boxSizing: 'border-box', justifyContent: 'space-between'}}>
          <div style={{fontFamily: FONT.sans, fontWeight: 800, fontSize: fitSize(s.label, 70 * u, size.w - tw - 160 * u), color: t.ink, letterSpacing: '-0.03em'}}>{s.label}</div>
          <div style={{width: tw, height: th, borderRadius: th, background: on > 0.5 ? t.accent : alpha(t.ink, 0.15), position: 'relative', flex: 'none'}}>
            <div style={{position: 'absolute', top: 10 * u, left: 10 * u + on * (tw - th), width: th - 20 * u, height: th - 20 * u, borderRadius: 99, background: '#fff', boxShadow: `0 6px 14px ${alpha('#000000', 0.2)}`}} />
          </div>
        </div>
      );
    }
    case 'terminal': {
      const typeAt = s.t + 0.2;
      const chars = Array.from(s.command).length;
      const enter = s.enterAt ?? typeAt + chars / 20;
      const cps = chars / Math.max(0.3, enter - typeAt - 0.08);
      const ran = now >= enter;
      const line = {fontFamily: FONT.mono, fontSize: 44 * u, lineHeight: `${64 * u}px`, whiteSpace: 'pre' as const, color: '#E6EDF3'};
      return (
        <div style={{position: 'absolute', inset: 0, background: '#0D1117', display: 'flex', flexDirection: 'column'}}>
          <div style={{height: 76 * u, display: 'flex', alignItems: 'center', gap: 14 * u, padding: `0 ${30 * u}px`, background: '#161B22', borderBottom: `1.5px solid ${alpha('#ffffff', 0.06)}`}}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => (
              <div key={c} style={{width: 20 * u, height: 20 * u, borderRadius: 99, background: c}} />
            ))}
            <div style={{flex: 1, textAlign: 'center', marginRight: 80 * u, fontFamily: FONT.mono, fontSize: 28 * u, color: alpha('#E6EDF3', 0.5)}}>{s.title ?? 'Terminal'}</div>
          </div>
          <div style={{flex: 1, padding: `${34 * u}px ${40 * u}px`}}>
            <div style={line}>
              <span style={{color: t.accent}}>$ </span>
              {ran ? s.command : <TypeText text={s.command} at={typeAt} cps={cps} />}
            </div>
            {ran
              ? (s.output ?? []).map((o, k) => {
                  const at = enter + 0.12 + k * 0.18;
                  return now >= at ? (
                    <div key={k} style={{...line, color: alpha('#E6EDF3', 0.62), opacity: interpolate(now, [at, at + 0.08], [0, 1], {extrapolateRight: 'clamp'})}}>
                      {o}
                    </div>
                  ) : null;
                })
              : null}
          </div>
        </div>
      );
    }
    case 'search':
      return (
        <div style={{display: 'flex', alignItems: 'center', gap: 24 * u, width: '100%', padding: `0 ${46 * u}px`, boxSizing: 'border-box'}}>
          <svg width={54 * u} height={54 * u} viewBox="0 0 24 24"><circle cx={10.5} cy={10.5} r={6.5} stroke={t.accent} strokeWidth={2.6} fill="none" /><path d="M15.5 15.5 L20 20" stroke={t.accent} strokeWidth={2.6} strokeLinecap="round" /></svg>
          <div style={{fontFamily: FONT.sans, fontSize: 50 * u, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap'}}>
            <TypeText text={s.query} at={s.t + 0.3} cps={16} />
          </div>
        </div>
      );
  }
};

// ─────────────────────────────────────────── media: 직접 만든 이미지·영상 (Flow 등)
export type MediaProps = {src: string; kind?: 'image' | 'video'; title?: string; at?: number; framed?: boolean};

export const Media: React.FC<MediaProps> = (p) => {
  const {start, end} = useScene();
  const {w, h, u} = useStage();
  const t = useTheme();
  const now = useNow();
  const s = useSpringAt(start, 'soft');
  const out = useExit(0.35);
  const kb = interpolate(now, [start, end], [1.0, 1.08]); // 켄 번즈: 아주 느린 밀어 들어가기
  const framed = p.framed ?? true;
  const src = p.src.startsWith('http') ? p.src : staticFile(p.src);
  const isVideo = p.kind === 'video' || /\.(mp4|mov|webm)$/i.test(p.src);
  const boxW = framed ? w * 0.88 : w;
  const boxH = framed ? h * (p.title ? 0.66 : 0.8) : h;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 36 * u}}>
      {p.title ? <KText text={p.title} at={p.at ?? start + 0.3} size={fitSize(p.title, 90 * u, w * 0.86)} /> : null}
      <div
        style={{
          width: boxW,
          height: boxH,
          borderRadius: framed ? 30 * u : 0,
          overflow: 'hidden',
          boxShadow: framed ? `0 40px 80px ${t.shadow}` : undefined,
          opacity: Math.min(1, s * 2) * (1 - out),
          transform: `translateY(${(1 - s) * 80}px) scale(${interpolate(s, [0, 1], [0.94, 1])})`,
        }}
      >
        <div style={{width: '100%', height: '100%', transform: `scale(${kb})`}}>
          {isVideo ? (
            <OffthreadVideo src={src} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          ) : (
            <Img src={src} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
