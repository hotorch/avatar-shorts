#!/usr/bin/env node
// 설치·환경 진단. 문제가 생기면 이것부터:  npm run doctor
// 이슈를 올릴 때 이 출력 전체를 붙여 주세요 (개인 정보는 들어 있지 않습니다).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, {encoding: 'utf8'});
  return r.status === 0 ? (r.stdout || r.stderr).trim() : null;
};
const rows = [];
const add = (ok, name, detail, fix) => rows.push({ok, name, detail, fix});
const py = process.platform === 'win32' ? '.venv/Scripts/python' : '.venv/bin/python';

if (process.platform === 'win32') add('warn', '운영체제', 'Windows', 'WSL2(Ubuntu) 안에서 쓰세요 — 일반 Windows 터미널은 아직 지원하지 않습니다 (README 준비물)');

const nodeMajor = Number(process.versions.node.split('.')[0]);
add(nodeMajor >= 18 ? 'ok' : 'bad', 'Node.js', process.versions.node, 'Node 18 이상 설치 (https://nodejs.org)');

const ff = run('ffmpeg', ['-hide_banner', '-version']);
const ffVer = ff?.match(/ffmpeg version (\S+)/)?.[1];
add(ff ? 'ok' : 'bad', 'ffmpeg', ffVer ?? '없음', 'macOS: brew install ffmpeg · Windows: winget install ffmpeg · Ubuntu: sudo apt install ffmpeg');
if (ff) {
  const filters = run('ffmpeg', ['-hide_banner', '-filters']) ?? '';
  const need = ['silencedetect', 'atrim', 'afade', 'concat'];
  const miss = need.filter((f) => !new RegExp(`\\s${f}\\s`).test(filters));
  add(miss.length ? 'bad' : 'ok', 'ffmpeg 필터', miss.length ? `없음: ${miss.join(', ')}` : need.join(', '), '전체 기능 빌드의 ffmpeg 로 다시 설치 (brew install ffmpeg)');
  const enc = run('ffmpeg', ['-hide_banner', '-encoders']) ?? '';
  add(/libx264/.test(enc) ? 'ok' : 'bad', 'H.264 인코더', /libx264/.test(enc) ? 'libx264' : '없음', 'libx264 가 포함된 ffmpeg 설치');
}
add(run('ffprobe', ['-version']) ? 'ok' : 'bad', 'ffprobe', run('ffprobe', ['-version'])?.match(/version (\S+)/)?.[1] ?? '없음', 'ffmpeg 와 함께 설치됩니다');

const pyv = run('python3', ['--version']);
const [pm, pn] = (pyv?.match(/(\d+)\.(\d+)/) ?? []).slice(1).map(Number);
add(pyv && (pm > 3 || pn >= 10) ? 'ok' : 'bad', 'python3', pyv ?? '없음', 'Python 3.10 이상 설치');

add(fs.existsSync('node_modules/remotion') ? 'ok' : 'bad', 'npm 패키지', fs.existsSync('node_modules/remotion') ? '설치됨' : '없음', 'npm run setup');
const fw = fs.existsSync(py) ? run(py, ['-c', 'import faster_whisper; print(faster_whisper.__version__)']) : null;
add(fw ? 'ok' : 'bad', '음성 인식 (faster-whisper)', fw ?? (fs.existsSync(py) ? '.venv 에 없음' : '.venv 없음'), 'npm run setup');

const hf = `${os.homedir()}/.cache/huggingface/hub`;
const models = fs.existsSync(hf) ? fs.readdirSync(hf).filter((d) => /faster-whisper/.test(d)).map((d) => d.replace(/.*faster-whisper-/, '')) : [];
add(models.length ? 'ok' : 'warn', '음성 인식 모델', models.length ? models.join(', ') : '아직 안 받음', '첫 받아쓰기 때 자동으로 받습니다 (small ≈ 500MB, 몇 분). 미리: npm run setup');

const sfx = fs.existsSync('public/sfx') ? fs.readdirSync('public/sfx').filter((f) => f.endsWith('.wav')).length : 0;
add(sfx >= 11 ? 'ok' : 'bad', '효과음', `${sfx}개`, `${py} scripts/sfx.py`);
const fonts = fs.readdirSync('public/fonts').filter((f) => f.endsWith('.woff2')).length;
add(fonts >= 6 ? 'ok' : 'bad', '글꼴', `${fonts}개`, 'git 으로 다시 받기 (public/fonts)');
const objs = fs.existsSync('public/objects/clay') ? fs.readdirSync('public/objects/clay').length : 0;
add(objs >= 60 ? 'ok' : 'bad', '3D 오브젝트', `${objs}개`, 'git 으로 다시 받기 (public/objects)');

const cacheRoot = 'node_modules/.remotion';
const browser = fs.existsSync(cacheRoot) && fs.readdirSync(cacheRoot).some((d) => /chrome|headless/i.test(d));
add(browser ? 'ok' : 'warn', '렌더용 브라우저', browser ? '있음' : '아직 안 받음', '첫 렌더 때 자동으로 받습니다 (≈100MB). 미리: npx remotion browser ensure');

const free = (() => {
  try {
    return Math.round(fs.statfsSync('.').bavail * fs.statfsSync('.').bsize / 1e9);
  } catch {
    return null;
  }
})();
if (free != null) add(free >= 5 ? 'ok' : 'warn', '디스크 여유', `${free}GB`, '렌더에 영상 1분당 1~2GB 여유가 필요합니다');

const icon = {ok: '✅', warn: '⚠️ ', bad: '❌'};
console.log(`avatar-shorts doctor — ${os.platform()} ${os.arch()} · ${os.release()}\n`);
const pad = (s, n) => s + ' '.repeat(Math.max(1, n - [...s].reduce((w, c) => w + (/[ᄀ-힣]/.test(c) ? 2 : 1), 0)));
for (const r of rows) console.log(`${icon[r.ok]} ${pad(r.name, 28)}${r.detail}${r.ok === 'ok' ? '' : `\n     → ${r.fix}`}`);
const bad = rows.filter((r) => r.ok === 'bad').length;
console.log(bad ? `\n❌ ${bad}개를 고쳐야 합니다. 위 → 안내대로 하고 다시 npm run doctor` : '\n✅ 준비 완료');
process.exit(bad ? 1 : 0);
