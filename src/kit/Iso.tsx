import React from 'react';
import {alpha} from './theme';

/**
 * 아이소메트릭 2.5D 부품 (온돌 롱폼 참고: 글자 대신 그림이 원리를 설명한다).
 *   iso 좌표 (x, y, z) — x 는 오른쪽 아래, y 는 왼쪽 아래, z 는 위. 단위 1 = S px.
 *   보이는 면 셋: 위(밝기 100%) · y+ 면(왼쪽 앞, 72%) · x+ 면(오른쪽 앞, 55%).
 *   모두 SVG 한 장 안에 그린다. 그리는 순서(뒤 → 앞)는 부르는 쪽이 x+y 가 작은 것부터.
 */
export type Iso = {S: number; ox: number; oy: number};
export type P3 = [number, number, number];

export const proj = (k: Iso, [x, y, z]: P3): [number, number] => [k.ox + (x - y) * k.S * 0.866, k.oy + (x + y) * k.S * 0.5 - z * k.S];
const pts = (k: Iso, ps: P3[]) => ps.map((p) => proj(k, p).map((v) => v.toFixed(1)).join(',')).join(' ');

/** 색을 검정과 섞어 어둡게 (면 밝기) */
export const shade = (hex: string, k: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  const c = (s: number) => Math.round(((n >> s) & 255) * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

/** 화면에 다 들어오도록 S·원점을 정한다: 점들의 범위를 (w × h) 의 fill 비율 안 가운데에 */
export const fitIso = (points: P3[], w: number, h: number, fill = 0.82, dy = 0): Iso => {
  const u = points.map((p) => proj({S: 1, ox: 0, oy: 0}, p));
  const xs = u.map((p) => p[0]);
  const ys = u.map((p) => p[1]);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  const S = Math.min((w * fill) / bw, (h * fill) / bh);
  return {S, ox: w / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * S, oy: h / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * S + dy};
};

/** 상자 모서리 8개 (fitIso 용) */
export const boxCorners = (x: number, y: number, z: number, w: number, d: number, h: number): P3[] => [
  [x, y, z], [x + w, y, z], [x, y + d, z], [x + w, y + d, z],
  [x, y, z + h], [x + w, y, z + h], [x, y + d, z + h], [x + w, y + d, z + h],
];

/** 꽉 찬 상자: 위·왼쪽 앞·오른쪽 앞 세 면 */
export const IsoBox: React.FC<{k: Iso; x: number; y: number; z?: number; w: number; d: number; h: number; color: string; opacity?: number; edge?: string}> = ({
  k, x, y, z = 0, w, d, h, color, opacity = 1, edge,
}) => {
  if (h <= 0.0005) return null;
  const st = edge ? {stroke: edge, strokeWidth: 1} : {};
  return (
    <g opacity={opacity}>
      <polygon points={pts(k, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={shade(color, 0.72)} {...st} />
      <polygon points={pts(k, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])} fill={shade(color, 0.55)} {...st} />
      <polygon points={pts(k, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={color} {...st} />
    </g>
  );
};

/** 돈 더미: 상자 + 앞 두 면에 층 줄무늬(지폐·동전이 켜켜이) + 윗면 동전 몇 개. 그냥 상자면 "주황 큐브" 로만 보인다 */
export const IsoMoney: React.FC<{k: Iso; x: number; y: number; w: number; d: number; h: number; color: string; layer?: number}> = ({k, x, y, w, d, h, color, layer = 0.22}) => {
  if (h <= 0.0005) return null;
  const lines: React.ReactNode[] = [];
  const sw = Math.max(1, k.S * 0.014);
  for (let z = layer; z < h - 0.02; z += layer) {
    const a = proj(k, [x, y + d, z]);
    const b = proj(k, [x + w, y + d, z]);
    const c = proj(k, [x + w, y, z]);
    lines.push(<polyline key={z} points={`${a.join(',')} ${b.join(',')} ${c.join(',')}`} fill="none" stroke={shade(color, 0.42)} strokeWidth={sw} opacity={0.55} />);
  }
  const coins: P3[] = [[x + w * 0.3, y + d * 0.35, h], [x + w * 0.62, y + d * 0.55, h], [x + w * 0.45, y + d * 0.75, h]];
  return (
    <g>
      <IsoBox k={k} x={x} y={y} w={w} d={d} h={h} color={color} />
      {lines}
      {h > 0.15 ? coins.map((p, i) => <IsoCoin key={i} k={k} p={p} color={color} r={0.22} />) : null}
    </g>
  );
};

/** 유리 상자 (금고·방): 옅은 면 + 가는 모서리. back = 뒤쪽 면만(내용물보다 먼저), front = 앞쪽 면(내용물 다음) */
export const IsoGlass: React.FC<{k: Iso; x: number; y: number; z?: number; w: number; d: number; h: number; line: string; part: 'back' | 'front'; tint?: string}> = ({
  k, x, y, z = 0, w, d, h, line, part, tint,
}) => {
  const f = tint ?? line;
  const L = (a: P3, b: P3, o = 0.55) => {
    const [x1, y1] = proj(k, a);
    const [x2, y2] = proj(k, b);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={alpha(line, o)} strokeWidth={Math.max(1, k.S * 0.018)} />;
  };
  if (part === 'back') {
    return (
      <g>
        <polygon points={pts(k, [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]])} fill={alpha(f, 0.1)} />
        <polygon points={pts(k, [[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]])} fill={alpha(f, 0.05)} />
        <polygon points={pts(k, [[x, y, z], [x, y + d, z], [x, y + d, z + h], [x, y, z + h]])} fill={alpha(f, 0.07)} />
        {L([x, y, z], [x, y, z + h], 0.3)}
        {L([x, y, z], [x + w, y, z], 0.3)}
        {L([x, y, z], [x, y + d, z], 0.3)}
      </g>
    );
  }
  return (
    <g>
      <polygon points={pts(k, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]])} fill={alpha(f, 0.06)} />
      <polygon points={pts(k, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]])} fill={alpha(f, 0.04)} />
      {L([x + w, y + d, z], [x + w, y + d, z + h])}
      {L([x + w, y, z], [x + w, y, z + h])}
      {L([x, y + d, z], [x, y + d, z + h])}
      {L([x, y + d, z], [x + w, y + d, z])}
      {L([x + w, y, z], [x + w, y + d, z])}
      {L([x, y, z + h], [x + w, y, z + h])}
      {L([x + w, y, z + h], [x + w, y + d, z + h])}
      {L([x + w, y + d, z + h], [x, y + d, z + h])}
      {L([x, y + d, z + h], [x, y, z + h])}
    </g>
  );
};

/** 동전 하나 (눕힌 원판). 아래 테두리 + 윗면 */
export const IsoCoin: React.FC<{k: Iso; p: P3; color: string; r?: number; opacity?: number}> = ({k, p, color, r = 0.26, opacity = 1}) => {
  const [cx, cy] = proj(k, p);
  const rx = r * k.S * 0.95;
  const ry = r * k.S * 0.55;
  const t = r * k.S * 0.22;
  return (
    <g opacity={opacity}>
      <ellipse cx={cx} cy={cy + t} rx={rx} ry={ry} fill={shade(color, 0.62)} />
      <rect x={cx - rx} y={cy} width={rx * 2} height={t} fill={shade(color, 0.62)} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} />
      <ellipse cx={cx} cy={cy} rx={rx * 0.62} ry={ry * 0.62} fill="none" stroke={shade(color, 0.8)} strokeWidth={Math.max(1, k.S * 0.02)} />
    </g>
  );
};

/** 바닥 격자 (마름모) — 무대가 공중에 뜨지 않게 */
export const IsoFloor: React.FC<{k: Iso; x0: number; y0: number; x1: number; y1: number; line: string}> = ({k, x0, y0, x1, y1, line}) => {
  const ls: React.ReactNode[] = [];
  for (let x = Math.ceil(x0); x <= x1; x++) {
    const [a, b] = proj(k, [x, y0, 0]);
    const [c, d] = proj(k, [x, y1, 0]);
    ls.push(<line key={`x${x}`} x1={a} y1={b} x2={c} y2={d} stroke={line} strokeWidth={1} />);
  }
  for (let y = Math.ceil(y0); y <= y1; y++) {
    const [a, b] = proj(k, [x0, y, 0]);
    const [c, d] = proj(k, [x1, y, 0]);
    ls.push(<line key={`y${y}`} x1={a} y1={b} x2={c} y2={d} stroke={line} strokeWidth={1} />);
  }
  return <g>{ls}</g>;
};

/** 경로 위 u(0~1) 지점: 직선 a→b 에 높이 arc 의 포물선 */
export const along = (a: P3, b: P3, u: number, arc = 0): P3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u + Math.sin(Math.PI * u) * arc];

/**
 * 흐르는 동전들 (결정적 — 프레임만으로 위치가 정해진다): from 시각부터 n 개가 간격을 두고 a → b 로 날아간다.
 * until 이후로는 새로 출발하지 않는다. 각 동전은 dur 초 걸림.
 */
export const coinStream = (now: number, from: number, until: number, n: number, dur: number) => {
  const out: {u: number; i: number}[] = [];
  const gap = Math.max(0.05, (until - from) / n);
  for (let i = 0; i < n; i++) {
    const s = from + i * gap;
    const u = (now - s) / dur;
    if (u > 0 && u < 1) out.push({u, i});
  }
  return out;
};
