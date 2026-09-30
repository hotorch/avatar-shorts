#!/usr/bin/env node
// plan.json + captions.json + video.json → 검사 → Remotion 렌더
//   npm run render -- <이름>            최종본  projects/<이름>/out/final.mp4
//   npm run render -- <이름> --preview  절반 해상도 미리보기 (빠름)
//   npm run render -- <이름> --check    렌더 없이 검사만
import fs from 'node:fs';
import path from 'node:path';
import {buildFraming, faceFrame, headBox} from '../src/layouts/framing.js';
import {remotion} from './platform.mjs';
import {resolveStyle} from './style.mjs';
import {firstBeat, loadCuts, mapTime, remapScene} from './timeline.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const preview = args.includes('--preview');
const checkOnly = args.includes('--check');
if (!slug) {
  console.error('사용법: npm run render -- <프로젝트이름> [--preview|--check]');
  process.exit(1);
}
const dir = path.join('projects', slug);
const read = (f, fallback) => {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) {
    if (fallback !== undefined) return fallback;
    console.error(`${p} 가 없습니다.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
};

const plan = read('plan.json');
const video = read('video.json', null);
// 말 편집(edit.py)을 했으면 편집본 타임라인을 쓴다
const cuts = loadCuts(dir);
const edited = !!cuts;
const captions = plan.captions ?? read(edited ? 'captions.edit.json' : 'captions.json', []);
const style = resolveStyle(slug, plan);
const pol = style.policy;

// ── 시간 옮기기: plan.json 은 원본 시간(words.json)으로 쓴다. 편집본이 있으면 편집 시간으로 바꾼다 (scripts/timeline.mjs).
//    그래서 무음 기준·순서를 바꿔 edit.py 를 다시 돌려도 plan 은 그대로 둔다.
const remapProblems = [];
const sourceScenes = plan.scenes ?? [];
if (edited && (plan.timebase ?? 'source') === 'source') {
  plan.scenes = sourceScenes
    .map((sc) => {
      const r = remapScene(cuts, sc);
      if (r.problem) remapProblems.push(r.problem);
      return r.scene;
    })
    .filter(Boolean);
  if (plan.sfx) plan.sfx = plan.sfx.map((e) => ({...e, t: (mapTime(cuts, e.t, 'start') ?? {t: e.t}).t}));
}
// 머리 추적(face.py, 원본 시간) → 편집 시간. 잘려 나간 순간의 표본은 버린다
const track = (video?.track ?? []).flatMap((r) => {
  if (!edited) return [r];
  const g = cuts.segments.find((x) => r[0] >= x.src[0] && r[0] <= x.src[1]);
  return g ? [[+(g.out[0] + r[0] - g.src[0]).toFixed(3), ...r.slice(1)]] : [];
}).sort((a, b) => a[0] - b[0]);
const live = `_live/${slug}`;
const props = {
  ...plan,
  theme: style.theme,
  sfxVolume: plan.sfxVolume ?? style.taste.sound?.sfxVolume ?? 0.5,
  captionScale: plan.captionScale ?? style.taste.captions?.scale ?? 1,
  layout: plan.layout ?? video?.layout ?? 'vertical',
  duration: plan.duration ?? (edited ? cuts.duration : video?.duration) ?? 30,
  captions,
  punch: plan.punch ?? (edited ? cuts.punch : []),
  video: video
    ? {
        src: `${live}/${edited ? 'edit' : 'input'}.mp4`,
        width: video.width,
        height: video.height,
        faceX: video.faceX ?? 0.5,
        faceY: video.faceY ?? 0.36,
        ...(video.head ? {head: video.head, track} : {}),
      }
    : null,
};

// ── 검사
const problems = [...style.problems, ...remapProblems];
const warn = [...style.warn];
const P = {scenes: {minSec: 1.2, maxSec: 10, maxSameTemplateRun: 2, ...pol.scenes}, captions: {maxChars: 18, maxEmphPerCue: 2, bigMaxRatio: 0.3, ...pol.captions}, hook: pol.content?.hookFaceSeconds ?? 1};
if (edited) {
  const newer = ['words.json', 'captions.json'].some((f) => fs.existsSync(path.join(dir, f)) && fs.statSync(path.join(dir, f)).mtimeMs > fs.statSync(path.join(dir, 'cuts.json')).mtimeMs);
  if (newer) problems.push('자막을 다시 정렬했는데 편집본이 예전 것입니다 → npm run edit -- ' + slug);
}
const templates = ['hero', 'keyword', 'stat', 'compare', 'steps', 'list', 'chart', 'quote', 'chapter', 'morph', 'media', 'palette', 'custom'];
const objects = new Set(fs.readdirSync('public/objects/clay').map((f) => f.replace('.webp', '')));
const sfx = new Set(fs.existsSync('public/sfx') ? fs.readdirSync('public/sfx').map((f) => f.replace('.wav', '')) : []);
const customSrc = fs.readFileSync('src/custom/index.ts', 'utf8');
const scenes = [...(props.scenes ?? [])].sort((a, b) => a.in - b.in);
const MODES = ['cutaway', 'panel', 'above', 'below'];
const FLOAT_OK = ['morph', 'keyword', 'stat', 'media'];

const walkObjects = (v, where) => {
  if (Array.isArray(v)) v.forEach((x) => walkObjects(x, where));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if ((k === 'object' || k === 'center') && typeof x === 'string' && !objects.has(x)) problems.push(`${where}: 오브젝트 "${x}" 없음 (public/objects/clay 목록 참고)`);
      if (k === 'satellites' && Array.isArray(x)) x.forEach((n) => !objects.has(n) && problems.push(`${where}: 오브젝트 "${n}" 없음`));
      walkObjects(x, where);
    }
  }
};

scenes.forEach((s, i) => {
  const w = `장면 ${s.id ?? i + 1}`;
  if (!(s.out > s.in)) problems.push(`${w}: out 이 in 보다 커야 합니다`);
  if (s.in < 0 || s.out > props.duration + 0.01) problems.push(`${w}: 영상 길이(${props.duration}s) 밖입니다`);
  if (s.out - s.in < P.scenes.minSec) problems.push(`정책 ${w}: ${P.scenes.minSec}초보다 짧습니다`);
  if (s.out - s.in > P.scenes.maxSec) problems.push(`정책 ${w}: ${P.scenes.maxSec}초가 넘습니다. 나누세요`);
  const run = scenes.slice(Math.max(0, i - P.scenes.maxSameTemplateRun), i + 1);
  if (run.length > P.scenes.maxSameTemplateRun && run.every((x) => x.template === s.template && x.component === s.component))
    problems.push(`정책 ${w}: 같은 템플릿(${s.template})이 ${run.length}번 연속입니다`);
  if (!templates.includes(s.template)) problems.push(`${w}: 템플릿 "${s.template}" 없음 (${templates.join(', ')})`);
  if (s.template === 'custom' && !new RegExp(`\\b${s.component}\\b`).test(customSrc)) problems.push(`${w}: 커스텀 "${s.component}" 가 src/custom/index.ts 에 등록되지 않았습니다`);
  const next = scenes[i + 1];
  if (next && next.in < s.out - 0.01) problems.push(`${w} 와 장면 ${next.id}: 시간이 겹칩니다`);
  if (!MODES.includes(s.mode)) problems.push(`${w}: mode "${s.mode}" 없음 (${MODES.join(', ')})`);
  if ((s.mode === 'above' || s.mode === 'below') && !FLOAT_OK.includes(s.template) && s.template !== 'custom')
    problems.push(`${w}: ${s.template} 는 납작한 머리 위/아래 카드(${s.mode})에 안 맞습니다 → ${FLOAT_OK.join(', ')} 중에서, 또는 panel`);
  if (s.in < P.hook && s.mode === 'cutaway') problems.push(`정책 ${w}: 첫 ${P.hook}초(훅)는 얼굴입니다 — 컷어웨이 금지`);
  walkObjects(s.props, w);
  // 빈 화면: 장면이 열리고 첫 요소가 늦게 나오면 판만 보인다 (morph 는 첫 상태의 t 에 나타난다)
  //   custom 은 속을 알 수 없어 건너뛴다. 다른 템플릿은 제목·카드가 먼저 나오기도 해서 경고만.
  const fb = s.template === 'custom' ? null : firstBeat(s);
  const gap = fb == null ? 0 : fb - s.in;
  if (s.template === 'morph' && gap > 0.8) problems.push(`${w}: 시작 후 ${gap.toFixed(1)}초 동안 빈 판 — morph 첫 상태의 t 를 in 쪽으로 당기세요 (예: 알약을 먼저)`);
  else if (gap > 0.6) warn.push(`${w}: 첫 요소가 ${gap.toFixed(1)}초 늦게 나옵니다 — 의도한 게 아니면 당기세요`);
  for (const e of s.sfx ?? []) if (!sfx.has(e.cue)) problems.push(`${w}: 효과음 "${e.cue}" 없음 (${[...sfx].join(', ')})`);
  if (s.template === 'media') {
    const src = s.props?.src ?? '';
    const local = path.join(dir, src);
    if (!src.startsWith('http')) {
      if (!fs.existsSync(local)) problems.push(`${w}: 파일 ${local} 없음`);
      else s.props = {...s.props, src: `${live}/${src}`};
    }
  }
});
for (const e of props.sfx ?? []) if (!sfx.has(e.cue)) problems.push(`효과음 "${e.cue}" 없음`);
if (!captions.length) warn.push('자막이 없습니다 (captions.json)');
const bigs = captions.filter((c) => c.style === 'big').length;
if (captions.length && bigs / captions.length > P.captions.bigMaxRatio) problems.push(`정책: big 자막이 ${bigs}/${captions.length}개 — ${P.captions.bigMaxRatio * 100}% 이하로`);
captions.forEach((c, i) => {
  if ([...c.text].length > P.captions.maxChars + 2) problems.push(`정책 자막 ${i + 1}: ${[...c.text].length}자 — ${P.captions.maxChars}자 안팎으로 나누세요 ("${c.text}")`);
  if ((c.emph ?? []).length > P.captions.maxEmphPerCue) problems.push(`정책 자막 ${i + 1}: 강조가 ${P.captions.maxEmphPerCue}개를 넘습니다`);
});
if (props.layout === 'side' && video && video.faceX == null) warn.push('video.json 의 faceX 가 비어 있습니다 (가운데로 가정)');

// ── 정책(얼굴): 판·카드·자막이 머리(정수리~턱)를 가리지 않는다. 배치는 Remotion 과 같은 계산(src/layouts/framing.js)
if (props.layout !== 'side' && pol.face?.neverCovered !== false) {
  const opts = {GAP: pol.face?.gapPx ?? 36};
  if (video && !video.head) warn.push('머리 추적(video.json track)이 없습니다 → npm run face -- ' + slug + ' (없으면 faceY 로 짐작해 배치)');
  const segs = buildFraming(scenes, props.video, opts);
  const at = (t) => headBox(props.video, t, t); // 그 순간 머리 (앞뒤 0.25초)
  const hit = [];
  for (const g of segs) {
    const f = g.fit;
    const ids = g.scenes.map((x) => x.id).join('·');
    f.issues.forEach((m) => problems.push(`정책(얼굴) 장면 ${ids} [${g.mode}]: ${m}`));
    // 구간 전체의 머리 범위로 배치했지만, 튀는 값으로 버린 표본이 실제로 가려지는지 순간마다 확인
    for (const r of track.filter((x) => x[0] >= g.in && x[0] <= g.out)) {
      const h = at(r[0]);
      const top = f.s * h.top + f.ty;
      const chin = f.s * h.chin + f.ty;
      const over =
        g.mode === 'panel' ? f.panel - top : g.mode === 'above' ? f.box.y + f.box.h - top : g.mode === 'below' ? chin - f.box.y : 0;
      if (over > 0 || chin > f.capY) hit.push(`장면 ${ids} ${r[0].toFixed(1)}s (${Math.round(Math.max(over, chin - f.capY))}px)`);
    }
    style.info.push(`배치 ${ids}: ${g.mode}` + (f.panel ? ` 판 ${f.panel}px` : '') + (f.box ? ` 카드 ${f.box.h}px` : '') + (f.ty ? ` 아바타 ${f.ty > 0 ? '↓' : '↑'}${Math.abs(Math.round(f.ty))}px` : '') + (f.s !== 1 ? ` ×${f.s}` : '') + ` 자막 ${f.capY}`);
  }
  if (hit.length) problems.push(`정책(얼굴): 머리가 판·카드·자막에 가려지는 순간 ${hit.length}곳 — ${hit.slice(0, 4).join(', ')}${hit.length > 4 ? ' …' : ''}`);
  const base = faceFrame(props.video, opts);
  const inScene = (t) => scenes.some((x) => t >= x.in - 0.4 && t <= x.out + 0.4);
  const low = track.filter((r) => !inScene(r[0]) && headBox(props.video, r[0], r[0]).chin > base.capY);
  if (low.length) warn.push(`얼굴만 나오는 구간에서 자막이 턱에 닿는 순간 ${low.length}곳 (${low.slice(0, 3).map((r) => r[0].toFixed(1) + 's').join(', ')}) — 몸을 숙였을 때입니다`);
}

style.info.forEach((m) => console.log('ℹ️  ' + m));
warn.forEach((m) => console.log('⚠️  ' + m));
if (problems.length) {
  problems.forEach((m) => console.log('❌ ' + m));
  process.exit(1);
}
console.log(`✅ 검사 통과: 장면 ${scenes.length}개, 자막 ${captions.length}개, ${props.duration.toFixed(1)}초, ${props.layout}${edited ? ' (편집본)' : ''}, 팔레트 ${style.theme.palette}${style.theme.triadName ? '/' + style.theme.triadName : ''}, 면 ${style.theme.surface}`);

// ── public/_live 에 이 프로젝트 파일만 연결 (렌더 번들이 가볍도록). 저장소 안 파일끼리라 하드링크 OK (사용자 원본은 아님)
try {
  fs.rmSync('public/_live', {recursive: true, force: true});
} catch (e) {
  // Windows 는 열려 있는 파일을 못 지운다 (Remotion Studio 가 영상을 쥐고 있을 때)
  console.error(`❌ public/_live 를 비우지 못했습니다 (${e.code}) — npm run studio 창을 닫고 다시 실행하세요`);
  process.exit(1);
}
const liveDir = path.join('public', live);
fs.mkdirSync(liveDir, {recursive: true});
const link = (from, to) => {
  fs.mkdirSync(path.dirname(to), {recursive: true});
  try {
    fs.linkSync(from, to);
  } catch {
    fs.copyFileSync(from, to);
  }
};
if (video) link(path.join(dir, edited ? 'edit.mp4' : 'input.mp4'), path.join(liveDir, edited ? 'edit.mp4' : 'input.mp4'));
const broll = path.join(dir, 'broll');
if (fs.existsSync(broll)) for (const f of fs.readdirSync(broll)) link(path.join(broll, f), path.join(liveDir, 'broll', f));

// 검사만 해도 .props.json 과 public/_live 는 만들어 둔다 → npm run still / studio 가 바로 된다
const propsFile = path.join(dir, '.props.json');
fs.writeFileSync(propsFile, JSON.stringify(props));
if (checkOnly) process.exit(0);

const outFile = path.join(dir, 'out', preview ? 'preview.mp4' : 'final.mp4');
const r = remotion(
  ['render', 'Short', outFile, `--props=${propsFile}`, ...(preview ? ['--scale=0.5', '--jpeg-quality=80'] : ['--crf=18'])],
  {stdio: 'inherit'},
);
if (r.status === 0) console.log(`\n🎬 완성: ${outFile}`);
process.exit(r.status ?? 1);
