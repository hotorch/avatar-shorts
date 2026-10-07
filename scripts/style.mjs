#!/usr/bin/env node
// 정책(style/policy.json) + 취향(style/taste.json → projects/<이름>/taste.json) 을 합친다.
//   node scripts/style.mjs <이름>        합친 결과를 JSON 으로 출력 (edit.py 가 읽는다)
// 우선순위: 정책(잠김) > plan.json 에 직접 적은 값 > 프로젝트 취향 > 내 취향(style/me.json, 이 PC 에만) > 기본 취향
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readMe} from './me.mjs';

const readJson = (p, fallback = {}) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);

const merge = (a, b) => {
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b ?? a;
  const out = {...(a ?? {})};
  for (const [k, v] of Object.entries(b)) if (!k.startsWith('$')) out[k] = merge(out[k], v);
  return out;
};

const rgb = (hex) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
};
export const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const saturation = (hex) => {
  const c = rgb(hex);
  const mx = Math.max(...c);
  const mn = Math.min(...c);
  const l = (mx + mn) / 2;
  return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
};

export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const hue = (hex) => {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  if (!d) return null;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

/** 트라이어드가 정책(글자 대비)을 지키는지 — 어긴 항목 목록 */
export const checkTriad = (c, rules) => {
  const k = {whiteOnDark: 4.5, accentOnDark: 3, darkOnLight: 4.5, ...rules.contrast};
  if (!Array.isArray(c) || c.length !== 3 || !c.every((x) => /^#[0-9a-f]{6}$/i.test(x))) return ['트라이어드는 ["#진한색", "#포인트색", "#밝은색"] 3개여야 합니다'];
  const bad = [];
  const r = (x) => x.toFixed(1);
  if (contrast('#FFFFFF', c[0]) < k.whiteOnDark) bad.push(`진한색 ${c[0]} 위 흰 글자 대비 ${r(contrast('#FFFFFF', c[0]))} < ${k.whiteOnDark}`);
  if (contrast(c[1], c[0]) < k.accentOnDark) bad.push(`진한색 위 포인트색 글자(탭1) 대비 ${r(contrast(c[1], c[0]))} < ${k.accentOnDark}`);
  if (contrast(c[0], c[2]) < k.darkOnLight) bad.push(`밝은색 위 진한색 글자(탭3) 대비 ${r(contrast(c[0], c[2]))} < ${k.darkOnLight}`);
  return bad;
};

/** 영상 배경 색상 분포(video.json tones)와 어울리는 순서로 승인 트라이어드 (점수 높은 순) */
export const pickTriad = (tones, tri) => {
  const auto = {minChroma: 0.06, hueWindow: 45, darkWeight: 0.35, ...tri.auto};
  if (!tones?.hues || tones.chroma < auto.minChroma) return [];
  const near = (h) => (h == null ? 0 : tones.hues.reduce((acc, w, k) => {
    const dist = Math.abs(((k * 30 + 15 - h + 540) % 360) - 180);
    return acc + w * Math.max(0, 1 - dist / auto.hueWindow);
  }, 0));
  return Object.entries(tri.approved ?? {})
    .map(([name, t]) => ({name, score: +(near(hue(t.c[1])) * saturation(t.c[1]) + auto.darkWeight * near(hue(t.c[0]))).toFixed(3)}))
    .filter((x) => x.score > 0.05)
    .sort((x, y) => y.score - x.score);
};

const PALETTE_BG = {darktech: '#14171B', editorial: '#F3F0E8', academic: '#F6F0E2'};

export const resolveStyle = (slug, plan = {}) => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const policy = readJson(path.join(root, 'style/policy.json'));
  let taste = merge(readJson(path.join(root, 'style/taste.json')), readMe());
  if (slug) taste = merge(taste, readJson(path.join(root, 'projects', slug, 'taste.json')));

  const problems = [];
  const warn = [];
  const info = [];
  const look = taste.look ?? {};
  let palette = plan.theme?.palette ?? look.palette;
  if (!palette || palette === 'auto') {
    warn.push('팔레트가 auto 로 남아 있습니다 → darktech. 주제에 맞게 projects/<이름>/taste.json 의 look.palette 를 정하세요');
    palette = 'darktech';
  }
  const tri = policy.triad ?? {};
  let triadName = plan.theme?.triad ?? look.triad;
  let source = 'explicit';
  if (!triadName || triadName === 'auto') {
    const tones = readJson(path.join(root, 'projects', slug ?? '_', 'video.json'), {}).tones;
    const ranked = pickTriad(tones, tri);
    triadName = ranked[0]?.name ?? tri.paletteDefault?.[palette];
    source = ranked.length ? 'video' : 'default';
    if (ranked.length) info.push(`트라이어드 자동 선택(영상 배경색 기준): ${ranked.slice(0, 3).map((r) => `${r.name} ${r.score}`).join(' > ')}`);
  }
  let triad = null;
  if (Array.isArray(triadName)) {
    triad = {c: triadName, n: ['Dark', 'Accent', 'Light']};
    triadName = 'custom';
  } else if (triadName) {
    triad = tri.approved?.[triadName] ?? null;
    if (!triad) problems.push(`정책(triad): "${triadName}" 는 승인된 트라이어드가 아닙니다 (${Object.keys(tri.approved ?? {}).join(', ')})`);
  }
  if (triad) problems.push(...checkTriad(triad.c, tri).map((m) => `정책(triad ${triadName}): ${m}`));
  // 강조색: 트라이어드를 골랐으면(직접·영상 기준) 그 포인트색이 영상의 강조색 (정책: 한 영상 한 강조색).
  // 단, 장면 바탕 위 글자로 읽히지 않으면(대비 < 3) 팔레트 강조색을 글자에 쓰고 트라이어드는 면에만 쓴다.
  const bg = PALETTE_BG[palette] ?? PALETTE_BG.darktech;
  let accentFromTriad = !!triad && source !== 'default';
  if (accentFromTriad && contrast(triad.c[1], bg) < 3) {
    warn.push(`트라이어드 포인트색 ${triad.c[1]} 이 ${palette} 바탕에서 글자로 약해서, 글자 강조색은 팔레트 기본을 씁니다 (면에는 트라이어드)`);
    accentFromTriad = false;
  }
  const theme = {
    palette,
    ...(plan.theme?.accent ?? look.accent ? {accent: plan.theme?.accent ?? look.accent} : {}),
    ...(triad ? {triad: triad.c, triadName, triadSource: source, accentFromTriad} : {}),
    surface: plan.theme?.surface ?? look.surface ?? 'flat',
  };
  if (accentFromTriad && theme.accent) {
    warn.push('정책(한 영상 한 강조색): 트라이어드가 있으면 accent 대신 트라이어드 포인트색을 씁니다');
    delete theme.accent;
  }
  return {policy, taste, theme, problems, warn, info};
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  const planPath = slug ? path.join('projects', slug, 'plan.json') : null;
  const plan = planPath && fs.existsSync(planPath) ? readJson(planPath) : {};
  console.log(JSON.stringify(resolveStyle(slug, plan), null, 1));
}
