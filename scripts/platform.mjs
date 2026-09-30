// 운영체제마다 다른 것을 한곳에 — macOS·Linux·Windows 모두 같은 npm 명령으로 쓰려고
//   파이썬 이름(python3 / py / python), 가상환경 경로(.venv/bin / .venv\Scripts), npx·npm(.cmd), 한글 인코딩(cp949)
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const WIN = process.platform === 'win32';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 가상환경 파이썬: Windows 는 .venv\Scripts\python.exe
export const VENV_PY = path.join(ROOT, '.venv', ...(WIN ? ['Scripts', 'python.exe'] : ['bin', 'python']));
export const hasVenv = () => fs.existsSync(VENV_PY);

// 한국어 Windows 는 기본 인코딩이 cp949 라 한글 JSON·출력이 깨진다 → 파이썬을 UTF-8 모드로
export const PY_ENV = {...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8'};

// 시스템 파이썬 찾기 (가상환경을 만들 때). 음성 인식 패키지가 있는 3.10~3.13 을 먼저 고른다.
//   Windows: py 런처가 가장 확실하다. python3 는 설치 안 됐으면 스토어로 가는 바로가기일 수 있다.
const SUPPORTED = ['3.12', '3.11', '3.13', '3.10'];
export const findPython = () => {
  const cands = WIN
    ? [...SUPPORTED.map((v) => ['py', `-${v}`]), ['py', '-3'], ['python'], ['python3']]
    : [...SUPPORTED.map((v) => [`python${v}`]), ['python3'], ['python']];
  let any = null;
  for (const [cmd, ...pre] of cands) {
    const r = spawnSync(cmd, [...pre, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], {encoding: 'utf8'});
    const version = r.status === 0 ? r.stdout.trim() : '';
    if (!/^\d+\.\d+$/.test(version)) continue;
    const found = {cmd, pre, version, ok: SUPPORTED.includes(version)};
    if (found.ok) return found;
    any ??= found;
  }
  return any;
};

// npm·npx 는 Windows 에서 .cmd 라 셸 없이 spawn 하면 실패한다
export const npm = (args, opts = {}) => spawnSync('npm', args, {shell: WIN, ...opts});

// Remotion CLI 를 node 로 직접 (npx 를 거치지 않음)
const REMOTION = path.join(ROOT, 'node_modules', '@remotion', 'cli', 'remotion-cli.js');
export const remotion = (args, opts = {}) => spawnSync(process.execPath, [REMOTION, ...args], opts);
