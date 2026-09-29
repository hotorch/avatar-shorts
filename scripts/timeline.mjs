// 시간 3종을 한곳에서 다룬다 (여기서만 바꾼다)
//   원본 시간  : input.mp4 기준 초. words.json · captions.json · plan.json 이 쓰는 시간
//   편집 시간  : edit.mp4 기준 초. edit.py 가 무음을 줄이고 순서를 바꾼 뒤의 시간 (cuts.json)
//   렌더 프레임: 편집 시간 × 컴포지션 fps(기본 30). 원본 fps(25 등)와 다르다!
import fs from 'node:fs';
import path from 'node:path';

export const COMP_FPS = 30;

export const loadCuts = (dir) => {
  const p = path.join(dir, 'cuts.json');
  if (!fs.existsSync(p) || !fs.existsSync(path.join(dir, 'edit.mp4'))) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

/** 원본 시각 → {t: 편집 시각, i: 조각 번호}. 잘린 자리면 원본에서 바로 다음(start)/바로 앞(end) 조각 경계로. 못 찾으면 null */
export const mapTime = (cuts, x, side = 'start') => {
  if (!cuts) return {t: x, i: 0};
  const segs = cuts.segments;
  for (let i = 0; i < segs.length; i++) {
    const [s, e] = segs[i].src;
    if (x >= s - 1e-6 && x <= e + 1e-6) return {t: segs[i].out[0] + (x - s), i};
  }
  let best = null;
  segs.forEach((g, i) => {
    if (side === 'start' && g.src[0] > x && (!best || g.src[0] < segs[best.i].src[0])) best = {t: g.out[0], i};
    if (side === 'end' && g.src[1] < x && (!best || g.src[1] > segs[best.i].src[1])) best = {t: g.out[1], i};
  });
  return best;
};

const TIME_KEY = /^(in|out|t|at|times|titleTimes|[a-z]+At)$/;

/** 장면 하나를 편집 시간으로. 문제가 있으면 {problem} */
export const remapScene = (cuts, sc) => {
  const a = mapTime(cuts, sc.in, 'start');
  const b = mapTime(cuts, sc.out, 'end');
  if (!a || !b || b.t <= a.t || b.i < a.i)
    return {problem: `장면 ${sc.id}: 원본 ${sc.in}–${sc.out}s 가 편집으로 잘렸거나 순서가 바뀐 경계를 넘습니다 — 나누거나 edit.json 을 확인하세요`};
  for (let i = a.i; i < b.i; i++)
    if (Math.abs(cuts.segments[i + 1].src[0] - cuts.segments[i].src[1]) > 3)
      return {problem: `장면 ${sc.id}: 재배치된 두 부분에 걸쳐 있습니다 — 한쪽에만 두세요`};
  const m = (v) => +((mapTime(cuts, v, 'start') ?? {t: v}).t.toFixed(3));
  const walk = (v, k) => {
    if (typeof v === 'number' && TIME_KEY.test(k)) return m(v);
    if (Array.isArray(v)) return v.map((x) => walk(x, k));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([kk, x]) => [kk, walk(x, kk)]));
    return v;
  };
  return {scene: {...sc, props: walk(sc.props, ''), sfx: sc.sfx?.map((e) => ({...e, t: m(e.t)})), in: +a.t.toFixed(3), out: +b.t.toFixed(3)}};
};

/** 장면 props 안에서 가장 이른 등장 시각 (빈 화면 검사용). 시간 값이 없으면 null */
export const firstBeat = (sc) => {
  let min = null;
  const walk = (v, k) => {
    if (typeof v === 'number' && TIME_KEY.test(k) && k !== 'in' && k !== 'out') min = min == null ? v : Math.min(min, v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
    else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, x]) => walk(x, kk));
  };
  walk(sc.props, '');
  return min;
};

export const toFrame = (t, fps = COMP_FPS) => Math.max(0, Math.round(t * fps));
