#!/usr/bin/env node
// 파이썬 스크립트를 가상환경(.venv) 파이썬으로 실행 — 운영체제와 상관없이 같은 명령
//   npm run edit -- <이름> [--list]          = scripts/edit.py projects/<이름>
//   npm run transcribe -- <이름> --hint "…"  (face, align, probe, look, sfx 도 같은 식)
// 첫 인자가 프로젝트 이름이면 projects/<이름> 으로 바꿔 준다.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {findPython, hasVenv, PY_ENV, ROOT, VENV_PY} from './platform.mjs';

const [name, ...rest] = process.argv.slice(2);
const script = name && path.join(ROOT, 'scripts', name.endsWith('.py') ? name : `${name}.py`);
if (!script || !fs.existsSync(script)) {
  console.error('사용법: node scripts/py.mjs <transcribe|face|align|edit|look|probe|sfx> [인자…]');
  process.exit(1);
}
const i = rest.findIndex((a) => !a.startsWith('-'));
if (i >= 0 && !fs.existsSync(rest[i]) && fs.existsSync(path.join('projects', rest[i]))) rest[i] = path.join('projects', rest[i]);

// 음성 인식·얼굴 인식·효과음은 .venv 의 패키지가 필요하다. 나머지는 표준 라이브러리만 써서 시스템 파이썬으로도 돈다
let cmd = VENV_PY;
let pre = [];
if (!hasVenv()) {
  const sys = /(transcribe|face|sfx)\.py$/.test(script) ? null : findPython();
  if (!sys) {
    console.error('❌ 파이썬 가상환경(.venv)이 없습니다 → npm run setup');
    process.exit(1);
  }
  ({cmd, pre} = sys);
}
const r = spawnSync(cmd, [...pre, script, ...rest], {stdio: 'inherit', env: PY_ENV});
if (r.error) console.error(`❌ 파이썬을 실행하지 못했습니다 (${r.error.message}) → npm run doctor`);
process.exit(r.status ?? 1);
