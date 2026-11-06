#!/usr/bin/env node
// 내 디자인 1장 — 지금 취향(자막 세트·색)을 예시 영상 위에 입혀 바로 본다. 전체 렌더 없이 30초쯤.
//   npm run sample                                     내 취향 그대로 → projects/taste-sample/out/my-design.png
//   npm run sample -- --taste '{"captions":{"set":"news"}}'   이번만 이 값으로 (내 취향은 안 바뀜)
//   npm run sample -- --out 어딘가.png
// 예시 영상은 docs/example/before.mp4, 장면은 examples/avatar-v01 (팔레트만 빼서 내 취향이 먹게).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {hasVenv} from './platform.mjs';

const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const SLUG = 'taste-sample';
const dir = path.join('projects', SLUG);
const run = (cmd, a, opts = {}) => {
  const r = spawnSync(cmd, a, {encoding: 'utf8', ...opts});
  if (r.status !== 0) {
    process.stdout.write((r.stdout ?? '') + (r.stderr ?? ''));
    process.exit(1);
  }
  return r;
};

if (!fs.existsSync(path.join(dir, 'cuts.json'))) {
  if (!hasVenv()) {
    console.error('❌ 파이썬 가상환경(.venv)이 없습니다 → npm run setup');
    process.exit(1);
  }
  console.log('예시 프로젝트를 준비합니다 (처음 한 번)…');
  fs.rmSync(dir, {recursive: true, force: true});
  run(process.execPath, ['scripts/new-project.mjs', 'docs/example/before.mp4', SLUG]);
  const ex = 'examples/avatar-v01';
  for (const f of ['captions.json', 'edit.json', 'plan.json', 'script.txt', 'words.json']) fs.copyFileSync(path.join(ex, f), path.join(dir, f));
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
  delete plan.theme; // 팔레트를 plan 에 적으면 취향보다 앞선다
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 1));
  run(process.execPath, ['scripts/py.mjs', 'edit', SLUG]);
}

// 이번만 쓸 취향 (프로젝트 취향 자리). 안 주면 비워서 내 취향이 그대로 보이게
const taste = path.join(dir, 'taste.json');
fs.rmSync(taste, {force: true});
if (opt('--taste')) fs.writeFileSync(taste, opt('--taste'));

// 원본 시간: 얼굴+자막 · 위 칸 판 · 화면 전체 장면
const times = (opt('--times') ?? '20.1 6.95 12.6').split(' ');
const r = spawnSync(process.execPath, ['scripts/still.mjs', SLUG, ...times], {encoding: 'utf8'});
if (r.status !== 0) {
  process.stdout.write((r.stdout ?? '') + (r.stderr ?? ''));
  process.exit(1);
}
const out = opt('--out') ?? path.join(dir, 'out', 'my-design.png');
fs.mkdirSync(path.dirname(out), {recursive: true});
fs.copyFileSync(path.join(dir, 'out', 'still.png'), out);
console.log(`내 디자인: ${out}`);
