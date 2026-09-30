#!/usr/bin/env node
// 한 번만 실행: 필요한 도구 확인 → 설치 → 효과음 생성  (macOS·Linux·Windows 같은 명령)
//   npm run setup
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {findPython, hasVenv, npm, PY_ENV, remotion, VENV_PY, WIN} from './platform.mjs';

const has = (cmd, args = ['-version']) => spawnSync(cmd, args, {stdio: 'ignore'}).status === 0;
const must = (r, what) => {
  if (r.status !== 0) {
    console.error(`\n❌ 실패: ${what}${r.error ? ` (${r.error.message})` : ''}`);
    process.exit(1);
  }
};
const run = (cmd, args, opts = {}) => must(spawnSync(cmd, args, {stdio: 'inherit', ...opts}), `${cmd} ${args.join(' ')}`);
const how = (win, mac) => (WIN ? win : mac);

console.log('🔎 준비물 확인');
const major = Number(process.versions.node.split('.')[0]);
const python = hasVenv() ? null : findPython();
const checks = [
  ['Node.js 18+', major >= 18, how('winget install OpenJS.NodeJS.LTS', 'https://nodejs.org 에서 LTS 설치')],
  ['ffmpeg', has('ffmpeg'), how('winget install Gyan.FFmpeg  (설치 뒤 터미널을 새로 여세요)', 'macOS: brew install ffmpeg · Ubuntu: sudo apt install ffmpeg')],
  ['Python 3.10~3.13', hasVenv() || !!python, how('winget install Python.Python.3.12  (설치 뒤 터미널을 새로 여세요)', 'macOS: brew install python@3.12 · https://www.python.org')],
];
let bad = false;
for (const [name, ok, fix] of checks) {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${ok ? '' : `  → ${fix}`}`);
  if (!ok) bad = true;
}
if (bad) process.exit(1);
if (python && !python.ok) console.log(`  ⚠️  Python ${python.version} — 음성 인식 패키지가 아직 없을 수 있습니다. 설치가 실패하면 3.12 를 깔고 .venv 폴더를 지운 뒤 다시`);

if (!fs.existsSync('node_modules/remotion')) {
  console.log('\n📦 npm 패키지 설치');
  must(npm(['install'], {stdio: 'inherit'}), 'npm install');
}

if (!hasVenv()) {
  console.log(`\n🐍 파이썬 가상환경(.venv) 만들기 (Python ${python.version})`);
  run(python.cmd, [...python.pre, '-m', 'venv', '.venv']);
}
console.log('\n🎙️  음성 인식(faster-whisper) · 얼굴 인식(OpenCV) 설치');
run(VENV_PY, ['-m', 'pip', 'install', '-q', '--upgrade', 'pip']);
run(VENV_PY, ['-m', 'pip', 'install', '-q', '-r', 'requirements.txt']);

// 효과음은 저장소에 들어 있다. 지워졌을 때만 다시 합성한다 (같은 소리가 나옴)
if (!fs.existsSync('public/sfx/whoosh.wav')) {
  console.log('\n🔊 효과음 만들기');
  run(VENV_PY, ['scripts/sfx.py'], {env: PY_ENV});
}

// 첫 사용 때 '멈춘 것처럼' 보이는 두 다운로드를 미리 받는다 (실패해도 나중에 자동으로 받으니 계속)
console.log('\n🌐 렌더용 브라우저 받기 (≈100MB)');
remotion(['browser', 'ensure'], {stdio: 'inherit'});
console.log('\n🧠 음성 인식 모델(small) 받기 (≈500MB, 몇 분 걸릴 수 있어요)');
spawnSync(VENV_PY, ['-c', "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"], {stdio: 'inherit', env: PY_ENV});

console.log('\n🩺 진단');
spawnSync(process.execPath, ['scripts/doctor.mjs'], {stdio: 'inherit'});

console.log(`
✨ 준비 끝!

  1) 데모 렌더(영상 없이):   npm run demo
  2) 내 영상으로 만들기:     Claude Code 에서  /shorts 영상경로
`);
