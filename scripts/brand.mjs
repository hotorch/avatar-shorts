#!/usr/bin/env node
// 브랜드 색 입히기 — DESIGN.md(getdesign.md 등)나 색 하나 → 내 취향(style/me.json, 이 PC 에만)
//   npm run brand                          ./DESIGN.md 에서 색을 뽑아 내 취향에 적는다
//   npm run brand -- 파일.md               그 문서에서
//   npm run brand -- --accent "#FF5A5F"    문서 없이 내 강조색 하나로
//   npm run brand -- 파일.md --accent "#.." --background "#.."   한 칸만 내 색으로
//   npm run brand -- --dry                 보여 주기만 (적지 않음)
//   npm run brand -- --reset               브랜드 색 지우기
// 가져오는 건 색 값뿐이다. 브랜드 이름·로고·서체는 영상에 넣지 않고, 문서는 git 에 올리지 않는다 (.gitignore).
// 3색이 정책(글자 대비)을 못 지키면 맞을 때까지만 어둡게·밝게 조정하고, 바꾼 것을 알린다.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mePath, readMe, saveMe} from './me.mjs';
import {checkTriad, contrast, luminance, saturation} from './style.mjs';

const HEX = /#([0-9a-f]{6}|[0-9a-f]{3})\b/i;
const full = (h) => {
  const x = h.replace('#', '').toLowerCase();
  return `#${x.length === 3 ? [...x].map((c) => c + c).join('') : x}`;
};
const mix = (a, b, k) => {
  const c = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [c(a), c(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
};
const spread = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return Math.max(...c) - Math.min(...c);
};
const hueOf = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  if (!d) return null;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const colorful = (hex) => saturation(hex) >= 0.2 && spread(hex) >= 0.12;

/** 문서에서 색 토큰을 문서 순서대로. 머리말의 colors: 를 먼저, 없으면(예전 형식) 본문 줄에서 */
export const parseBrand = (text) => {
  const head = text.match(/^---\r?\n([\s\S]*?)\r?\n---/m)?.[1] ?? ''; // 붙여 넣기 앞에 다른 글이 있어도
  const block = head.match(/^colors:\r?\n((?:[ \t]+.*\r?\n?)+)/m)?.[1] ?? '';
  const tokens = [...block.matchAll(/^[ \t]+["']?([\w.-]+)["']?:\s*["']?(#[0-9a-f]{3,8})["']?\s*(?:#.*)?$/gim)]
    .filter((m) => [4, 7].includes(m[2].length))
    .map((m) => ({name: m[1].toLowerCase(), hex: full(m[2])}));
  if (tokens.length) return {tokens, source: 'colors'};
  const seen = new Set();
  const prose = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(HEX);
    if (!m || line.trim().startsWith('```')) continue;
    const hex = full(m[0]);
    if (seen.has(hex)) continue;
    seen.add(hex);
    const clean = (x) => x.replace(/[*`|()\[\]:#-]/g, ' ').trim().toLowerCase().replace(/\s+/g, '-');
    const name = clean(line.slice(0, m.index)).slice(-40) || 'color';
    prose.push({name, hex, role: `${name} ${clean(line.slice(m.index + m[0].length)).slice(0, 60)}`}); // 역할은 설명까지 본다
  }
  return {tokens: prose, source: 'prose'};
};

// 상태·역할 색은 브랜드 색이 아니다
const NOT_BRAND = /(^|-)on-|disabled|hover|pressed|active|focus|visited|hairline|border|divider|shadow|overlay|scrim|error|danger|success|warning|info|semantic|critical|alert|positive|negative|tint|wash|muted?|subtle|faint|ghost|code|syntax/;
const first = (tokens, re, ok = () => true) => tokens.find((t) => re.test(t.role ?? t.name) && !NOT_BRAND.test(t.name) && ok(t));

/** 토큰 → 진한색·포인트색·밝은색·바탕. 정책 대비를 지키도록 필요한 만큼만 조정 */
export const brandTriad = (tokens, rules = {}, force = {}) => {
  const k = {whiteOnDark: 4.5, accentOnDark: 3, darkOnLight: 4.5, ...rules.contrast};
  const notes = [];
  const from = {};

  // 포인트색: primary → 브랜드·강조 이름 → 링크 → 아무 색 있는 것. 전부 무채색이면 흑백 브랜드
  const pickAccent = () => first(tokens, /^(primary|brand|accent)$/, (t) => colorful(t.hex))
    ?? first(tokens, /primary|brand|accent|cta|action|highlight|signature/, (t) => colorful(t.hex))
    ?? first(tokens, /link/, (t) => colorful(t.hex))
    ?? tokens.find((t) => !NOT_BRAND.test(t.name) && colorful(t.hex));
  const a = force.accent ? {name: '내 강조색', hex: full(force.accent)} : pickAccent();
  const mono = !a;

  // 바탕: canvas 계열 첫 번째
  const page = (t) => luminance(t.hex) > 0.7 || luminance(t.hex) < 0.04; // 페이지 바탕은 아주 밝거나 아주 어둡다 (금색 띠 같은 건 바탕이 아님)
  const canvas = first(tokens, /^(canvas|background|bg|page|paper)$/, page) ?? first(tokens, /^surface$/, page) ?? first(tokens, /canvas|background|page/, page) ?? {name: '기본', hex: '#ffffff'};
  const canvasDark = luminance(canvas.hex) < 0.25;

  // 진한색: 브랜드 이름이 붙은 어두운 색 → ink·글자 → 가장 어두운 것
  const darkEnough = (t) => contrast('#FFFFFF', t.hex) >= k.whiteOnDark;
  let d = (canvasDark ? canvas : null)
    ?? first(tokens, /brand.*(navy|dark|deep|night|ink|black)|(navy|night|midnight)|surface-dark|canvas-dark/, darkEnough)
    ?? first(tokens, /^(ink|text|heading|foreground|charcoal)/, darkEnough)
    ?? [...tokens].filter(darkEnough).sort((x, y) => luminance(x.hex) - luminance(y.hex))[0]
    ?? {name: '기본', hex: '#141414'};

  // 밝은색: 살짝 물든 바탕 → 바탕 → 흰색. 어두운 브랜드면 그 위 글자색
  const light = (t) => luminance(t.hex) > 0.6;
  const tinted = (t) => light(t) && t.hex !== '#ffffff';
  const l = (canvasDark ? first(tokens, /^on-dark$|^on-primary$|^ink$|^text|^body|^foreground|^white/, light) : null)
    ?? first(tokens, /canvas|surface|background|paper|cream|mist|ivory|sand/, tinted)
    ?? tokens.find((t) => /tint|wash|soft/.test(t.name) && tinted(t))
    ?? (light(canvas) ? canvas : {name: '기본', hex: '#f5f5f5'});

  from.dark = d.name;
  from.accent = a?.name ?? '없음 (흑백 브랜드)';
  from.light = l.name;
  from.background = force.background ? '내 바탕색' : canvas.name;

  let dark = d.hex;
  let lightHex = l.hex;
  let accent = a?.hex ?? '#ffffff';
  if (mono) notes.push('흑백 브랜드라 포인트색이 없습니다 → 흰색으로 둡니다. 내 색을 쓰려면 --accent "#색상값"');

  // 정책 대비: 진한색을 먼저 어둡게, 그래도 안 되면 포인트색을 밝게 (원래 색에서 가장 덜 움직이는 쪽)
  const before = {dark, accent, lightHex};
  for (let i = 0; i < 40 && contrast('#FFFFFF', dark) < k.whiteOnDark; i++) dark = mix(dark, '#000000', 0.05);
  for (let i = 0; i < 40 && contrast(accent, dark) < k.accentOnDark; i++) dark = mix(dark, '#000000', 0.05);
  for (let i = 0; i < 60 && contrast(accent, dark) < k.accentOnDark; i++) accent = mix(accent, '#ffffff', 0.05);
  for (let i = 0; i < 60 && contrast(dark, lightHex) < k.darkOnLight; i++) lightHex = mix(lightHex, '#ffffff', 0.1);
  if (dark !== before.dark) notes.push(`진한색을 글자 대비 때문에 조정: ${before.dark} → ${dark}`);
  if (accent !== before.accent) notes.push(`포인트색을 글자 대비 때문에 조정: ${before.accent} → ${accent}`);
  if (lightHex !== before.lightHex) notes.push(`밝은색을 글자 대비 때문에 조정: ${before.lightHex} → ${lightHex}`);

  // 바탕: 포인트색이 글자로 읽혀야 한다. 안 읽히면 진한색 바탕으로
  let background = force.background ? full(force.background) : canvas.hex;
  if (contrast(accent, background) < 3) {
    if (force.background) notes.push(`포인트색이 바탕 ${background} 위에서 글자로 약합니다 (대비 ${contrast(accent, background).toFixed(1)}) — 글자 강조색은 팔레트 기본을 쓰게 됩니다`);
    else {
      notes.push(`포인트색이 밝은 바탕에서 안 읽혀서 바탕을 진한색으로: ${background} → ${dark}`);
      background = dark;
      from.background = from.dark;
    }
  }
  const h = hueOf(background);
  const palette = luminance(background) < 0.25 ? 'darktech' : h != null && h >= 20 && h <= 60 && saturation(background) > 0.1 ? 'academic' : 'editorial';
  return {triad: [dark, accent, lightHex], background, palette, from, notes, mono};
};

/** 색 하나만 있을 때: 그 색에서 진한색·밝은색을 만든다 */
export const tokensFromAccent = (hex) => {
  const c = full(hex);
  return [
    {name: 'primary', hex: c},
    {name: 'ink', hex: mix(c, '#000000', 0.82)},
    {name: 'canvas', hex: mix(c, '#ffffff', 0.93)},
  ];
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const KEYS = ['look.triad', 'look.background', 'look.palette'];
  if (args.includes('--reset')) {
    const me = readMe();
    KEYS.forEach((k) => delete me.$set?.[k]);
    saveMe(me);
    console.log('브랜드 색을 지웠습니다 (자동 색으로 돌아갑니다)');
    process.exit(0);
  }
  const force = {accent: opt('--accent'), background: opt('--background')};
  for (const [k, v] of Object.entries(force)) {
    if (v && !HEX.test(v)) {
      console.error(`❌ --${k} 는 #rrggbb 색이어야 합니다: ${v}`);
      process.exit(1);
    }
  }
  const skip = new Set(['--accent', '--background'].flatMap((k) => (opt(k) ? [k, opt(k)] : [])));
  const file = args.find((a) => !a.startsWith('--') && !skip.has(a)) ?? (fs.existsSync('DESIGN.md') ? 'DESIGN.md' : null);
  if (!file && !force.accent) {
    console.error('❌ 브랜드 문서가 없습니다. https://getdesign.md 에서 브랜드를 골라 DESIGN.md 탭의 Copy 로 복사한 뒤:\n   Claude Code 에 붙여 넣거나, 파일로 저장해서 npm run brand -- 파일.md\n   내 색이 있으면: npm run brand -- --accent "#색상값"');
    process.exit(1);
  }
  if (file && !fs.existsSync(file)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${file}`);
    process.exit(1);
  }
  const {tokens, source} = file ? parseBrand(fs.readFileSync(file, 'utf8')) : {tokens: tokensFromAccent(force.accent), source: 'accent'};
  if (!tokens.length) {
    console.error(`❌ ${file} 에서 색(#rrggbb)을 찾지 못했습니다. 브랜드 문서가 맞는지 확인하거나 --accent "#색상값"`);
    process.exit(1);
  }
  const policy = JSON.parse(fs.readFileSync(path.join(ROOT, 'style/policy.json'), 'utf8'));
  const r = brandTriad(tokens, policy.triad, force);
  const bad = checkTriad(r.triad, policy.triad);
  console.log(`🎨 ${file ?? '내 강조색'} — 색 ${tokens.length}개 (${source === 'colors' ? '문서 머리말' : source === 'prose' ? '문서 본문' : '색 하나에서 만듦'})`);
  console.log(`  진한색    ${r.triad[0]}  ← ${r.from.dark}`);
  console.log(`  포인트색  ${r.triad[1]}  ← ${r.from.accent}`);
  console.log(`  밝은색    ${r.triad[2]}  ← ${r.from.light}`);
  console.log(`  장면 바탕 ${r.background}  ← ${r.from.background}`);
  console.log(`  팔레트    ${r.palette}`);
  r.notes.forEach((n) => console.log(`  ℹ️  ${n}`));
  if (bad.length) {
    bad.forEach((b) => console.error(`❌ ${b}`));
    process.exit(1);
  }
  if (args.includes('--dry')) process.exit(0);
  const why = `브랜드 ${file ? path.basename(file) : '내 강조색'}`;
  const date = new Date().toISOString().slice(0, 10);
  const me = readMe();
  me.$set = {...me.$set, 'look.triad': {value: r.triad, why, by: 'user', date}, 'look.background': {value: r.background, why, by: 'user', date}, 'look.palette': {value: r.palette, why, by: 'user', date}};
  saveMe(me);
  console.log(`✅ 내 취향에 적었습니다 (${path.relative(ROOT, mePath())}). 확인: npm run sample`);
}
