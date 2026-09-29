// 세로 쇼츠(1080×1920)에서 아바타 머리와 B-roll 자리를 정한다.
// Remotion(Vertical.tsx)과 검사(scripts/render.mjs)가 이 파일 하나를 같이 쓴다 → 검사를 통과한 배치가 곧 화면.
//
//   머리 상자: video.json 의 track(face.py 가 초당 4장 잰 정수리·턱·좌우). 없으면 head(중앙값), 그것도 없으면 faceX/faceY 로 짐작.
//   아바타 변환: 화면' = s·화면 + (tx, ty)   (transform-origin 0 0)
//   장면 방식(mode)
//     panel   위 칸이 B-roll 판. 정수리가 판 아래 GAP 에 오도록 내리고, 머리가 크면 판을 줄이고, 그래도 크면 아바타를 줄인다
//     above   머리 위에 떠 있는 카드. 머리 위 공간이 모자라면 아바타를 내린다 (드러난 위쪽은 흐린 영상으로 채움)
//     below   턱 아래 가슴 쪽 카드. 모자라면 자막을 내리고, 그래도 모자라면 아바타를 올린다
//     cutaway 화면 전체 교체 (아바타는 그대로 두고 덮는다)
//   이웃한 같은 방식 장면(0.6초 이내)은 한 구간으로 묶어 한 번만 배치한다 → 장면 사이에 아바타가 들썩이지 않는다.

export const FRAME = {
  W: 1080,
  H: 1920,
  SAFE_TOP: 120, // 위쪽 플랫폼 UI
  UI_BOTTOM: 1670, // 이 아래는 플랫폼 UI (자막도 이 위에서 끝난다)
  CAPTION_Y: 1470, // 기본 자막 위치(위 끝)
  CAP_H: 120, // 자막 한 줄 자리 (big 포함)
  CAP_GAP: 28, // 턱·카드와 자막 사이
  GAP: 36, // 머리와 판·카드 사이 (정책 face.gapPx 가 덮어쓴다)
  PANEL_MAX: 1010,
  PANEL_MIN: 760,
  FLOAT_X: 60, // 떠 있는 카드 좌우 여백
  ABOVE: {min: 300, want: 400, max: 480},
  BELOW: {min: 340, want: 440, max: 560},
  HEAD_TOP_MIN: 70, // 아바타를 올릴 때 정수리 한계
  S_MIN: 0.8, // 아바타를 이보다 작게 줄이지 않는다
  MERGE_GAP: 0.6,
  RAMP: 0.4, // 들어오고 나가는 시간(초)
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** 원본 영상 기준 0~1 좌표 → 화면 px (object-fit: cover) */
const toScreen = (video, n) => {
  const {W, H} = FRAME;
  const vw = video?.width || W;
  const vh = video?.height || H;
  const c = Math.max(W / vw, H / vh);
  const ox = (W - vw * c) / 2;
  const oy = (H - vh * c) / 2;
  return {top: oy + n.top * vh * c, chin: oy + n.chin * vh * c, left: ox + n.left * vw * c, right: ox + n.right * vw * c};
};

/**
 * 머리 상자(화면 px). a~b 초 동안 머리가 움직인 범위 전체 (양 끝 한 장씩은 튀는 값으로 보고 버린다).
 * a 를 안 주면 영상 전체의 중앙값(head).
 */
export const headBox = (video, a, b) => {
  const tr = a == null ? [] : (video?.track ?? []).filter((r) => r[0] >= a - 0.25 && r[0] <= b + 0.25);
  let n;
  if (tr.length >= 2) {
    const k = tr.length >= 10 ? 1 : 0;
    const col = (j) => tr.map((r) => r[j]).sort((x, y) => x - y);
    n = {top: col(1)[k], chin: col(2)[tr.length - 1 - k], left: col(3)[k], right: col(4)[tr.length - 1 - k]};
  } else if (video?.head) n = video.head;
  else if (!video?.src) n = {top: 0.4, chin: 0.62, left: 0.3, right: 0.7}; // 영상 없음(데모): 가운데 자리표시 인형 + 글자
  else {
    const fx = video?.faceX ?? 0.5;
    const fy = video?.faceY ?? 0.36;
    n = {top: fy - 0.2, chin: fy + 0.13, left: fx - 0.2, right: fx + 0.2};
  }
  return toScreen(video, n);
};

/** 한 방식의 배치. 머리 h(화면 px) → {s, tx, ty, panel, box, capY, top, chin, issues} */
export const fitFrame = (mode, h, opts = {}) => {
  const F = {...FRAME, ...opts};
  const hh = h.chin - h.top;
  const cx = (h.left + h.right) / 2;
  const capFor = (chin) => clamp(Math.max(F.CAPTION_Y, chin + F.CAP_GAP), 0, F.UI_BOTTOM - F.CAP_H);
  let s = 1;
  let ty = 0;
  let panel = null;
  let box = null;
  let capY;
  const issues = [];

  if (mode === 'panel') {
    const fixed = F.UI_BOTTOM - F.CAP_H - F.CAP_GAP - F.GAP; // 판 아래에 머리·자막이 들어갈 자리의 끝
    panel = Math.min(F.PANEL_MAX, fixed - hh);
    if (panel < F.PANEL_MIN) {
      panel = F.PANEL_MIN;
      s = Math.max(F.S_MIN, (fixed - panel) / hh);
    }
    ty = panel + F.GAP - s * h.top;
    if (s >= 1 && ty < 0) ty = 0; // 머리 위가 원래 넉넉하면 끌어올리지 않는다 (아래가 비므로)
    capY = capFor(s * h.chin + ty);
  } else if (mode === 'above') {
    const limit = (sc) => F.UI_BOTTOM - F.CAP_H - F.CAP_GAP - sc * h.chin; // 턱+자막이 들어가는 한 내릴 수 있는 만큼
    const want = F.SAFE_TOP + F.ABOVE.want + F.GAP; // 머리 위가 이만큼 안 되면 내린다
    if (h.top < want) ty = Math.max(0, Math.min(want - h.top, limit(1)));
    if (h.top + ty - F.GAP - F.SAFE_TOP < F.ABOVE.min) {
      s = clamp((F.UI_BOTTOM - F.CAP_H - F.CAP_GAP - (F.SAFE_TOP + F.ABOVE.min + F.GAP)) / hh, F.S_MIN, 1);
      ty = F.SAFE_TOP + F.ABOVE.min + F.GAP - s * h.top;
    }
    const bottom = s * h.top + ty - F.GAP;
    const bh = Math.min(F.ABOVE.max, bottom - F.SAFE_TOP);
    box = {x: F.FLOAT_X, y: bottom - bh, w: F.W - 2 * F.FLOAT_X, h: bh};
    capY = capFor(s * h.chin + ty);
    if (bh < F.ABOVE.min - 1) issues.push(`머리 위 공간이 ${Math.round(bh)}px 뿐입니다 (최소 ${F.ABOVE.min}) → below 나 panel 로`);
  } else if (mode === 'below') {
    capY = F.CAPTION_Y;
    const room = () => capY - F.CAP_GAP - (s * h.chin + ty + F.GAP);
    if (room() < F.BELOW.want) capY = F.UI_BOTTOM - F.CAP_H; // 자막을 아래로
    if (room() < F.BELOW.want) ty = -Math.min(F.BELOW.want - room(), Math.max(0, h.top - F.HEAD_TOP_MIN)); // 아바타를 위로
    if (room() < F.BELOW.min) {
      s = clamp((capY - F.CAP_GAP - F.BELOW.min - F.GAP - F.HEAD_TOP_MIN) / hh, F.S_MIN, 1);
      ty = F.HEAD_TOP_MIN - s * h.top;
    }
    const y = s * h.chin + ty + F.GAP;
    const bh = Math.min(F.BELOW.max, capY - F.CAP_GAP - y);
    box = {x: F.FLOAT_X, y, w: F.W - 2 * F.FLOAT_X, h: bh};
    if (bh < F.BELOW.min - 1) issues.push(`턱 아래 공간이 ${Math.round(bh)}px 뿐입니다 (최소 ${F.BELOW.min}) → above 나 panel 로`);
  } else {
    capY = mode === 'cutaway' ? F.CAPTION_Y : capFor(h.chin);
  }

  // 가로: 원래 크기면 머리 x 를 그대로 두고(화면이 비지 않게), 줄였으면 가운데로
  let tx = cx - s * cx;
  tx = s >= 1 ? clamp(tx, F.W - F.W * s, 0) : (F.W - F.W * s) / 2;
  const top = s * h.top + ty;
  const chin = s * h.chin + ty;
  if (mode !== 'cutaway' && chin + F.CAP_GAP > capY + 0.5) issues.push(`자막이 턱을 가립니다 (${Math.round(chin + F.CAP_GAP - capY)}px)`);
  if (panel != null && top < panel + F.GAP - 0.5) issues.push(`판이 정수리를 가립니다 (${Math.round(panel + F.GAP - top)}px)`);
  return {
    mode,
    s: +s.toFixed(4),
    tx: +tx.toFixed(1),
    ty: +ty.toFixed(1),
    panel: panel == null ? null : Math.round(panel),
    box: box && {x: box.x, y: Math.round(box.y), w: box.w, h: Math.round(box.h)},
    capY: Math.round(capY),
    top: Math.round(top),
    chin: Math.round(chin),
    // 영상이 화면을 다 못 덮는다 → 흐린 영상으로 채움 (panel 은 위쪽 빈 곳을 판이 가린다)
    fill: ty > (panel ?? 0) + 0.5 || F.H - (s * F.H + ty) > 0.5 || s < 1,
    issues,
  };
};

/** 장면들 → 배치 구간 (같은 방식이 0.6초 안에 이어지면 묶음). 컷어웨이는 아바타를 움직이지 않는다 */
export const buildFraming = (scenes, video, opts = {}) => {
  const segs = [];
  for (const sc of [...scenes].filter((s) => s.mode !== 'cutaway').sort((a, b) => a.in - b.in)) {
    const mode = sc.mode === 'above' || sc.mode === 'below' ? sc.mode : 'panel';
    const last = segs[segs.length - 1];
    if (last && last.mode === mode && sc.in - last.out <= FRAME.MERGE_GAP) {
      last.out = Math.max(last.out, sc.out);
      last.scenes.push(sc);
    } else segs.push({mode, in: sc.in, out: sc.out, scenes: [sc]});
  }
  return segs.map((g) => ({...g, fit: fitFrame(g.mode, headBox(video, g.in, g.out), opts)}));
};

/** 장면이 없을 때(얼굴만)의 배치: 자막이 턱을 가리지 않는 자리 */
export const faceFrame = (video, opts = {}) => fitFrame('face', headBox(video), opts);

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** 구간 안이면 1, 밖이면 0. 들어올 때 RAMP 초, 나갈 때 조금 더 빨리 */
export const ramp = (a, b, now, dur = FRAME.RAMP) => {
  const d = Math.min(dur, (b - a) / 2.4);
  const p = (x, x0, x1) => clamp((x - x0) / (x1 - x0), 0, 1);
  if (now <= a - 0.05 || now >= b) return 0;
  if (now < a + d) return easeInOut(p(now, a - 0.05, a + d));
  if (now > b - d * 0.8) return 1 - easeInOut(p(now, b - d * 0.8, b));
  return 1;
};

/** now 초의 아바타 변환·자막 위치 (구간끼리 부드럽게 섞음) */
export const frameAt = (segs, base, now) => {
  let s = 1;
  let tx = 0;
  let ty = 0;
  let capY = base.capY;
  let k = 0;
  let fill = 0;
  for (const g of segs) {
    const w = ramp(g.in, g.out, now);
    if (w <= 0) continue;
    s += w * (g.fit.s - 1);
    tx += w * g.fit.tx;
    ty += w * g.fit.ty;
    capY += w * (g.fit.capY - base.capY);
    k = Math.max(k, w);
    if (g.fit.fill) fill = Math.max(fill, w);
  }
  return {s, tx, ty, capY, k, fill};
};
