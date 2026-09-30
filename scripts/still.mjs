#!/usr/bin/env node
// 원하는 순간의 스틸을 바로 본다 (렌더 없이). 시간 계산은 이 스크립트가 한다.
//   npm run still -- <이름> 16.3 17.0          원본 시간(plan.json·words.json 과 같은 기준)
//   npm run still -- <이름> 3.2 --edit          편집 시간(edit.mp4 / 결과 영상 기준)
//   npm run still -- <이름> --scene 06          그 장면의 시작·가운데·끝
// → projects/<이름>/out/still.png (여러 장이면 가로로 이어 붙임)
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {remotion} from './platform.mjs';
import {COMP_FPS, loadCuts, mapTime, toFrame} from './timeline.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--') && isNaN(Number(a)));
if (!slug) {
  console.error('사용법: npm run still -- <이름> <초…> [--edit] [--scene <id>]');
  process.exit(1);
}
const dir = path.join('projects', slug);
const editTime = args.includes('--edit');
const sceneId = args.includes('--scene') ? args[args.indexOf('--scene') + 1] : null;
let times = args.filter((a) => a !== sceneId && !isNaN(Number(a))).map(Number);

// .props.json 을 최신으로 (render --check 가 plan·정책·편집을 합쳐 쓴다)
const chk = spawnSync(process.execPath, ['scripts/render.mjs', slug, '--check'], {encoding: 'utf8'});
if (chk.status !== 0) {
  process.stdout.write(chk.stdout + chk.stderr);
  process.exit(1);
}
const cuts = loadCuts(dir);
if (sceneId) {
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
  const sc = plan.scenes.find((s) => String(s.id) === String(sceneId));
  if (!sc) {
    console.error(`장면 ${sceneId} 없음`);
    process.exit(1);
  }
  times = [sc.in + 0.15, (sc.in + sc.out) / 2, sc.out - 0.2];
}
if (!times.length) {
  console.error('시각을 하나 이상 주세요');
  process.exit(1);
}
const toEdit = (t) => (editTime || !cuts ? t : (mapTime(cuts, t, 'start') ?? {t}).t);
const out = path.join(dir, 'out');
fs.mkdirSync(out, {recursive: true});
const files = times.map((t, i) => {
  const f = path.join(out, `.still_${i}.png`);
  const frame = toFrame(toEdit(t), COMP_FPS);
  const r = remotion(['still', 'Short', f, `--frame=${frame}`, `--props=${path.join(dir, '.props.json')}`, '--scale=0.4', '--log=error'], {encoding: 'utf8'});
  if (r.status !== 0) {
    process.stdout.write(r.stdout + r.stderr);
    process.exit(1);
  }
  console.log(`  [${i + 1}] ${editTime || !cuts ? '' : `원본 ${t.toFixed(2)}s → `}편집 ${toEdit(t).toFixed(2)}s (프레임 ${frame})`);
  return f;
});
const sheet = path.join(out, 'still.png');
const inputs = files.flatMap((f) => ['-i', f]);
spawnSync('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, ...(files.length > 1 ? ['-filter_complex', `hstack=${files.length}`] : []), sheet], {stdio: 'inherit'});
files.forEach((f) => fs.rmSync(f, {force: true}));
console.log(`스틸: ${sheet}`);
