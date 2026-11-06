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

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** npm run fonts -- add 로 넣은 폰트 (이 PC 에만, git 제외) */
export const localFontsPath = () => process.env.AVATAR_SHORTS_FONTS ?? path.join(ROOT_DIR, 'public/fonts/local/fonts.json');
export const readLocalFonts = () => (fs.existsSync(localFontsPath()) ? readJson(localFontsPath()) : {});
/** 저장소 목록 + 내 PC 에 넣은 폰트. 목록에 있는 폰트(local: true)는 파일만 채운다 */
export const fontLibrary = (pf = {}, local = readLocalFonts()) => {
  const lib = {...pf.library};
  for (const [id, f] of Object.entries(local)) lib[id] = {...lib[id], ...f, installed: true};
  return lib;
};
export const fontReady = (f) => Boolean(f && (f.base || f.faces?.length));

const LATIN_RANGE = 'U+0021-007E, U+00A0-024F, U+2010-2027, U+20AC';
const quote = (f) => `"${f.family}"`;

/**
 * 폰트 조합 + 칸별 덮어쓰기 → 렌더가 쓸 글꼴 (승인 목록은 policy.fonts).
 * 기본 조합 그대로면 null: 코드의 기본 글꼴 스택(이전 모습)을 그대로 쓴다.
 */
export const resolveType = (want = {}, pf = {}, problems = [], warn = [], info = [], local = readLocalFonts()) => {
  const lib = fontLibrary(pf, local);
  const pairId = !want.pair || want.pair === 'auto' ? pf.defaultPair : want.pair;
  const pair = pf.pairs?.[pairId];
  if (!pair) {
    problems.push(`정책(fonts): 폰트 조합 "${pairId}" 는 없습니다 (${Object.keys(pf.pairs ?? {}).join(', ')})`);
    return null;
  }
  const mixed = ['emph', 'body', 'latin'].some((k) => want[k]);
  if (pairId === pf.defaultPair && !mixed) return null;
  const take = (role, script) => {
    const id = want[role] ?? pair[role];
    const f = lib[id];
    if (!f) {
      problems.push(`정책(fonts): ${role} 칸의 폰트 "${id}" 는 없습니다 (npm run fonts 로 목록 보기)`);
      return null;
    }
    if (!fontReady(f)) {
      problems.push(`정책(fonts): "${f.label}" 파일이 이 PC 에 없습니다 → ${f.link ?? '배포처'} 에서 받아 npm run fonts -- add <파일> --as ${id}`);
      return null;
    }
    if (f.script !== script) {
      problems.push(`정책(fonts): "${f.label}" 은 ${script === 'latin' ? '한글 폰트라 영문' : '영문 폰트라 강조·본문'} 칸에 못 씁니다`);
      return null;
    }
    return {id, ...f};
  };
  const emph = take('emph', 'hangul');
  const body = take('body', 'hangul');
  const latin = take('latin', 'latin');
  if (!emph || !body || !latin) return null;
  if (['hand', 'script', 'display'].includes(body.kind)) warn.push(`폰트: 본문 칸이 "${body.label}" 입니다. 자막·목록은 1~2초 안에 읽혀야 해서 분위기가 읽기보다 중요한 영상이 아니면 담백한 고딕이 낫습니다`);
  if (emph.id === body.id) info.push(`폰트: 강조와 본문이 같은 "${emph.label}" 이라 짝이 안 보입니다 (이대로도 괜찮으면 두세요)`);
  else if (emph.kind === body.kind) info.push('폰트: 강조·본문이 같은 종류입니다. 굵기·폭 차이가 보이는지 스틸로 확인하세요');
  const load = [emph, body, latin].flatMap((f) =>
    f.base
      ? []
      : f.faces.map((x) => ({family: f.family, file: x.file, weight: x.weight, ...(f.size ? {size: f.size} : {}), ...(f.script === 'latin' ? {range: f.range ?? LATIN_RANGE} : {})})),
  );
  const display = `${quote(latin)}, ${quote(emph)}, "Pretendard", sans-serif`;
  const plainBody = `${quote(body)}, "Pretendard", "SUIT", system-ui, sans-serif`;
  // 기본 조합의 장면 제목은 Pretendard (pair.title). 강조 칸을 직접 고르면 제목도 따라간다
  const title = pair.title && !want.emph ? lib[pair.title] : null;
  return {
    pair: pairId,
    label: mixed ? `${pair.label} (칸 섞음)` : pair.label,
    emph: {id: emph.id, label: emph.label, family: emph.family, weight: emph.weight, kind: emph.kind},
    body: {id: body.id, label: body.label, family: body.family, weight: body.weight, kind: body.kind},
    latin: {id: latin.id, label: latin.label, family: latin.family, weight: latin.weight, kind: latin.kind, ...(latin.avoid ? {avoid: latin.avoid} : {})},
    stacks: {head: title ? `${quote(title)}, "Pretendard", sans-serif` : display, emph: display, accent: display, body: plainBody},
    load,
  };
};

/** 이 영상의 글자로 보는 경험칙: 손글씨 강조에 긴 큰 자막, 큰 자막에 그 폰트가 못 읽히는 낱말 (⚠️ 까지만) */
export const typeNotes = (type, captions = [], maxChars = 12) => {
  if (!type) return [];
  const big = captions.filter((c) => c.style === 'big');
  const out = [];
  if (['hand', 'script'].includes(type.emph.kind)) {
    const long = big.filter((c) => [...c.text.replace(/\s/g, '')].length > maxChars);
    if (long.length) out.push(`폰트: 손글씨 강조는 한두 낱말용인데 ${maxChars}자가 넘는 큰 자막이 ${long.length}개 있습니다 ("${long[0].text}"). 줄이거나 다른 조합으로`);
  }
  const avoid = type.latin.avoid;
  const hit = avoid && big.find((c) => c.text.includes(avoid.word));
  if (hit) out.push(`폰트: ${type.latin.label} 에서 ${avoid.word} 는 ${avoid.why} ("${hit.text}"). type.latin 을 바꾸거나 다른 조합으로`);
  return out;
};

/** 자막 세트 + 칸별 덮어쓰기 → 렌더가 쓸 모양 (승인 목록은 policy.captions) */
export const resolveCaptions = (want = {}, pc = {}, problems = [], type = null) => {
  const setId = want.set ?? 'basic';
  const set = pc.sets?.[setId];
  if (!set) {
    problems.push(`정책(captions): 자막 세트 "${setId}" 는 없습니다 (${Object.keys(pc.sets ?? {}).join(', ')})`);
    return null;
  }
  const pick = (k, list) => {
    const id = want[k] ?? set[k];
    if (!list?.[id]) problems.push(`정책(captions): ${k} "${id}" 는 없습니다 (${Object.keys(list ?? {}).join(', ')})`);
    return id;
  };
  const font = pick('font', pc.fonts);
  const shape = pick('shape', pc.shapes);
  const motion = pick('motion', pc.motions);
  if (!pc.fonts?.[font] || !pc.shapes?.[shape] || !pc.motions?.[motion]) return null;
  // 폰트 조합을 골랐으면 자막은 본문 칸을 따른다. 직접 고른 자막 폰트와 터미널 상자(고정폭이 모양의 일부)는 그대로
  const follow = type && !want.font && shape !== 'console';
  return {
    set: setId,
    font: follow ? {family: type.body.family, weight: type.body.weight} : {family: pc.fonts[font].family, weight: pc.fonts[font].weight},
    ...(type ? {big: {weight: type.emph.weight}} : {}),
    shape,
    motion,
    motionSec: pc.motions[motion].sec,
    scale: set.scale ?? 1,
  };
};

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
  const background = plan.theme?.background ?? look.background ?? null;
  if (background && !/^#[0-9a-f]{6}$/i.test(background)) problems.push(`취향 look.background "${background}" 는 #rrggbb 색이어야 합니다`);
  const okBackground = background && /^#[0-9a-f]{6}$/i.test(background) ? background : null;
  const bg = okBackground ?? PALETTE_BG[palette] ?? PALETTE_BG.darktech;
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
    ...(okBackground ? {background: okBackground} : {}),
  };
  if (accentFromTriad && theme.accent) {
    warn.push('정책(한 영상 한 강조색): 트라이어드가 있으면 accent 대신 트라이어드 포인트색을 씁니다');
    delete theme.accent;
  }
  const typography = resolveType(taste.type, policy.fonts, problems, warn, info);
  const captionStyle = resolveCaptions(taste.captions, policy.captions, problems, typography);
  return {policy, taste, theme, captionStyle, typography, problems, warn, info};
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const slug = process.argv[2];
  const planPath = slug ? path.join('projects', slug, 'plan.json') : null;
  const plan = planPath && fs.existsSync(planPath) ? readJson(planPath) : {};
  console.log(JSON.stringify(resolveStyle(slug, plan), null, 1));
}
