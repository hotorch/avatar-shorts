#!/usr/bin/env node
// 한 번만 실행: 필요한 도구 확인 → 설치 → 효과음 생성
//   npm run setup
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';

const has = (cmd, args = ['-version']) => spawnSync(cmd, args, {stdio: 'ignore'}).status === 0;
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {stdio: 'inherit'});
  if (r.status !== 0) {
    console.error(`\n❌ 실패: ${cmd} ${args.join(' ')}`);
    process.exit(1);
  }
};

console.log('🔎 준비물 확인');
const major = Number(process.versions.node.split('.')[0]);
const checks = [
  ['Node.js 18+', major >= 18, 'https://nodejs.org 에서 설치'],
  ['ffmpeg', has('ffmpeg'), 'macOS: brew install ffmpeg / Windows: winget install ffmpeg'],
  ['python3', has('python3', ['--version']), 'https://www.python.org 에서 3.10 이상 설치'],
];
let bad = false;
for (const [name, ok, how] of checks) {
  console.log(`  ${ok ? '✅' : '❌'} ${name}${ok ? '' : `  → ${how}`}`);
  if (!ok) bad = true;
}
if (bad) process.exit(1);

if (!fs.existsSync('node_modules/remotion')) {
  console.log('\n📦 npm 패키지 설치');
  run('npm', ['install']);
}

const py = process.platform === 'win32' ? '.venv/Scripts/python' : '.venv/bin/python';
if (!fs.existsSync(py)) {
  console.log('\n🐍 파이썬 가상환경(.venv) 만들기');
  run('python3', ['-m', 'venv', '.venv']);
}
console.log('\n🎙️  음성 인식(faster-whisper) 설치');
run(py, ['-m', 'pip', 'install', '-q', '--upgrade', 'pip']);
run(py, ['-m', 'pip', 'install', '-q', '-r', 'requirements.txt']);

// 효과음은 저장소에 들어 있다. 지워졌을 때만 다시 합성한다 (같은 소리가 나옴)
if (!fs.existsSync('public/sfx/whoosh.wav')) {
  console.log('\n🔊 효과음 만들기');
  run(py, ['scripts/sfx.py']);
}

// 첫 사용 때 '멈춘 것처럼' 보이는 두 다운로드를 미리 받는다 (실패해도 나중에 자동으로 받으니 계속)
console.log('\n🌐 렌더용 브라우저 받기 (≈100MB)');
spawnSync('npx', ['remotion', 'browser', 'ensure'], {stdio: 'inherit'});
console.log('\n🧠 음성 인식 모델(small) 받기 (≈500MB, 몇 분 걸릴 수 있어요)');
spawnSync(py, ['-c', "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"], {stdio: 'inherit'});

console.log('\n🩺 진단');
spawnSync('node', ['scripts/doctor.mjs'], {stdio: 'inherit'});

console.log(`
✨ 준비 끝!

  1) 데모 렌더(영상 없이):   npm run demo
  2) 내 영상으로 만들기:     Claude Code 에서  /shorts 영상경로
`);
