import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {useScene, useSpringAt} from '../kit/motion';
import {AppWindow} from '../kit/Parts';
import {useStage} from '../kit/stage';
import {FONT, alpha, useTheme} from '../kit/theme';

// 디자인 문서 한 장: 창 안에 칸이 하나씩 채워진다 — 색 · 글꼴과 간격 · 컴포넌트.
// "파일 안에 뭐가 들어 있냐면" 처럼 디자인 기준의 구성을 말할 때. 색은 영상 트라이어드, 값(HEX·수치)은 쓰지 않는다.
type Row = {label: string; at?: number};

export const TokenSheet: React.FC<{
  file?: string;
  color: Row;
  type: Row;
  component: Row;
  sample?: string;
}> = ({file, color, type, component, sample = '가나다 Aa'}) => {
  const {start} = useScene();
  const {w, h, u} = useStage();
  const t = useTheme();
  const ats = [color.at ?? start + 0.1, type.at ?? start + 1.2, component.at ?? start + 2.4];
  const sp = ats.map((a) => useSpringAt(a, 'pop')); // 길이 고정 → 훅 순서 고정

  const ww = w * 0.9;
  const wh = Math.min(h * 0.92, 1180 * u);
  const rowH = (wh - 64) / 3;
  const pad = 44 * u;
  const inner = ww - pad * 2;
  const line = alpha(t.dark ? '#ffffff' : '#000000', 0.09);
  const rowStyle = (i: number): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    right: 0,
    top: i * rowH,
    height: rowH,
    boxSizing: 'border-box',
    padding: `${30 * u}px ${pad}px`,
    borderTop: i ? `1.5px solid ${line}` : undefined,
    opacity: Math.min(1, sp[i] * 2),
    transform: `translateY(${interpolate(sp[i], [0, 1], [46 * u, 0])}px)`,
  });
  const label = (text: string, i: number) => (
    <div style={{display: 'flex', alignItems: 'center', gap: 18 * u, marginBottom: 22 * u}}>
      <div style={{fontFamily: FONT.mono, fontWeight: 600, fontSize: 40 * u, color: t.accent}}>#</div>
      <div style={{fontFamily: FONT.head, fontWeight: 800, fontSize: 52 * u, color: t.ink, wordBreak: 'keep-all'}}>{text}</div>
      <div style={{marginLeft: 'auto', fontFamily: FONT.mono, fontSize: 34 * u, color: t.muted}}>0{i + 1}</div>
    </div>
  );
  const body = rowH - 60 * u - 96 * u;
  const swatches = [t.triad.dark, t.triad.accent, t.triad.light, t.accent];

  return (
    <AbsoluteFill>
      <AppWindow title={file} w={ww} h={wh} x={w / 2} y={h / 2} at={start + 0.02} z={0.5}>
        <div style={rowStyle(0)}>
          {label(color.label, 0)}
          <div style={{display: 'flex', gap: 18 * u, height: body}}>
            {swatches.map((c, i) => {
              const k = interpolate(sp[0], [0, 1], [0.5, 1]);
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    borderRadius: 24 * u,
                    background: c,
                    border: `1.5px solid ${line}`,
                    transform: `scaleY(${k})`,
                    transformOrigin: 'bottom',
                  }}
                />
              );
            })}
          </div>
        </div>
        <div style={rowStyle(1)}>
          {label(type.label, 1)}
          <div style={{position: 'relative', height: body, display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{fontFamily: FONT.myeongjo, fontWeight: 400, fontSize: Math.min(body * 0.72, inner * 0.13), color: t.ink, whiteSpace: 'nowrap'}}>{sample}</div>
            <div style={{display: 'flex', alignItems: 'center', gap: 0, height: body * 0.6}}>
              <div style={{width: 5 * u, height: '100%', background: t.accent}} />
              <div style={{width: interpolate(sp[1], [0, 1], [10, 120]) * u, height: 5 * u, background: t.accent}} />
              <div style={{width: 5 * u, height: '100%', background: t.accent}} />
            </div>
          </div>
        </div>
        <div style={rowStyle(2)}>
          {label(component.label, 2)}
          <div style={{display: 'flex', alignItems: 'center', gap: 26 * u, height: body}}>
            <div style={{height: body * 0.62, padding: `0 ${48 * u}px`, display: 'flex', alignItems: 'center', borderRadius: 999, background: t.accent, color: t.accentInk, fontFamily: FONT.sans, fontWeight: 800, fontSize: 40 * u}}>버튼</div>
            <div style={{height: body * 0.62, padding: `0 ${48 * u}px`, display: 'flex', alignItems: 'center', borderRadius: 999, border: `3px solid ${alpha(t.ink, 0.5)}`, color: t.ink, fontFamily: FONT.sans, fontWeight: 700, fontSize: 40 * u, boxSizing: 'border-box'}}>버튼</div>
            <div style={{marginLeft: 'auto', width: body * 1.1, height: body * 0.58, borderRadius: 999, background: t.accent, position: 'relative'}}>
              <div style={{position: 'absolute', top: body * 0.05, left: interpolate(sp[2], [0, 1], [body * 0.05, body * 0.57]), width: body * 0.48, height: body * 0.48, borderRadius: '50%', background: t.accentInk}} />
            </div>
          </div>
        </div>
      </AppWindow>
    </AbsoluteFill>
  );
};
