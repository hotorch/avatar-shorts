#!/usr/bin/env node
// 자체 시험 — 코드를 고친 뒤, PR 전에:  npm test   (음성 인식·전체 렌더 없이 1분 안쪽)
//   --quick  스틸 렌더(브라우저 필요)를 건너뛴다
// 여기 있는 항목은 실제로 겪은 버그들이다. 새 버그를 고치면 여기에 한 줄 추가한다.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {checkTriad} from './style.mjs';

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
  const r = sh('npx', ['tsc', '--noEmit']);
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
test('데모에 필요한 자산이 저장소에 있음 (효과음 11 · 글꼴 · 오브젝트, .gitignore 에 안 걸림)', () => {
  // 예전: public/sfx/*.wav 가 gitignore 라 새로 받은 사람의 npm run demo 가 404 로 실패
  const sfx = fs.readdirSync('public/sfx').filter((f) => f.endsWith('.wav'));
  must(sfx.length >= 11, `효과음 ${sfx.length}개 (11개 필요) → python3 scripts/sfx.py`);
  const ignored = sh('git', ['check-ignore', 'public/sfx/whoosh.wav', 'public/fonts/PretendardVariable.woff2', 'public/objects/clay/bulb.webp']).out.trim();
  must(!ignored, `.gitignore 에 걸림: ${ignored}`);
});
test('커스텀 장면이 전부 등록됨 (src/custom/index.ts)', () => {
  const idx = fs.readFileSync('src/custom/index.ts', 'utf8');
  const files = fs.readdirSync('src/custom').filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', ''));
  const miss = files.filter((f) => !new RegExp(`\\b${f}\\b`).test(idx));
  must(!miss.length, `등록 안 됨: ${miss.join(', ')}`);
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

const edit = () => sh('python3', ['scripts/edit.py', T]);
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
  return sh('node', ['scripts/render.mjs', '.selftest', '--check']);
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

// ── 5. 렌더 한 프레임 (브라우저 필요)
if (!quick)
  test('스틸 렌더 (npm run still)', () => {
    check({theme: {palette: 'darktech'}, scenes: [hero('a', 4.5, 5.9)]});
    const r = sh('node', ['scripts/still.mjs', '.selftest', '5.2']);
    must(r.code === 0 && fs.existsSync(path.join(T, 'out', 'still.png')), r.out.trim().split('\n').pop());
  });

fs.rmSync(T, {recursive: true, force: true});
fs.rmSync('public/_live', {recursive: true, force: true});

for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : `\n     ${r.msg}`}`);
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad}/${results.length} 실패` : `\n✅ ${results.length}개 통과`);
process.exit(bad ? 1 : 0);
