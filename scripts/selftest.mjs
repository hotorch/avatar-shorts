#!/usr/bin/env node
// 자체 시험 — 코드를 고친 뒤, PR 전에:  npm test   (음성 인식·전체 렌더 없이 1분 안쪽)
//   --quick  스틸 렌더(브라우저 필요)를 건너뛴다
// 여기 있는 항목은 실제로 겪은 버그들이다. 새 버그를 고치면 여기에 한 줄 추가한다.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {checkTriad} from './style.mjs';
import {varietyProblems} from './variety.mjs';
import {fitFrame, FRAME, headBox} from '../src/layouts/framing.js';

const quick = process.argv.includes('--quick');
const results = [];
const test = (name, fn) => {
  try {
    const r = fn();
    results.push({name, ok: r === true || r === undefined, msg: typeof r === 'string' ? r : ''});
  } catch (e) {
    results.push({name, ok: false, msg: e.message.split('\n')[0]});
  }
};
const sh = (cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, {encoding: 'utf8', ...opts});
  return {code: r.status, out: (r.stdout ?? '') + (r.stderr ?? '')};
};
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ── 1. 타입
test('타입 검사 (tsc)', () => {
  const r = sh(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
  must(r.code === 0, r.out.trim().split('\n').slice(0, 3).join(' | '));
});

// ── 2. 정책 파일끼리, 정책과 코드가 어긋나지 않는지
const policy = json('style/policy.json');
test('승인된 트라이어드가 전부 대비 정책을 통과', () => {
  const bad = Object.entries(policy.triad.approved).flatMap(([k, v]) => checkTriad(v.c, policy.triad).map((m) => `${k}: ${m}`));
  must(!bad.length, bad.join(' / '));
});
test('팔레트 기본 트라이어드 = 코드(theme.tsx TRIAD)', () => {
  const src = fs.readFileSync('src/kit/theme.tsx', 'utf8');
  for (const [pal, name] of Object.entries(policy.triad.paletteDefault)) {
    const c = policy.triad.approved[name]?.c;
    must(c, `${pal} → ${name} 가 승인 목록에 없음`);
    must(src.includes(`${pal}: ['${c[0]}', '${c[1]}', '${c[2]}']`), `theme.tsx 의 ${pal} 트라이어드가 policy.json(${name}) 과 다름`);
  }
});
test('템플릿 목록 3곳 일치 (scenes/index.tsx · render.mjs · templates.md)', () => {
  const idx = [...fs.readFileSync('src/scenes/index.tsx', 'utf8').matchAll(/^\s+(\w+): \w+, \/\//gm)].map((m) => m[1]).sort();
  const rnd = JSON.parse(fs.readFileSync('scripts/render.mjs', 'utf8').match(/const templates = (\[[^\]]+\])/)[1].replace(/'/g, '"')).filter((t) => t !== 'custom').sort();
  const md = [...fs.readFileSync('.claude/skills/broll-plan/references/templates.md', 'utf8').matchAll(/^### (\w+) —/gm)].map((m) => m[1]).filter((t) => t !== 'custom').sort();
  must(idx.join() === rnd.join(), `index.tsx [${idx}] ≠ render.mjs [${rnd}]`);
  must(idx.join() === md.join(), `index.tsx [${idx}] ≠ templates.md [${md}]`);
});
test('모든 템플릿에 등장 모션 계열이 있음 (policy variety.motion = render.mjs 템플릿 목록)', () => {
  const rnd = JSON.parse(fs.readFileSync('scripts/render.mjs', 'utf8').match(/const templates = (\[[^\]]+\])/)[1].replace(/'/g, '"')).filter((t) => t !== 'custom');
  const miss = rnd.filter((t) => !policy.variety.motion[t]);
  must(!miss.length, `motion 없음: ${miss.join(', ')}`);
});
test('예시 plan 이 전부 다양성 정책을 통과 (avatar-v01 · 데모 3개)', () => {
  // 예전: avatar-v01 장면 07~09 가 머리 위 morph 알약 3연속인데 템플릿 검사(maxSameTemplateRun)를 통과했다
  const bad = ['examples/avatar-v01/plan.json', ...fs.readdirSync('examples/demo').map((f) => `examples/demo/${f}`)].flatMap((f) =>
    varietyProblems([...json(f).scenes].sort((a, b) => a.in - b.in), policy.variety).map((m) => `${f}: ${m}`));
  must(!bad.length, bad.join(' / '));
});
test('Windows 에서도 도는 코드 (python3·.venv/bin·npx 를 직접 부르지 않음, 파이썬 파일 읽기·쓰기는 UTF-8)', () => {
  // 예전: WSL 없이는 안 됐다. Windows 에는 python3·.venv/bin 이 없고, npx 는 .cmd 라 spawn 이 실패하고,
  //       한국어 Windows 의 기본 인코딩(cp949)으로 한글 JSON 을 읽다 깨졌다 → scripts/platform.mjs 와 encoding="utf-8"
  const bad = [];
  for (const f of fs.readdirSync('scripts').filter((x) => /\.(mjs|py)$/.test(x))) {
    const src = fs.readFileSync(path.join('scripts', f), 'utf8');
    if (f.endsWith('.mjs') && f !== 'platform.mjs' && /spawnSync\('(python3?|npx|npm)'|['"`]\.venv\/(bin|Scripts)/.test(src)) bad.push(`${f}: python3·npx·.venv 경로 직접 호출 → platform.mjs`);
    const n = (re) => (src.match(re) ?? []).length;
    if (f.endsWith('.py') && (/\.read_text\(\)|text=True/.test(src) || n(/\.write_text\(/g) > n(/, encoding="utf-8"\)/g))) bad.push(`${f}: encoding="utf-8" 없는 파일 읽기·쓰기`);
  }
  must(!bad.length, bad.join(' / '));
});
test('데모에 필요한 자산이 저장소에 있음 (효과음 11 · 글꼴 · 오브젝트 · 얼굴 모델, .gitignore 에 안 걸림)', () => {
  // 예전: public/sfx/*.wav 가 gitignore 라 새로 받은 사람의 npm run demo 가 404 로 실패
  const sfx = fs.readdirSync('public/sfx').filter((f) => f.endsWith('.wav'));
  must(sfx.length >= 11, `효과음 ${sfx.length}개 (11개 필요) → npm run sfx`);
  const ignored = sh('git', ['check-ignore', 'public/sfx/whoosh.wav', 'public/fonts/PretendardVariable.woff2', 'public/objects/clay/bulb.webp', 'models/yunet/face_detection_yunet_2023mar.onnx']).out.trim();
  must(!ignored, `.gitignore 에 걸림: ${ignored}`);
});
test('커스텀 장면이 전부 등록됨 (src/custom/index.ts)', () => {
  const idx = fs.readFileSync('src/custom/index.ts', 'utf8');
  const files = fs.readdirSync('src/custom').filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', ''));
  const miss = files.filter((f) => !new RegExp(`\\b${f}\\b`).test(idx));
  must(!miss.length, `등록 안 됨: ${miss.join(', ')}`);
});

// ── 2-1. 머리 배치 (src/layouts/framing.js). 예전: 얼굴 중심만 1265px 에 맞춰 내려서 정수리가 판 밑으로 190px 들어갔다 (avatar-v01)
const V01 = {top: 217, chin: 937, left: 300, right: 780}; // avatar-v01 실측(화면 px)
const REF = {top: 520, chin: 960, left: 300, right: 780}; // 머리 위가 넓은 사람 (레퍼런스)
const BIG = {top: 96, chin: 1190, left: 150, right: 930}; // 화면을 꽉 채운 얼굴
const clear = (f, h) => {
  const top = f.s * h.top + f.ty;
  const chin = f.s * h.chin + f.ty;
  if (f.panel != null) must(top >= f.panel + FRAME.GAP - 0.5, `${f.mode}: 판 ${f.panel} 이 정수리 ${Math.round(top)} 를 가림`);
  if (f.mode === 'above') must(f.box.y + f.box.h <= top - FRAME.GAP + 0.5, `above: 카드 끝 ${f.box.y + f.box.h} ≥ 정수리 ${Math.round(top)}`);
  if (f.mode === 'below') must(f.box.y >= chin + FRAME.GAP - 0.5, `below: 카드 ${f.box.y} ≤ 턱 ${Math.round(chin)}`);
  must(chin + FRAME.CAP_GAP <= f.capY + 0.5, `${f.mode}: 자막 ${f.capY} 이 턱 ${Math.round(chin)} 을 가림`);
  must(f.capY + FRAME.CAP_H <= FRAME.UI_BOTTOM, `${f.mode}: 자막이 플랫폼 UI 자리로 내려감`);
  must(!f.issues.length, f.issues.join(' / '));
};
test('배치: 분할 화면에서 정수리가 판 아래 (avatar-v01 머리)', () => {
  must(V01.top + Math.min(880, 1265 - 0.35 * 1920) < 1010, '예전 공식이 원래 가리던 경우가 아님 — 시험 값 확인');
  clear(fitFrame('panel', V01), V01);
});
test('배치: 머리 위/아래 카드가 얼굴·자막과 안 겹침 (보통·머리 위 넓음·꽉 찬 얼굴)', () => {
  for (const h of [V01, REF]) for (const m of ['panel', 'above', 'below']) clear(fitFrame(m, h), h);
  for (const m of ['above', 'below']) clear(fitFrame(m, BIG), BIG);
});
test('배치: 판에 안 들어가는 큰 얼굴은 문제로 알림 (조용히 자르지 않음)', () => {
  must(fitFrame('panel', BIG).issues.length > 0, '큰 얼굴 panel 이 통과해 버림');
});
test('머리 추적(face.py): 예시 영상에서 정수리·턱을 찾음', () => {
  const D = path.join('projects', '.selftest-face');
  fs.rmSync(D, {recursive: true, force: true});
  fs.mkdirSync(D, {recursive: true});
  fs.copyFileSync('docs/example/before.mp4', path.join(D, 'input.mp4'));
  fs.writeFileSync(path.join(D, 'video.json'), JSON.stringify({file: 'input.mp4', width: 540, height: 960}));
  const r = sh(process.execPath, ['scripts/py.mjs', 'face', D]);
  const v = json(path.join(D, 'video.json'));
  fs.rmSync(D, {recursive: true, force: true});
  must(r.code === 0 && v.head, r.out.trim().split('\n').pop());
  // 실측: 머리카락 끝 0.145, 턱 0.47 — 정수리는 머리카락보다 위(여유), 너무 위(>0.06 차이)도 아니게
  must(v.head.top < 0.145 && v.head.top > 0.085, `정수리 ${v.head.top} (머리카락 끝 0.145)`);
  must(Math.abs(v.head.chin - 0.475) < 0.03, `턱 ${v.head.chin}`);
  must(v.track.length > 80, `표본 ${v.track.length}개`);
});

// ── 3. 말 편집 (합성 소리로): 삐- 쉼 삐- 쉼 삐-
const T = path.join('projects', '.selftest');
fs.rmSync(T, {recursive: true, force: true});
fs.mkdirSync(T, {recursive: true});
const tone = (a, b) => `between(t,${a},${b})`;
const gen = sh('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=gray:s=320x568:r=25:d=6', '-f', 'lavfi', '-i',
  `aevalsrc='0.4*sin(2*PI*440*t)*(${tone(0, 1)}+${tone(2, 3)}+${tone(4.5, 6)})':s=44100:d=6`, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(T, 'input.mp4')]);
const words = [
  {text: '하나', start: 0.02, end: 0.98, cue: 0},
  {text: '둘', start: 2.02, end: 2.98, cue: 1},
  {text: '셋', start: 4.52, end: 5.98, cue: 2},
];
const cues = words.map((w, i) => ({start: w.start, end: words[i + 1]?.start ?? 6, text: w.text}));
fs.writeFileSync(path.join(T, 'words.json'), JSON.stringify(words));
fs.writeFileSync(path.join(T, 'captions.json'), JSON.stringify(cues));
fs.writeFileSync(path.join(T, 'video.json'), JSON.stringify({file: 'input.mp4', width: 320, height: 568, duration: 6, fps: 25, audio: true, layout: 'vertical', faceX: 0.5, faceY: 0.35}));

const edit = () => sh(process.execPath, ['scripts/py.mjs', 'edit', T]);
test('합성 시험 영상 만들기 (ffmpeg lavfi)', () => must(gen.code === 0, gen.out));
test('무음 제거: 6초 → 약 3.8초 (소리 3.5초 + 남기는 무음), 말은 그대로', () => {
  const r = edit();
  must(r.code === 0, r.out.split('\n').slice(-3).join(' | '));
  const c = json(path.join(T, 'cuts.json'));
  must(c.duration > 3.5 && c.duration < 4.2, `편집 길이 ${c.duration}s`);
  const segs = c.segments.map((s) => s.src).sort((a, b) => a[0] - b[0]);
  segs.forEach((s, i) => i && must(s[0] >= segs[i - 1][1] - 1e-6, `원본 조각이 겹침 ${JSON.stringify(segs)}`)); // 겹치면 같은 소리가 두 번
  const kept = c.segments.reduce((a, s) => a + s.src[1] - s.src[0], 0);
  must(Math.abs(kept - c.duration) < 0.05, '조각 길이 합 ≠ 편집 길이');
});
test('편집본 A/V 길이 일치', () => {
  const d = (sel) => Number(sh('ffprobe', ['-v', 'error', '-select_streams', sel, '-show_entries', 'stream=duration', '-of', 'csv=p=0', path.join(T, 'edit.mp4')]).out.trim());
  must(Math.abs(d('v:0') - d('a:0')) < 0.1, `영상 ${d('v:0')}s / 소리 ${d('a:0')}s`);
});
test('편집본 자막이 실제 소리 위치와 맞음 (±0.15s)', () => {
  const r = sh('ffmpeg', ['-hide_banner', '-nostats', '-i', path.join(T, 'edit.mp4'), '-af', 'silencedetect=noise=-35dB:d=0.05', '-f', 'null', '-']);
  const onsets = [0, ...[...r.out.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))];
  const ce = json(path.join(T, 'captions.edit.json'));
  ce.forEach((c) => must(onsets.some((o) => Math.abs(o - c.start) < 0.15), `자막 "${c.text}" ${c.start}s 근처에 소리 시작이 없음 (${onsets.map((o) => o.toFixed(2))})`));
});
test('재배치: 3번을 맨 앞으로, 원본 조각 겹침 없음', () => {
  fs.writeFileSync(path.join(T, 'edit.json'), JSON.stringify({order: [[3, 3], [1, 2]]}));
  const r = edit();
  must(r.code === 0, r.out.split('\n').slice(-3).join(' | '));
  const ce = json(path.join(T, 'captions.edit.json'));
  must(ce.map((c) => c.text).join() === '셋,하나,둘', ce.map((c) => c.text).join());
  const segs = json(path.join(T, 'cuts.json')).segments.map((s) => s.src).sort((a, b) => a[0] - b[0]);
  segs.forEach((s, i) => i && must(s[0] >= segs[i - 1][1] - 1e-6, `겹침 ${JSON.stringify(segs)}`));
});

test('손으로 자르기: edit.json cut 구간의 소리와 자막이 함께 빠짐', () => {
  fs.writeFileSync(path.join(T, 'edit.json'), JSON.stringify({cut: [[1.9, 3.1]]}));
  const r = edit();
  must(r.code === 0, r.out.split('\n').slice(-3).join(' | '));
  const ce = json(path.join(T, 'captions.edit.json'));
  must(ce.map((c) => c.text).join() === '하나,셋', ce.map((c) => c.text).join());
  const c = json(path.join(T, 'cuts.json'));
  must(c.duration < 3.0, `편집 길이 ${c.duration}s ('둘' 1초가 안 빠짐)`);
  fs.writeFileSync(path.join(T, 'edit.json'), JSON.stringify({order: [[3, 3], [1, 2]]})); // 다음 시험은 재배치 상태를 쓴다
  must(edit().code === 0, '되돌리기 실패');
});

// ── 4. 검사기: 원본 시간 plan 이 편집 시간으로 옮겨지고, 알려진 실수는 막힌다
const check = (plan) => {
  fs.writeFileSync(path.join(T, 'plan.json'), JSON.stringify(plan));
  return sh(process.execPath, ['scripts/render.mjs', '.selftest', '--check']);
};
const hero = (id, a, b) => ({id, in: a, out: b, mode: 'cutaway', template: 'hero', props: {object: 'bulb', title: '셋', objectAt: a + 0.1}});
test('plan(원본 시간) → 편집 시간으로 옮김 + .props.json 갱신', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{...hero('a', 4.5, 5.9), mode: 'panel'}]});
  must(r.code === 0, r.out.trim().split('\n').pop());
  const p = json(path.join(T, '.props.json'));
  must(p.scenes[0].in < 0.3, `3번이 맨 앞인데 장면 in=${p.scenes[0].in}`);
  must(p.video.src.endsWith('edit.mp4'), '편집본을 안 씀');
});
test('막힘: 첫 1초 컷어웨이 (훅은 얼굴)', () => {
  fs.writeFileSync(path.join(T, 'edit.json'), JSON.stringify({order: [[1, 3]]}));
  edit();
  const r = check({theme: {palette: 'darktech'}, scenes: [hero('a', 0.0, 1.5)]});
  must(r.code !== 0 && /훅/.test(r.out), '통과해 버림');
});
test('막힘: morph 첫 상태가 늦어 빈 판', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'm', in: 2.0, out: 4.0, mode: 'panel', template: 'morph', props: {states: [{t: 3.0, kind: 'pill', text: 'x'}]}}]});
  must(r.code !== 0 && /빈 판/.test(r.out), '통과해 버림');
});
test('막힘: 승인 안 된/대비 낮은 트라이어드', () => {
  const r = check({theme: {palette: 'darktech', triad: ['#777777', '#888888', '#999999']}, scenes: []});
  must(r.code !== 0 && /triad/.test(r.out), '통과해 버림');
});
test('막힘: 없는 오브젝트·효과음', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{...hero('a', 2.0, 3.0), props: {object: 'unicorn', title: 'x'}, sfx: [{t: 2, cue: 'boom'}]}]});
  must(r.code !== 0 && /unicorn/.test(r.out) && /boom/.test(r.out), '통과해 버림');
});

test('막힘: 머리 위 공간이 없는데 above (얼굴 가림 정책)', () => {
  const vj = path.join(T, 'video.json');
  const v = json(vj);
  // 화면을 꽉 채운 얼굴: 정수리 0.02, 턱 0.9
  fs.writeFileSync(vj, JSON.stringify({...v, head: {top: 0.02, chin: 0.9, left: 0.1, right: 0.9}, track: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((t) => [t, 0.02, 0.9, 0.1, 0.9])}));
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'a', in: 4.5, out: 5.9, mode: 'above', template: 'keyword', props: {text: '셋', times: [4.6]}}]});
  fs.writeFileSync(vj, JSON.stringify(v));
  must(r.code !== 0 && /정책\(얼굴\)/.test(r.out), '통과해 버림');
});
test('막힘: 머리 위/아래 카드에 안 맞는 템플릿 (compare 를 below 에)', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'a', in: 4.5, out: 5.9, mode: 'below', template: 'compare', props: {left: {title: 'a'}, right: {title: 'b'}}}]});
  must(r.code !== 0 && /below/.test(r.out), '통과해 버림');
});

// 다양성: 편집본(재배치 [[1,3]]) 원본 0.3–2.9 · 2.9–5.9 → 편집 약 0.3–1.9 · 1.9–3.7 로 붙은 두 장면
const pair = (a, b) => [{id: 'a', in: 0.3, out: 2.9, mode: 'panel', ...a}, {id: 'b', in: 2.9, out: 5.9, mode: 'panel', ...b}];
const kw = {template: 'keyword', props: {text: '하나', times: [0.4]}};
test('막힘: 붙은 두 장면의 배치·모션이 같음 (다양성 정책)', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: pair(kw, {template: 'keyword', props: {text: '셋', times: [4.6]}})});
  must(r.code !== 0 && /정책\(다양성\) 장면 a→b/.test(r.out), '통과해 버림');
});
test('막힘: 붙은 두 장면의 주인공 오브젝트가 같음', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: pair({template: 'list', props: {object: 'bulb', items: [{text: 'x', at: 0.4}]}}, {mode: 'cutaway', ...hero('b', 2.9, 5.9)})});
  must(r.code !== 0 && /주인공 "bulb"/.test(r.out), '통과해 버림');
});
test('막힘: morph 안에서 같은 모양이 연속 (pill → pill)', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'm', in: 2.9, out: 5.9, mode: 'panel', template: 'morph', props: {states: [{t: 3.0, kind: 'pill', text: 'a'}, {t: 4.6, kind: 'pill', text: 'b'}]}}]});
  must(r.code !== 0 && /pill → pill/.test(r.out), '통과해 버림');
});
test('통과: 배치만 같고 모션·주인공이 다른 두 장면 (strict 취향이면 막힘)', () => {
  const plan = {theme: {palette: 'darktech'}, scenes: pair(kw, {template: 'hero', props: {object: 'bulb', title: '셋', objectAt: 4.6}})};
  const r = check(plan);
  must(r.code === 0, r.out.trim().split('\n').filter((l) => l.startsWith('❌')).join(' | '));
  fs.writeFileSync(path.join(T, 'taste.json'), JSON.stringify({broll: {variety: 'strict'}}));
  const s = check(plan);
  fs.rmSync(path.join(T, 'taste.json'));
  must(s.code !== 0 && /0개까지/.test(s.out), 'strict 인데 통과해 버림');
});

// ── 5. 렌더 한 프레임 (브라우저 필요)
if (!quick)
  test('스틸 렌더 (npm run still)', () => {
    check({theme: {palette: 'darktech'}, scenes: [hero('a', 4.5, 5.9)]});
    const r = sh(process.execPath, ['scripts/still.mjs', '.selftest', '5.2']);
    must(r.code === 0 && fs.existsSync(path.join(T, 'out', 'still.png')), r.out.trim().split('\n').pop());
  });
if (!quick)
  test('스토리보드 (npm run storyboard): 장면마다 한 칸 + 지문 표, 다양성 위반이면 표만 쓰고 멈춤, 끝에 늦게 나오는 요소 ⚠️', () => {
    check({theme: {palette: 'darktech'}, scenes: pair(kw, {template: 'hero', props: {object: 'bulb', title: '셋', objectAt: 4.6}})});
    const sb = () => sh(process.execPath, ['scripts/storyboard.mjs', '.selftest']);
    const r = sb();
    const sheet = path.join(T, 'out', 'storyboard.png');
    must(r.code === 0 && fs.existsSync(sheet), r.out.trim().split('\n').pop());
    const w = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'stream=width', '-of', 'csv=p=0', sheet]).out.trim());
    must(w > 800, `시트 폭 ${w}px — 두 칸이 아님`);
    must(/\| a \|.*\| b \|.*배치/s.test(fs.readFileSync(path.join(T, 'storyboard.md'), 'utf8')), 'storyboard.md 에 장면 a·b 와 같은 축(배치)이 없음');
    // 예전: avatar-v01 장면 06 "번지죠" 가 무음을 줄인 장면 끝 0.5초 전에야 나와 거의 안 보였다
    check({theme: {palette: 'darktech'}, scenes: pair(kw, {template: 'keyword', props: {text: '셋', times: [5.7]}})});
    const x = sb();
    const md = fs.readFileSync(path.join(T, 'storyboard.md'), 'utf8');
    must(x.code !== 0 && /정책\(다양성\)/.test(md), '다양성 위반인데 시트를 만들어 버림');
    must(/⚠️ 장면 b: 마지막 요소/.test(md), '장면 끝에 나오는 요소를 알리지 않음');
  });

fs.rmSync(T, {recursive: true, force: true});
fs.rmSync('public/_live', {recursive: true, force: true});

for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : `\n     ${r.msg}`}`);
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad}/${results.length} 실패` : `\n✅ ${results.length}개 통과`);
process.exit(bad ? 1 : 0);
