#!/usr/bin/env node
// 영상 하나로 새 프로젝트 폴더를 만든다.
//   npm run new -- <영상경로> [이름]
// → projects/<이름>/input.mp4 (+ video.json, 대표 프레임)
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import os from 'node:os';

const [srcArg, nameArg] = process.argv.slice(2);
if (!srcArg) {
  console.error('사용법: npm run new -- <영상경로> [프로젝트이름]');
  process.exit(1);
}
// 경로가 틀렸거나 줄여 쓴 경우(…/파일.mp4, ~/Desktop/파일.mp4): 파일 이름으로 흔한 폴더를 찾아 본다
const findByName = (name) => {
  const roots = ['.', 'projects', ...['Desktop', 'Downloads', 'Movies', 'Videos', 'Documents'].map((d) => path.join(os.homedir(), d))];
  const hits = [];
  const walk = (d, depth) => {
    if (depth > 3 || hits.length > 5) return;
    let ents = [];
    try {
      ents = fs.readdirSync(d, {withFileTypes: true});
    } catch {
      return;
    }
    for (const e of ents) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue;
      const p = path.join(d, e.name);
      if (e.isFile() && e.name.normalize('NFC') === name.normalize('NFC')) hits.push(p);
      else if (e.isDirectory()) walk(p, depth + 1);
    }
  };
  roots.forEach((r) => walk(r, 0));
  return [...new Set(hits.map((h) => path.resolve(h)))].filter((h) => !h.includes(`${path.sep}projects${path.sep}`) || !/input\.mp4$|edit\.mp4$/.test(h));
};
let src = srcArg.replace(/^~(?=\/)/, os.homedir());
if (!fs.existsSync(src)) {
  const hits = findByName(path.basename(src));
  if (hits.length === 1) {
    console.log(`경로를 찾았어요: ${hits[0]}`);
    src = hits[0];
  } else {
    console.error(hits.length ? `같은 이름의 파일이 여러 개예요. 전체 경로를 주세요:\n  ${hits.join('\n  ')}` : `영상을 찾을 수 없어요: ${srcArg}`);
    process.exit(1);
  }
}

// macOS 는 한글 파일 이름을 자모로 풀어(NFD) 저장한다 → 합쳐서(NFC) 비교·이름 짓기
const base = (nameArg || path.basename(src, path.extname(src)))
  .normalize('NFC')
  .toLowerCase()
  .replace(/[^a-z0-9가-힣]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'video';
let slug = base;
for (let i = 2; fs.existsSync(path.join('projects', slug)); i++) slug = `${base}-${i}`;
const dir = path.join('projects', slug);
fs.mkdirSync(path.join(dir, 'broll'), {recursive: true});
fs.mkdirSync(path.join(dir, 'out'), {recursive: true});

// 코덱 확인: H.264 mp4 가 아니면 한 번 변환해 둔다 (렌더 안정성)
const probe = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', src]).toString(),
);
const v = probe.streams.find((s) => s.codec_type === 'video');
const ok = v?.codec_name === 'h264' && /mp4|mov/.test(probe.format.format_name) && path.extname(src).toLowerCase() === '.mp4';
const dst = path.join(dir, 'input.mp4');
if (ok) {
  // 하드링크는 쓰지 않는다: 나중에 input.mp4 를 덮어쓰면 사용자 원본까지 바뀐다. (APFS/Btrfs 는 복제라 빠르고 용량도 안 든다)
  fs.copyFileSync(src, dst, fs.constants.COPYFILE_FICLONE);
} else {
  console.log(`영상 형식(${v?.codec_name})을 H.264 mp4 로 변환합니다…`);
  const r = spawnSync(
    'ffmpeg',
    ['-loglevel', 'error', '-y', '-i', src, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', dst],
    {stdio: 'inherit'},
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}

spawnSync('python3', ['scripts/probe.py', dir], {stdio: 'inherit'});
// 머리 위치 추적 (분할 화면·머리 위/아래 카드 배치가 쓴다). OpenCV 는 .venv 에 있다
const py = process.platform === 'win32' ? '.venv/Scripts/python' : '.venv/bin/python';
if (fs.existsSync(py)) spawnSync(py, ['scripts/face.py', dir], {stdio: 'inherit'});
else console.log('⚠️  .venv 가 없어 머리 위치를 못 쟀습니다 → npm run setup 후 .venv/bin/python scripts/face.py ' + dir);
console.log(`\n프로젝트: ${dir}`);
