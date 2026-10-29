#!/usr/bin/env node
// 발표자 효과(fx) 장면마다 사람을 오려내고 머리·어깨를 잰다 → projects/<이름>/fx/<장면 id>.{cutout.webm,track.json}
//   npm run fx -- <이름>            바뀐 장면만 (장면 시간·편집본이 그대로면 건너뜀)
//   npm run fx -- <이름> --force    전부 다시
//   npm run fx -- <이름> --debug    장면마다 처음·가운데 프레임에 선을 그린 확인용 png 도
// CPU 로 돈다 (u2net, 영상 1초당 ≈ 7~10초). plan.json(원본 시간)을 render 와 같은 규칙으로 편집 시간으로 옮겨서 자른다.
// 끝나면 text-behind 장면은 글자마다 가려지는 정도를 실제 프레임으로 잰다 (정책 presenterFx.textBehindMinVisible, scripts/fx_check.py).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fxStale} from './fx-rules.mjs';
import {hasVenv, PY_ENV, remotion, VENV_PY} from './platform.mjs';
import {COMP_FPS, loadCuts, remapScene} from './timeline.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
if (!slug) {
  console.error('사용법: npm run fx -- <이름> [--force] [--debug]');
  process.exit(1);
}
const dir = path.join('projects', slug);
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
const cuts = loadCuts(dir);
const src = path.join(dir, cuts ? 'edit.mp4' : 'input.mp4');
const scenes = (plan.scenes ?? [])
  .filter((s) => s.mode === 'fx')
  .map((s) => (cuts && (plan.timebase ?? 'source') === 'source' ? remapScene(cuts, s).scene : s))
  .filter(Boolean);
if (!scenes.length) {
  console.log('plan.json 에 fx 장면이 없습니다 — 오려낼 것 없음');
  process.exit(0);
}
if (!hasVenv()) {
  console.error('❌ 파이썬 가상환경(.venv)이 없습니다 → npm run setup');
  process.exit(1);
}
let bad = 0;
for (const sc of scenes) {
  const why = args.includes('--force') ? '다시' : fxStale(dir, sc, src);
  if (!why) {
    console.log(`✅ 장면 ${sc.id} (${sc.template}): 최신`);
    continue;
  }
  console.log(`✂️  장면 ${sc.id} (${sc.template}) ${sc.in.toFixed(2)}–${sc.out.toFixed(2)}s: ${why}`);
  const fps = 30;
  const dbg = args.includes('--debug') ? ['--debug-frames', `0,${Math.round(((sc.out - sc.in) * fps) / 2)}`] : [];
  const r = spawnSync(VENV_PY, ['scripts/fx_matte.py', '--clip', src, '--from', String(sc.in), '--to', String(sc.out), '--out', path.join(dir, 'fx', sc.id), ...dbg], {
    stdio: 'inherit',
    env: PY_ENV,
  });
  if (r.status !== 0) bad++;
}

// 머리 뒤 글자: 다 솟은 글자(probe word) 한 장 + 장면 모든 프레임의 발표자 실루엣(probe matte) → 글자마다 최악 프레임 가시성
const tb = scenes.filter((s) => s.template === 'text-behind');
if (!bad && tb.length) {
  const chk = spawnSync(process.execPath, ['scripts/render.mjs', slug, '--check'], {encoding: 'utf8'});
  if (chk.status !== 0) {
    console.log('⚠️  render --check 가 막혀 머리 뒤 글자 가시성은 못 쟀습니다 — 검사를 고치고 다시 npm run fx');
    process.exit(0);
  }
  const propsFile = path.join(dir, '.props.json');
  const props = JSON.parse(fs.readFileSync(propsFile, 'utf8'));
  const policy = JSON.parse(fs.readFileSync('style/policy.json', 'utf8'));
  const min = policy.presenterFx?.textBehindMinVisible ?? 0.7;
  for (const sc of tb) {
    const tmp = path.join(dir, 'out', `fxprobe_${sc.id}`); // 점 없는 이름 (remotion 은 이미지 묶음 폴더에 확장자처럼 보이는 점을 거부)
    fs.rmSync(tmp, {recursive: true, force: true});
    fs.mkdirSync(path.join(tmp, 'matte'), {recursive: true});
    const probe = (kind) => {
      const f = path.join(tmp, `props-${kind}.json`);
      fs.writeFileSync(f, JSON.stringify({...props, scenes: props.scenes.map((x) => (x.id === sc.id ? {...x, props: {...x.props, probe: kind}} : x))}));
      return f;
    };
    const p = props.scenes.find((x) => x.id === sc.id);
    const a = Math.round(p.in * COMP_FPS);
    const b = Math.max(a, Math.round(p.out * COMP_FPS) - 1);
    const opts = ['--scale=0.5', '--log=error'];
    const w = remotion(['still', 'Short', path.join(tmp, 'word.png'), `--frame=${b}`, `--props=${probe('word')}`, ...opts], {encoding: 'utf8'});
    const m = remotion(['render', 'Short', path.join(tmp, 'matte'), `--props=${probe('matte')}`, `--frames=${a}-${b}`, '--sequence', '--image-format=png', ...opts], {encoding: 'utf8'});
    if (w.status !== 0 || m.status !== 0) {
      console.log(`❌ 장면 ${sc.id}: 확인용 스틸을 못 만들었습니다
${(w.stderr || '') + (m.stderr || '')}`);
      bad++;
      continue;
    }
    console.log(`🔍 장면 ${sc.id} "${sc.props.text}" — 머리 뒤 글자 가시성`);
    const r = spawnSync(VENV_PY, ['scripts/fx_check.py', path.join(tmp, 'word.png'), path.join(tmp, 'matte'), '--min', String(min)], {stdio: 'inherit', env: PY_ENV});
    if (r.status !== 0) {
      console.log(`❌ 장면 ${sc.id}: 머리가 글자를 너무 가립니다 → 글자를 짧게(width·font), 또는 다른 효과로`);
      bad++;
    } else fs.rmSync(tmp, {recursive: true, force: true});
  }
}
process.exit(bad ? 1 : 0);
