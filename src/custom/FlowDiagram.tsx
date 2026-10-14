import React from 'react';
import {AbsoluteFill, interpolate} from 'remotion';
import {KText} from '../kit/KText';
import {fitSize} from '../kit/measure';
import {clamp01, EASE, useExit, useNow, useScene, useSpringAt} from '../kit/motion';
import {ObjIcon} from '../kit/Object3D';
import {useStage} from '../kit/stage';
import {alpha, FONT, useTheme} from '../kit/theme';

/**
 * 흐름도: 노드가 차례로 뜨고, 그 사이 연결선이 그려진 뒤 강조색 점이 선을 따라 흐른다.
 * 돈·물건·정보가 "어디서 어디로" 가는지 보여 줄 때 (충전 → 통장 → 커피 → 매출, 락인 → 운용 → 낙전).
 *  - shape "chain"(기본): 가로 무대는 왼→오 한 줄, 세로 무대에서 4개 이상이면 위→아래
 *  - shape "loop": 타원 위에 놓고 마지막 → 첫 노드로 돌아온다 (반복되는 구조: 충전 → 남은 잔액 → 또 충전)
 * 시각(원본 초): nodes[].at (없으면 0.6초 간격), edges[].at (없으면 도착 노드 0.4초 전), titleTimes
 * edges 를 비우면 노드 순서대로 잇는다. 출처: 캐릭터 영상 기획안의 "프로세스 다이어그램"(연결선·노드 애니메이션).
 */
export type FlowNode = {id?: string; text: string; sub?: string; object?: string; at?: number; accent?: boolean};
export type FlowEdge = {from: number | string; to: number | string; label?: string; at?: number};
export type FlowDiagramProps = {title?: string; titleTimes?: number[]; nodes: FlowNode[]; edges?: FlowEdge[]; shape?: 'chain' | 'loop'};

type P = {x: number; y: number};
const SAMPLES = 28;

export const FlowDiagram: React.FC<FlowDiagramProps> = ({title, titleTimes, nodes, edges, shape = 'chain'}) => {
  const {start, end} = useScene();
  const {w, h, u, wide} = useStage();
  const t = useTheme();
  const now = useNow();
  const out = useExit(0.3);
  const n = Math.max(1, nodes.length);
  const loop = shape === 'loop';

  // ── 노드 자리 (무대 기준, 가운데 좌표)
  const top = title ? h * (wide ? 0.2 : 0.16) : 0;
  const areaH = h - top;
  const vertical = !loop && !wide && n >= 4;
  const hasObj = nodes.some((nd) => nd.object);
  const gapE = (edges?.some((e) => e.label) ? 110 : 80) * u; // 한 줄 흐름도의 노드 사이 (선이 보일 만큼)
  const nodeW = loop ? Math.min(330 * u, w * 0.3) : vertical ? Math.min(560 * u, w * 0.7) : Math.min(330 * u, (w * 0.92 - (n - 1) * gapE) / n);
  const nodeH = (vertical ? 120 : hasObj ? 230 : 150) * u;
  const pos: P[] = nodes.map((_, i) => {
    if (loop) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      return {x: w / 2 + Math.cos(a) * w * (wide ? 0.3 : 0.32), y: top + areaH / 2 + Math.sin(a) * areaH * 0.33};
    }
    if (vertical) return {x: w / 2, y: top + (areaH * (i + 0.5)) / n};
    return {x: (w * (i + 0.5)) / n, y: top + areaH / 2};
  });

  // ── 시각
  const nodeAt = nodes.map((nd, i) => nd.at ?? start + 0.35 + i * 0.6);
  const idx = (k: number | string) => (typeof k === 'number' ? k : nodes.findIndex((nd) => nd.id === k));
  const list: FlowEdge[] = edges?.length ? edges : nodes.slice(1).map((_, i) => ({from: i, to: i + 1})).concat(loop && n > 2 ? [{from: n - 1, to: 0}] : []);

  // ── 연결선: 노드 가장자리에서 가장자리까지. loop 는 타원 호, 나머지는 직선 (점 SAMPLES 개)
  const pad = 22 * u;
  const edgeGeo = list.map((e) => {
    const a = idx(e.from);
    const b = idx(e.to);
    if (a < 0 || b < 0) return null;
    const A = pos[a];
    const B = pos[b];
    let pts: P[];
    if (loop) {
      const cx = w / 2;
      const cy = top + areaH / 2;
      const rx = w * (wide ? 0.3 : 0.32);
      const ry = areaH * 0.33;
      const ang = (p: P) => Math.atan2((p.y - cy) / ry, (p.x - cx) / rx);
      const a0 = ang(A);
      let a1 = ang(B);
      while (a1 <= a0) a1 += Math.PI * 2;
      const trim = (nodeW / 2 + pad) / Math.max(rx, ry) + 0.12;
      pts = Array.from({length: SAMPLES}, (_, k) => {
        const q = a0 + trim + ((a1 - trim - (a0 + trim)) * k) / (SAMPLES - 1);
        return {x: cx + Math.cos(q) * rx, y: cy + Math.sin(q) * ry};
      });
    } else {
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = Math.abs(dx) > Math.abs(dy) ? nodeW / 2 + pad : nodeH / 2 + pad;
      const s0 = off / len;
      const s1 = 1 - off / len;
      pts = Array.from({length: SAMPLES}, (_, k) => {
        const s = s0 + ((s1 - s0) * k) / (SAMPLES - 1);
        return {x: A.x + dx * s, y: A.y + dy * s};
      });
    }
    const at = e.at ?? Math.max(nodeAt[a] + 0.25, nodeAt[b] - 0.4);
    // 라벨 자리: 노드 사이가 좁으니 선 위가 아니라 — 한 줄이면 줄 아래, 세로면 선 오른쪽, 고리면 바깥쪽
    const mid = pts[Math.floor(SAMPLES / 2)];
    const cx = w / 2;
    const cy = top + areaH / 2;
    const d = Math.hypot(mid.x - cx, mid.y - cy) || 1;
    const lab: P & {align: 'center' | 'left'} = loop
      ? {x: mid.x + ((mid.x - cx) / d) * 54 * u, y: mid.y + ((mid.y - cy) / d) * 40 * u, align: 'center'}
      : vertical
        ? {x: mid.x + 36 * u, y: mid.y, align: 'left'}
        : {x: mid.x, y: mid.y + nodeH / 2 + 56 * u, align: 'center'};
    return {pts, at, label: e.label, lab};
  });

  const titleSize = (wide ? 80 : 96) * u;
  return (
    <AbsoluteFill style={{opacity: 1 - out}}>
      {title ? (
        <div style={{position: 'absolute', left: 0, right: 0, top: top * 0.2, display: 'flex', justifyContent: 'center'}}>
          <KText text={title} at={start + 0.1} times={titleTimes} size={fitSize(title, titleSize, w * 0.9, titleSize * 0.6)} />
        </div>
      ) : null}

      <svg width={w} height={h} style={{position: 'absolute', overflow: 'visible'}}>
        {edgeGeo.map((g, i) => (g ? <Edge key={i} pts={g.pts} at={g.at} now={now} end={end} u={u} /> : null))}
      </svg>
      {edgeGeo.map((g, i) => (g?.label ? <EdgeLabel key={i} p={g.lab} align={g.lab.align} at={g.at + 0.35} text={g.label} u={u} /> : null))}

      {nodes.map((nd, i) => (
        <Node key={i} node={nd} at={nodeAt[i]} x={pos[i].x} y={pos[i].y} w={nodeW} h={nodeH} vertical={vertical} u={u} t={t} />
      ))}
    </AbsoluteFill>
  );
};

const pathOf = (pts: P[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

const Edge: React.FC<{pts: P[]; at: number; now: number; end: number; u: number}> = ({pts, at, now, end, u}) => {
  const t = useTheme();
  const draw = interpolate(now, [at, at + 0.45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.out});
  if (draw <= 0) return null;
  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const ang = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI;
  const head = 16 * u;
  // 다 그려진 뒤: 강조색 점이 1.6초에 한 번씩 흐른다 (장면 끝 0.3초 전까지)
  const flowT = now - (at + 0.45);
  const dot = flowT > 0 && now < end - 0.3 ? (flowT / 1.6) % 1 : null;
  const dp = dot == null ? null : pts[Math.min(pts.length - 1, Math.floor(dot * (pts.length - 1)))];
  return (
    <g>
      <path d={pathOf(pts)} fill="none" stroke={alpha(t.ink, 0.38)} strokeWidth={4 * u} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
      <path
        d={`M0,0 L${-head},${-head * 0.6} L${-head},${head * 0.6} Z`}
        fill={alpha(t.ink, 0.55)}
        transform={`translate(${last.x},${last.y}) rotate(${ang}) scale(${clamp01((draw - 0.8) * 5)})`}
      />
      {dp ? <circle cx={dp.x} cy={dp.y} r={9 * u} fill={t.accent} opacity={Math.min(1, dot! * 6, (1 - dot!) * 6)} /> : null}
    </g>
  );
};

const EdgeLabel: React.FC<{p: P; align: 'center' | 'left'; at: number; text: string; u: number}> = ({p, align, at, text, u}) => {
  const t = useTheme();
  const s = useSpringAt(at, 'pop');
  return (
    <div
      style={{
        position: 'absolute',
        left: p.x,
        top: p.y,
        transform: `translate(${align === 'left' ? '0' : '-50%'}, -50%) scale(${s})`,
        transformOrigin: align === 'left' ? 'left center' : 'center',
        padding: `${6 * u}px ${16 * u}px`,
        borderRadius: 999,
        background: t.paper2,
        color: t.ink,
        fontFamily: FONT.sans,
        fontWeight: 700,
        fontSize: 30 * u,
        whiteSpace: 'nowrap',
        boxShadow: `0 8px 20px ${t.shadow}`,
      }}
    >
      {text}
    </div>
  );
};

const Node: React.FC<{node: FlowNode; at: number; x: number; y: number; w: number; h: number; vertical: boolean; u: number; t: ReturnType<typeof useTheme>}> = ({
  node,
  at,
  x,
  y,
  w,
  h,
  vertical,
  u,
  t,
}) => {
  const s = useSpringAt(at, 'pop');
  if (s <= 0.001) return null;
  const hot = !!node.accent;
  const textSize = fitSize(node.text, (vertical ? 46 : 42) * u, (w - 40 * u) * 1.8, 28 * u);
  const icon = node.object ? (vertical ? 84 : 110) * u : 0;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        minHeight: h,
        transform: `translate(-50%, -50%) translateY(${(1 - s) * 40 * u}px) scale(${interpolate(s, [0, 1], [0.85, 1])})`,
        opacity: Math.min(1, s * 2),
        borderRadius: 26 * u,
        background: hot ? t.accent : t.paper,
        boxShadow: `0 22px 44px ${t.shadow}`,
        display: 'flex',
        flexDirection: vertical ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10 * u,
        padding: `${14 * u}px ${20 * u}px`,
        boxSizing: 'border-box',
      }}
    >
      {node.object ? <ObjIcon name={node.object} size={icon} /> : null}
      <div style={{display: 'flex', flexDirection: 'column', alignItems: vertical ? 'flex-start' : 'center', gap: 4 * u}}>
        <div style={{fontFamily: FONT.sans, fontWeight: 800, fontSize: textSize, lineHeight: 1.15, color: hot ? t.accentInk : t.ink, textAlign: vertical ? 'left' : 'center', wordBreak: 'keep-all'}}>
          {node.text}
        </div>
        {node.sub ? (
          <div style={{fontFamily: FONT.sans, fontWeight: 600, fontSize: 28 * u, color: hot ? alpha(t.accentInk, 0.8) : alpha(t.ink, 0.6), wordBreak: 'keep-all'}}>{node.sub}</div>
        ) : null}
      </div>
    </div>
  );
};
