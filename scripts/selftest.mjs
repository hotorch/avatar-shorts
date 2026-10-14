#!/usr/bin/env node
// 자체 시험 — 코드를 고친 뒤, PR 전에:  npm test   (음성 인식·전체 렌더 없이 1분 안쪽)
//   --quick  스틸 렌더(브라우저 필요)를 건너뛴다
// 여기 있는 항목은 실제로 겪은 버그들이다. 새 버그를 고치면 여기에 한 줄 추가한다.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {addRoad, chapterList} from './chapters.mjs';
import {checkTriad} from './style.mjs';
import {frontLoaded, remapScene} from './timeline.mjs';
import {varietyProblems} from './variety.mjs';
import {cutStage, fitFrame, FRAME, headBox} from '../src/layouts/framing.js';
import {avatarSideAt, mirrorX, SWAP} from '../src/layouts/sideSwap.js';

const quick = process.argv.includes('--quick');
// 이 PC 의 내 취향(style/me.json)이 시험 결과를 바꾸지 않게: 시험용 경로로 (자식 프로세스도 물려받는다)
const ME = path.resolve('projects', '.selftest-me.json');
process.env.AVATAR_SHORTS_ME = ME;
fs.rmSync(ME, {force: true});
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
  const r = sh(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit']);
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
test('모든 템플릿에 등장 모션 계열이 있음 (policy variety.motion = render.mjs 템플릿 목록)', () => {
  const rnd = JSON.parse(fs.readFileSync('scripts/render.mjs', 'utf8').match(/const templates = (\[[^\]]+\])/)[1].replace(/'/g, '"')).filter((t) => t !== 'custom');
  const miss = rnd.filter((t) => !policy.variety.motion[t]);
  must(!miss.length, `motion 없음: ${miss.join(', ')}`);
});
test('아바타 확대 레시피: Vertical.tsx 기본값 = 정책 avatarGrow, 마지막 계단은 꽉 채움(1)', () => {
  // 예전: 0.8초·계단 크기가 render.mjs 와 Vertical.tsx 에 따로 적혀 있었다 (avatar-v03)
  const ag = policy.avatarGrow;
  must(ag?.steps?.at(-1)?.scale === 1, '마지막 계단이 1 이 아니면 얼굴 화면으로 이어질 때 튄다');
  const src = fs.readFileSync('src/layouts/Vertical.tsx', 'utf8');
  must(src.includes(`durationSec: ${ag.durationSec},`) && src.includes(`settleSec: ${ag.settleSec},`), 'Vertical.tsx GROW_DEFAULT 의 시간이 정책과 다름');
  const num = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v)); // 1 → 1.0 (Vertical.tsx 표기)
  for (const st of ag.steps) must(src.includes(`{before: ${num(st.before)}, scale: ${st.scale}}`), `계단 ${JSON.stringify(st)} 가 Vertical.tsx 에 없음`);
});
test('예시 plan 이 전부 다양성 정책을 통과 (avatar-v01 · 데모 3개)', () => {
  // 예전: avatar-v01 장면 07~09 가 머리 위 morph 알약 3연속인데 템플릿 검사(maxSameTemplateRun)를 통과했다
  const bad = ['examples/avatar-v01/plan.json', ...fs.readdirSync('examples/demo').map((f) => `examples/demo/${f}`)].flatMap((f) =>
    varietyProblems([...json(f).scenes].sort((a, b) => a.in - b.in), policy.variety).map((m) => `${f}: ${m}`));
  must(!bad.length, bad.join(' / '));
});
test('Windows 에서도 도는 코드 (python3·.venv/bin·npx 를 직접 부르지 않음, 파이썬 파일 읽기·쓰기는 UTF-8)', () => {
  // 예전: WSL 없이는 안 됐다. Windows 에는 python3·.venv/bin 이 없고, npx 는 .cmd 라 spawn 이 실패하고,
  //       한국어 Windows 의 기본 인코딩(cp949)으로 한글 JSON 을 읽다 깨졌다 → scripts/platform.mjs 와 encoding="utf-8"
  const bad = [];
  for (const f of fs.readdirSync('scripts').filter((x) => /\.(mjs|py)$/.test(x))) {
    const src = fs.readFileSync(path.join('scripts', f), 'utf8');
    if (f.endsWith('.mjs') && f !== 'platform.mjs' && /spawnSync\('(python3?|npx|npm)'|['"`]\.venv\/(bin|Scripts)/.test(src)) bad.push(`${f}: python3·npx·.venv 경로 직접 호출 → platform.mjs`);
    const n = (re) => (src.match(re) ?? []).length;
    if (f.endsWith('.py') && (/\.read_text\(\)|text=True/.test(src) || n(/\.write_text\(/g) > n(/, encoding="utf-8"\)/g))) bad.push(`${f}: encoding="utf-8" 없는 파일 읽기·쓰기`);
  }
  must(!bad.length, bad.join(' / '));
});
test('영상은 @remotion/media <Video> (OffthreadVideo 아님) + 렌더가 탭당 캐시를 묶음', () => {
  // 예전: 롱폼(ep01-long)이 "No frame found at position" 으로 들쭉날쭉 멈췄다. OffthreadVideo 는 남은 메모리가 100MB 아래로
  //       잠깐만 떨어져도 프레임 캐시를 반씩 영영 줄여 0 이 되면 막 푼 프레임까지 버린다 (16GB PC, 동시 8탭) → <Video>
  const bad = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, {withFileTypes: true})) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      if (e.isDirectory() || !/\.tsx?$/.test(e.name)) continue;
      const code = fs.readFileSync(p, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // 주석 속 설명은 빼고
      if (/<OffthreadVideo\b|\bOffthreadVideo\b[^;]*from 'remotion'/.test(code)) bad.push(p);
    }
  };
  walk('src');
  must(!bad.length, `OffthreadVideo 사용: ${bad.join(', ')}`);
  const deps = json('package.json').dependencies;
  must(deps['@remotion/media'] === deps.remotion, `@remotion/media ${deps['@remotion/media']} ≠ remotion ${deps.remotion} (버전이 같아야)`);
  must(/--media-cache-size-in-bytes=/.test(fs.readFileSync('scripts/render.mjs', 'utf8')), 'render.mjs 가 --media-cache-size-in-bytes 를 안 넘김 (기본은 탭마다 500MB+)');
});
test('내 취향(style/me.json)은 git 에 안 올라감 (각자 PC)', () => must(sh('git', ['check-ignore', 'style/me.json']).out.trim(), 'style/me.json 이 .gitignore 에 없음'));
test('레퍼런스 영상 → 내 취향: after(장면 많음, 무음 줄임, 어두움) → high · tight · darktech', () => {
  const ref = (f, n) => sh(process.execPath, ['scripts/reference.mjs', f, n]);
  const r = ref('docs/example/after.mp4', 'selftest-ref-after');
  must(r.code === 0, r.out.trim().split('\n').pop());
  const me = json(ME);
  must(me.broll?.density === 'high' && me.edit?.silence === 'tight' && me.look?.palette === 'darktech', JSON.stringify({b: me.broll, e: me.edit, l: me.look}));
  must(me.edit?.maxLength == null, '영상 길이를 배워 버림 (내 말이 잘린다)');
  // 얼굴만 나오는 원본을 더하면 중앙값이 내려간다 (분당 23 · 0 → 11.6 = medium)
  must(ref('docs/example/before.mp4', 'selftest-ref-before').code === 0, 'before 재기 실패');
  must(json(ME).broll.density === 'medium', `레퍼런스 2개 density ${json(ME).broll.density}`);
});
test('데모에 필요한 자산이 저장소에 있음 (효과음 11 · 글꼴 · 오브젝트 · 얼굴 모델, .gitignore 에 안 걸림)', () => {
  // 예전: public/sfx/*.wav 가 gitignore 라 새로 받은 사람의 npm run demo 가 404 로 실패
  const sfx = fs.readdirSync('public/sfx').filter((f) => f.endsWith('.wav'));
  must(sfx.length >= 11, `효과음 ${sfx.length}개 (11개 필요) → npm run sfx`);
  const ignored = sh('git', ['check-ignore', 'public/sfx/whoosh.wav', 'public/fonts/PretendardVariable.woff2', 'public/objects/clay/bulb.webp', 'models/yunet/face_detection_yunet_2023mar.onnx']).out.trim();
  must(!ignored, `.gitignore 에 걸림: ${ignored}`);
});
test('음성 인식은 wav 를 직접 읽어 넘김 (PyAV 를 안 씀)', () => {
  // 예전: av 19 에서 faster-whisper 의 decode_audio 가 metadata_errors 인자로 TypeError → transcribe 실패
  const src = fs.readFileSync('scripts/transcribe.py', 'utf8');
  must(/model\.transcribe\(\s*audio,/.test(src), 'transcribe 에 파일 경로를 넘김 → av 버전에 따라 깨짐');
});
test('자막 빨강 표시: -0원-입니다 처럼 조사가 붙어도 풀림, 2020-2025 범위는 그대로', () => {
  // 예전: 닫는 - 뒤에 한글이 오면 표시가 안 풀려 자막에 "-0원-입니다." 가 그대로 나왔다 (ep01-long)
  must(fs.readFileSync('scripts/align.py', 'utf8').includes('-(.+?)-(?![0-9A-Za-z])", "problem")'), 'align.py 의 빨강 표시 규칙이 바뀜');
  const pat = /(?<![\p{L}\p{N}_])-(.+?)-(?![0-9A-Za-z])/u; // align.py 와 같은 규칙 (파이썬 \w = 유니코드 글자·숫자·_)
  must('-0원-입니다.'.replace(pat, '[$1]') === '[0원]입니다.', '-0원-입니다 가 안 풀림');
  must(!pat.test('2020-2025년'), '2020-2025 범위를 빨강으로 바꿈');
});
test('음성 인식: GPU 라이브러리(cublas)가 없으면 CPU 로 다시 함', () => {
  // 예전: NVIDIA 그래픽카드는 있는데 CUDA 라이브러리가 없는 PC 에서 auto 가 GPU 를 골랐다가 "cublas64_12.dll is not found" 로 죽었다 (test-169)
  const src = fs.readFileSync('scripts/transcribe.py', 'utf8');
  must(/cublas/.test(src) && /recognize\([^)]*"cpu"\)/.test(src), 'CPU 로 다시 하는 길이 없음');
});
test('숫자 카드(stat): 긴 숫자는 상자를 넓히거나 줄여 원·옆 글자와 안 겹침', () => {
  // 예전: 상자가 600px 고정이라 "26,249억 원" 이 밖으로 나가 가로 화면에서 설명 글자와 겹쳤다 (test-169)
  const src = fs.readFileSync('src/scenes/basic.tsx', 'utf8');
  must(/const need = textWidth\(full/.test(src) && /width: boxW/.test(src), 'stat 이 숫자 폭을 재지 않음');
});
test('커스텀 장면이 전부 등록됨 (src/custom/index.ts)', () => {
  const idx = fs.readFileSync('src/custom/index.ts', 'utf8');
  const files = fs.readdirSync('src/custom').filter((f) => f.endsWith('.tsx')).map((f) => f.replace('.tsx', ''));
  const miss = files.filter((f) => !new RegExp(`\\b${f}\\b`).test(idx));
  must(!miss.length, `등록 안 됨: ${miss.join(', ')}`);
});

test('롱폼 챕터: chapter 장면(원본 시간) → 편집 시간 타임스탬프, 첫 줄 00:00, 10초 미만이면 ⚠️', () => {
  const cuts = {duration: 90, segments: [{src: [0, 10], out: [0, 10]}, {src: [20, 100], out: [10, 90]}]}; // 원본 10–20초가 잘림
  const ch = (id, t, num, title) => ({id, in: t, out: t + 2, mode: 'cutaway', template: 'chapter', props: {num, title}});
  const {lines, warn} = chapterList({scenes: [ch('c', 80, '03', '셋째'), ch('a', 25.6, '01', '*첫째*'), ch('b', 60, '02', '둘째')]}, cuts);
  must(lines.join('|') === '00:00 들어가며|00:15 01 첫째|00:50 02 둘째|01:10 03 셋째', lines.join('|'));
  must(!warn.length, warn.join(' / '));
  const short = chapterList({scenes: [ch('a', 25, '01', 'x'), ch('b', 30, '02', 'y')]}, cuts);
  must(short.warn.some((m) => /10초/.test(m)), '5초짜리 챕터를 알리지 않음');
});
test('롱폼 시트: 프레임이 12장을 넘으면 look 시트를 쪽으로 나눔', () => {
  // 예전: 장면 80개 롱폼이면 한 장에 1만 px 넘게 길어져 볼 수 없었다
  const D = path.join('projects', '.selftest-look');
  fs.rmSync(D, {recursive: true, force: true});
  fs.mkdirSync(D, {recursive: true});
  const ts = Array.from({length: 14}, (_, i) => String(0.5 + i * 0.5));
  const r = sh(process.execPath, ['scripts/py.mjs', 'look', 'docs/example/after.mp4', ...ts, '--out', path.join(D, 'sheet.png')]);
  const files = fs.readdirSync(D).sort();
  fs.rmSync(D, {recursive: true, force: true});
  must(r.code === 0, r.out.trim().split('\n').pop());
  must(files.join() === 'sheet-1.png,sheet-2.png', files.join());
});

test('가로 아바타 좌우: chapter avatar 가 다음 장까지 이어지고, 장 카드 동안에만 옮김', () => {
  const ch = (t, avatar) => ({id: String(t), in: t, out: t + 2.5, mode: 'cutaway', template: 'chapter', props: {num: '01', title: 'x', ...(avatar ? {avatar} : {})}});
  const sc = [ch(10, 'right'), ch(30), ch(50, 'left')];
  const at = (t) => avatarSideAt(sc, t);
  must(at(9.9) === 0, `처음은 왼쪽 (${at(9.9)})`);
  must(at(10 + SWAP.DELAY) < 0.01 && at(10 + SWAP.DELAY + SWAP.DUR + 0.01) === 1, `장 카드 안에서 옮겨 가지 않음 (${at(10 + SWAP.DELAY)} → ${at(10 + SWAP.DELAY + SWAP.DUR + 0.01)})`);
  must(at(10 + SWAP.DELAY + SWAP.DUR) <= 1 && 10 + SWAP.DELAY + SWAP.DUR < 12.5, '장 카드(2.5초)가 끝나기 전에 다 옮겨야 함');
  must(at(40) === 1, 'avatar 없는 chapter 에서 되돌아감 (이어져야 함)');
  must(at(60) === 0, '다시 왼쪽으로 안 옴');
  must(mirrorX(80, 520, 1) === 1920 - 80 - 520 && mirrorX(80, 520, 0) === 80, 'mirrorX');
});

// ── 2-1. 머리 배치 (src/layouts/framing.js). 예전: 얼굴 중심만 1265px 에 맞춰 내려서 정수리가 판 밑으로 190px 들어갔다 (avatar-v01)
const V01 = {top: 217, chin: 937, left: 300, right: 780}; // avatar-v01 실측(화면 px)
const REF = {top: 520, chin: 960, left: 300, right: 780}; // 머리 위가 넓은 사람 (레퍼런스)
const BIG = {top: 96, chin: 1190, left: 150, right: 930}; // 화면을 꽉 채운 얼굴
const clear = (f, h) => {
  const top = f.s * h.top + f.ty;
  const chin = f.s * h.chin + f.ty;
  if (f.panel != null) must(top >= f.panel + FRAME.GAP - 0.5, `${f.mode}: 판 ${f.panel} 이 정수리 ${Math.round(top)} 를 가림`);
  if (f.mode === 'above') must(f.box.y + f.box.h <= top - FRAME.GAP + 0.5, `above: 카드 끝 ${f.box.y + f.box.h} ≥ 정수리 ${Math.round(top)}`);
  if (f.mode === 'below') must(f.box.y >= chin + FRAME.GAP - 0.5, `below: 카드 ${f.box.y} ≤ 턱 ${Math.round(chin)}`);
  must(chin + FRAME.CAP_GAP <= f.capY + 0.5, `${f.mode}: 자막 ${f.capY} 이 턱 ${Math.round(chin)} 을 가림`);
  must(f.capY + FRAME.CAP_H <= FRAME.UI_BOTTOM, `${f.mode}: 자막이 플랫폼 UI 자리로 내려감`);
  must(!f.issues.length, f.issues.join(' / '));
};
test('배치: 분할 화면에서 정수리가 판 아래 (avatar-v01 머리)', () => {
  must(V01.top + Math.min(880, 1265 - 0.35 * 1920) < 1010, '예전 공식이 원래 가리던 경우가 아님 — 시험 값 확인');
  clear(fitFrame('panel', V01), V01);
});
test('배치: 머리 위/아래 카드가 얼굴·자막과 안 겹침 (보통·머리 위 넓음·꽉 찬 얼굴)', () => {
  for (const h of [V01, REF]) for (const m of ['panel', 'above', 'below']) clear(fitFrame(m, h), h);
  for (const m of ['above', 'below']) clear(fitFrame(m, BIG), BIG);
});
test('쇼츠 화면 UI 피하기: 자막·카드·컷어웨이 무대가 위·아래·오른쪽 버튼 열에 안 들어감 (잘라 키운 큰 얼굴 포함)', () => {
  // 예전: 위 120·아래 250 만 비우고 오른쪽 버튼 열은 몰라서, 자막이 제목·채널 자리에, 카드 끝이 좋아요·댓글 버튼 밑에 깔렸다 (ep01 쇼츠)
  const S1 = {top: 608, chin: 1394, left: 310, right: 810}; // ep01-s1: 16:9 에서 잘라 1.74배 키운 얼굴
  const R = FRAME.W - FRAME.UI_RIGHT;
  must(FRAME.CAP_X + FRAME.CAP_W <= R, `자막 오른쪽 끝 ${FRAME.CAP_X + FRAME.CAP_W} 이 버튼 열(${R}~) 에 들어감`);
  const cs = cutStage();
  must(cs.x + cs.w <= R && cs.y >= FRAME.SAFE_TOP && cs.y + cs.h <= FRAME.UI_BOTTOM, `컷어웨이 무대 ${JSON.stringify(cs)} 가 UI 자리에 걸침`);
  for (const h of [V01, REF, S1])
    for (const m of ['face', 'panel', 'above', 'below']) {
      const f = fitFrame(m, h);
      clear(f, h);
      if (f.box) {
        must(f.box.y >= FRAME.SAFE_TOP - 0.5, `${m}: 카드 위 ${f.box.y} 가 위 UI 자리`);
        if (f.box.y + f.box.h > FRAME.UI_RIGHT_Y) must(f.box.x + f.box.w <= R, `${m}: 카드 오른쪽 ${f.box.x + f.box.w} 이 버튼 열에 들어감`);
      }
      if (f.panel != null) must(f.panel <= FRAME.UI_RIGHT_Y + 30, `${m}: 판 ${f.panel} 이 버튼 열 높이로 내려감`);
    }
});
test('배치: 판에 안 들어가는 큰 얼굴은 문제로 알림 (조용히 자르지 않음)', () => {
  must(fitFrame('panel', BIG).issues.length > 0, '큰 얼굴 panel 이 통과해 버림');
});
test('바깥 띠(inset): 인물 화면이 줄어 들어간 영상은 띠를 찾고, 꽉 찬 영상은 그대로', () => {
  // 예전: DeepBrain 포토 아바타가 인물을 87% 크기로 아래에 붙여 내보내, 가로 카드 위쪽에 밝은 띠가 보였다 (ep01-long)
  const D = path.join('projects', '.selftest-inset');
  const run = (vf) => {
    fs.rmSync(D, {recursive: true, force: true});
    fs.mkdirSync(D, {recursive: true});
    const g = sh('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xe4e4e4:s=1920x1080:r=25:d=4', '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', path.join(D, 'input.mp4')]);
    must(g.code === 0, g.out);
    const r = sh(process.execPath, ['scripts/py.mjs', 'probe', D]);
    must(r.code === 0, r.out.trim().split('\n').pop());
    return json(path.join(D, 'video.json')).inset;
  };
  // 안쪽 화면(#d8dadd) + 가운데 인물 대신 어두운 상자
  const inner = 'drawbox=x=152:y=140:w=1676:h=940:color=0xd8dadd:t=fill,drawbox=x=800:y=300:w=320:h=780:color=0x223355:t=fill';
  const a = run(inner);
  const b = run('drawbox=x=800:y=300:w=320:h=780:color=0x223355:t=fill');
  fs.rmSync(D, {recursive: true, force: true});
  must(a && Math.abs(a.top - 140 / 1080) < 0.01 && Math.abs(a.left - 152 / 1920) < 0.01 && Math.abs(a.right - 92 / 1920) < 0.01, `띠를 못 찾음: ${JSON.stringify(a)}`);
  must(/^#d[6-a]d[8-c]d[b-f]$/.test(a.colors.top), `띠를 덮을 색 ${a.colors.top} (안쪽 #d8dadd 여야)`);
  must(b == null, `띠 없는 영상에서 띠를 찾음: ${JSON.stringify(b)}`);
});
test('배경 지우기(matte.py): 단색 배경은 투명, 사람과 안쪽 흰 깃은 불투명, 소리 유지', () => {
  // 카드 속 아바타가 "증명사진 같다"는 의견 → 사람만 남긴 투명 영상 (ep01-long). 흰 셔츠 깃이 배경색과 비슷해 구멍이 나지 않아야 한다
  const D = path.join('projects', '.selftest-matte');
  fs.rmSync(D, {recursive: true, force: true});
  fs.mkdirSync(D, {recursive: true});
  const vf = 'drawbox=x=152:y=140:w=1676:h=940:color=0xd8dadd:t=fill,drawbox=x=700:y=360:w=520:h=720:color=0x223355:t=fill,drawbox=x=880:y=420:w=160:h=120:color=0xf4f4f4:t=fill';
  const g = sh('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0xe4e4e4:s=1920x1080:r=30:d=2', '-f', 'lavfi', '-i', 'sine=f=440:d=2', '-vf', vf, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(D, 'input.mp4')]);
  must(g.code === 0, g.out);
  for (const s of ['probe', 'matte']) {
    const r = sh(process.execPath, ['scripts/py.mjs', s, D]);
    must(r.code === 0, r.out.trim().split('\n').pop());
  }
  const m = json(path.join(D, 'matte.json'));
  const webm = path.join(D, m.file);
  const streams = sh('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', webm]).out;
  must(/audio/.test(streams), '투명 영상에 소리가 없음 (side 는 이 영상에서 소리를 낸다)');
  // 알파만 뽑아 세 점을 본다: 배경 · 사람 · 사람 안쪽 흰 깃
  const a = spawnSync('ffmpeg', ['-loglevel', 'error', '-c:v', 'libvpx-vp9', '-i', webm, '-frames:v', '1', '-vf', 'alphaextract', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], {maxBuffer: 1 << 26}).stdout;
  const at = (x, y) => a[(y - m.crop.y) * m.crop.w + (x - m.crop.x)];
  fs.rmSync(D, {recursive: true, force: true});
  must(a.length === m.crop.w * m.crop.h, `알파 크기 ${a.length} ≠ ${m.crop.w}×${m.crop.h}`);
  must(at(m.crop.x + 10, m.crop.y + 10) < 20, `배경이 안 지워짐 (알파 ${at(m.crop.x + 10, m.crop.y + 10)})`);
  must(at(760, 900) > 235, `사람이 투명해짐 (알파 ${at(760, 900)})`);
  must(at(960, 480) > 235, `흰 깃이 구멍 남 (알파 ${at(960, 480)})`);
});
test('머리 추적(face.py): 예시 영상에서 정수리·턱을 찾음', () => {
  const D = path.join('projects', '.selftest-face');
  fs.rmSync(D, {recursive: true, force: true});
  fs.mkdirSync(D, {recursive: true});
  fs.copyFileSync('docs/example/before.mp4', path.join(D, 'input.mp4'));
  fs.writeFileSync(path.join(D, 'video.json'), JSON.stringify({file: 'input.mp4', width: 540, height: 960}));
  const r = sh(process.execPath, ['scripts/py.mjs', 'face', D]);
  const v = json(path.join(D, 'video.json'));
  fs.rmSync(D, {recursive: true, force: true});
  must(r.code === 0 && v.head, r.out.trim().split('\n').pop());
  // 실측: 머리카락 끝 0.145, 턱 0.47 — 정수리는 머리카락보다 위(여유), 너무 위(>0.06 차이)도 아니게
  must(v.head.top < 0.145 && v.head.top > 0.085, `정수리 ${v.head.top} (머리카락 끝 0.145)`);
  must(Math.abs(v.head.chin - 0.475) < 0.03, `턱 ${v.head.chin}`);
  must(v.track.length > 80, `표본 ${v.track.length}개`);
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

const edit = () => sh(process.execPath, ['scripts/py.mjs', 'edit', T]);
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
  // 예전: 편집본을 원본 fps(29.97)로 내보내 Remotion 렌더가 "No frame found at position" 으로 멈췄다 (ep01-long) → 렌더 fps(30)로
  const fr = sh('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=r_frame_rate', '-of', 'csv=p=0', path.join(T, 'edit.mp4')]).out.trim();
  must(fr === '30/1', `편집본 fps ${fr} (30/1 이어야)`);
  // 원본의 장(chapter) 트랙을 그대로 옮기면 자르기 전 길이의 data 트랙이 남는다 (ep01-long: 영상 380초 + 389초 트랙)
  const kinds = sh('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', path.join(T, 'edit.mp4')]).out.trim().split(/\s+/);
  must(kinds.join() === 'video,audio', `편집본 트랙: ${kinds.join(', ')} (영상·소리 둘만)`);
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

test('롱폼: 조각 160개 (필터 그래프 3만 자+) 도 편집됨 — 그래프는 파일로', () => {
  // 예전: 그래프를 인자로만 넘겨서, 9분 롱폼처럼 조각이 수백 개면 Windows 명령줄 한도(약 32K 자)를 넘어 ffmpeg 가 못 떴다
  const L = path.join('projects', '.selftest-long');
  fs.rmSync(L, {recursive: true, force: true});
  fs.mkdirSync(L, {recursive: true});
  const n = 160; // 0.5초마다 0.2초 삐- → 쉼 0.3초가 매번 잘림
  const g = sh('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=gray:s=160x284:r=25:d=${n / 2}`, '-f', 'lavfi', '-i',
    `aevalsrc='0.4*sin(2*PI*440*t)*lt(mod(t\\,0.5)\\,0.2)':s=44100:d=${n / 2}`, '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', path.join(L, 'input.mp4')]);
  must(g.code === 0, g.out);
  const ws = Array.from({length: n}, (_, i) => ({text: '삐', start: i * 0.5 + 0.01, end: i * 0.5 + 0.19, cue: i}));
  fs.writeFileSync(path.join(L, 'words.json'), JSON.stringify(ws));
  fs.writeFileSync(path.join(L, 'captions.json'), JSON.stringify(ws.map((w) => ({start: w.start, end: w.start + 0.5, text: w.text}))));
  fs.writeFileSync(path.join(L, 'video.json'), JSON.stringify({file: 'input.mp4', width: 160, height: 284, duration: n / 2, fps: 25, audio: true, layout: 'vertical'}));
  fs.writeFileSync(path.join(L, 'taste.json'), JSON.stringify({edit: {silence: 'tight'}})); // 앞 시험이 배운 내 취향(silence)과 무관하게
  const r = sh(process.execPath, ['scripts/py.mjs', 'edit', L]);
  const segs = fs.existsSync(path.join(L, 'cuts.json')) ? json(path.join(L, 'cuts.json')).segments.length : 0;
  const graph = fs.existsSync(path.join(L, '.filter_graph.txt')) ? fs.statSync(path.join(L, '.filter_graph.txt')).size : 0;
  fs.rmSync(L, {recursive: true, force: true});
  must(r.code === 0, r.out.trim().split('\n').slice(-2).join(' | '));
  must(segs >= n * 0.9, `조각 ${segs}개 (무음이 안 잘림)`);
  must(graph > 32000, `그래프 파일 ${graph}바이트 — 한도를 넘는 경우를 시험하지 못함`);
});

// ── 4. 검사기: 원본 시간 plan 이 편집 시간으로 옮겨지고, 알려진 실수는 막힌다
const check = (plan) => {
  fs.writeFileSync(path.join(T, 'plan.json'), JSON.stringify(plan));
  return sh(process.execPath, ['scripts/render.mjs', '.selftest', '--check']);
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
test('경고: 글자 단어 수 ≠ times 개수 (남는 단어가 엉뚱한 때 뜸)', () => {
  // 예전: "5년 만에 *세 배*" 4단어에 titleTimes 3개 → 마지막 "배" 가 장면 시작에 먼저 떴다 (test-916)
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'k', in: 2.9, out: 5.9, mode: 'panel', template: 'keyword', props: {text: '5년 만에 *세 배*', times: [3.0, 3.2, 3.4]}}]});
  must(/4단어인데 times 가 3개/.test(r.out), r.out.trim().split('\n').pop());
  must(/times\?\.length \? times\[times\.length - 1\]/.test(fs.readFileSync('src/kit/KText.tsx', 'utf8')), 'KText: 남는 단어가 마지막 시각 뒤로 가지 않음');
});
test('막힘: morph 첫 상태가 늦어 빈 판', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'm', in: 2.0, out: 4.0, mode: 'panel', template: 'morph', props: {states: [{t: 3.0, kind: 'pill', text: 'x'}]}}]});
  must(r.code !== 0 && /빈 판/.test(r.out), '통과해 버림');
});
test('움직임 (온돌 롱폼 참고): 장면 카메라 시각도 편집 시간으로 · 앞에 몰린 장면 경고 · 챕터 길 지도 · 노래방식 자막 단어 시각', () => {
  // 예전: 장면이 처음 1초에 다 뜨고 나머지는 멈춰 있어 PPT 처럼 보였다, 자막은 한 줄이 통째로, 장 카드는 장마다 따로 놀았다 (ep01)
  const cuts = {segments: [{src: [0, 10], out: [0, 10]}, {src: [20, 30], out: [10, 20]}], duration: 20};
  const r = remapScene(cuts, {id: 'c', in: 21, out: 27, props: {}, camera: {at: 25, x: 0.5, y: 0.5, scale: 1.1}});
  must(r.scene?.camera?.at === 15, `camera.at 이 편집 시간으로 안 옮겨짐 (${r.scene?.camera?.at})`);
  const kw = {id: 'k', in: 10, out: 16, template: 'keyword', props: {text: '두 가지', times: [10.1, 10.5]}};
  must(frontLoaded(kw), '앞 0.5초에 다 뜨고 5.5초 멈춘 장면을 못 잡음');
  must(!frontLoaded({...kw, camera: {at: 13, x: 0.5, y: 0.5, scale: 1.1}}), 'camera 로 다가가는 장면까지 경고');
  must(!frontLoaded({...kw, props: {text: '두 가지', times: [10.1, 13.5]}}), '대사에 맞춰 나눠 뜬 장면까지 경고');
  const chs = ['모으고', '굴리고', '남기고'].map((label, i) => ({id: `ch${i}`, in: i * 10, out: i * 10 + 3, template: 'chapter', props: {num: `0${i + 1}`, title: 't', label}}));
  must(!addRoad(chs).length && chs[2].props.roadIndex === 2 && chs[0].props.road.join() === '모으고,굴리고,남기고', `길 지도: ${JSON.stringify(chs[2].props)}`);
  const two = chs.slice(0, 2).map((x) => ({...x, props: {title: 't'}}));
  addRoad(two);
  must(two.every((x) => x.props.road === undefined), '장이 2개면 길 지도를 안 붙여야');
  const c = check({theme: {palette: 'darktech'}, scenes: []});
  must(c.code === 0, c.out.trim().split('\n').pop());
  const p = json(path.join(T, '.props.json'));
  must(p.captions.some((x) => Array.isArray(x.w) && x.w.length === x.text.split(' ').length), '자막에 단어별 시각(w)이 안 붙음 → 노래방식 자막이 안 나온다');
  must(p.cameraDrift > 0 && p.captionKaraoke === true, `취향 기본값이 안 넘어감 (drift ${p.cameraDrift}, karaoke ${p.captionKaraoke})`);
});
test('막힘: 승인 안 된/대비 낮은 트라이어드', () => {
  const r = check({theme: {palette: 'darktech', triad: ['#777777', '#888888', '#999999']}, scenes: []});
  must(r.code !== 0 && /triad/.test(r.out), '통과해 버림');
});
test('막힘: 없는 오브젝트·효과음', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{...hero('a', 2.0, 3.0), props: {object: 'unicorn', title: 'x'}, sfx: [{t: 2, cue: 'boom'}]}]});
  must(r.code !== 0 && /unicorn/.test(r.out) && /boom/.test(r.out), '통과해 버림');
});

test('막힘: 머리 위 공간이 없는데 above (얼굴 가림 정책)', () => {
  const vj = path.join(T, 'video.json');
  const v = json(vj);
  // 화면을 꽉 채운 얼굴: 정수리 0.02, 턱 0.9
  fs.writeFileSync(vj, JSON.stringify({...v, head: {top: 0.02, chin: 0.9, left: 0.1, right: 0.9}, track: [0.5, 1.5, 2.5, 3.5, 4.5, 5.5].map((t) => [t, 0.02, 0.9, 0.1, 0.9])}));
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'a', in: 4.5, out: 5.9, mode: 'above', template: 'keyword', props: {text: '셋', times: [4.6]}}]});
  fs.writeFileSync(vj, JSON.stringify(v));
  must(r.code !== 0 && /정책\(얼굴\)/.test(r.out), '통과해 버림');
});
test('막힘: 머리 위/아래 카드에 안 맞는 템플릿 (compare 를 below 에)', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'a', in: 4.5, out: 5.9, mode: 'below', template: 'compare', props: {left: {title: 'a'}, right: {title: 'b'}}}]});
  must(r.code !== 0 && /below/.test(r.out), '통과해 버림');
});

test('아바타 확대: 취향대로 채움(영상 끝이면 wipe), cutaway 가 아니면 막힘, 레시피는 정책에서 (정책 avatarGrow)', () => {
  const tj = path.join(T, 'taste.json');
  fs.writeFileSync(tj, JSON.stringify({broll: {exit: 'avatar-grow'}}));
  const r = check({theme: {palette: 'darktech'}, scenes: [hero('a', 2.9, 5.9)]});
  const p = json(path.join(T, '.props.json'));
  const bad = check({theme: {palette: 'darktech'}, scenes: [{...hero('a', 2.9, 5.9), mode: 'panel', exit: 'avatar-grow'}]});
  fs.rmSync(tj);
  must(r.code === 0, r.out.trim().split('\n').pop());
  const want = p.scenes[0].out < p.duration - 0.05 ? 'avatar-grow' : 'wipe'; // 뒤에 얼굴이 남으면 커지고, 영상 끝이면 돌아올 얼굴이 없다
  must(p.scenes[0].exit === want, `exit ${p.scenes[0].exit} (기대 ${want}, out ${p.scenes[0].out} / 길이 ${p.duration})`);
  must(JSON.stringify(p.avatarGrow?.steps) === JSON.stringify(policy.avatarGrow.steps), '.props.json 레시피가 정책과 다름');
  must(bad.code !== 0 && /avatar-grow/.test(bad.out), 'panel 에 avatar-grow 가 통과해 버림');
});

test('가로(side): 아바타 확대를 붙이지 않고, 머리 위/아래 템플릿 제한도 안 걸림 (아바타가 왼쪽 카드)', () => {
  // 예전: side 컷어웨이에도 avatar-grow 를 붙이고 "B-roll 을 가립니다" 경고를 냈다. Side.tsx 는 exit 를 안 쓴다
  const tj = path.join(T, 'taste.json');
  fs.writeFileSync(tj, JSON.stringify({broll: {exit: 'avatar-grow'}}));
  const plan = (s) => ({theme: {palette: 'darktech'}, layout: 'side', scenes: [s]});
  const r = check(plan(hero('a', 2.9, 5.9)));
  const p = json(path.join(T, '.props.json'));
  const below = check(plan({id: 'a', in: 4.5, out: 5.9, mode: 'below', template: 'compare', props: {left: {title: 'a'}, right: {title: 'b'}}}));
  const forced = check(plan({...hero('a', 2.9, 5.9), exit: 'avatar-grow'}));
  fs.rmSync(tj);
  must(r.code === 0 && !p.scenes[0].exit && !/아바타가 커지는/.test(r.out), `exit ${p.scenes[0].exit} | ${r.out.trim().split('\n').pop()}`);
  must(below.code === 0, 'side 의 below compare 가 막힘: ' + below.out.trim().split('\n').pop());
  must(forced.code !== 0 && /세로 영상에서만/.test(forced.out), 'side 에 avatar-grow 를 직접 써도 통과해 버림');
});
test('흐름도(FlowDiagram) 통과 · avatar 좌우는 chapter 에만 left/right', () => {
  const flow = {id: 'f', in: 2.9, out: 5.9, mode: 'panel', template: 'custom', component: 'FlowDiagram', props: {nodes: [{text: '충전', object: 'mobile', at: 3.0}, {text: '통장', object: 'money-bag'}], edges: [{from: 0, to: 1, label: '현금'}]}};
  const ok = check({theme: {palette: 'darktech'}, layout: 'side', scenes: [flow]});
  must(ok.code === 0, ok.out.trim().split('\n').pop());
  const badObj = check({theme: {palette: 'darktech'}, layout: 'side', scenes: [{...flow, props: {...flow.props, nodes: [{text: 'x', object: 'unicorn'}]}}]});
  must(badObj.code !== 0 && /unicorn/.test(badObj.out), '흐름도 노드의 없는 오브젝트가 통과');
  const bad = check({theme: {palette: 'darktech'}, layout: 'side', scenes: [{...flow, props: {...flow.props, avatar: 'right'}}]});
  must(bad.code !== 0 && /props\.avatar/.test(bad.out), 'chapter 가 아닌 장면의 avatar 가 통과');
});

// 다양성: 편집본(재배치 [[1,3]]) 원본 0.3–2.9 · 2.9–5.9 → 편집 약 0.3–1.9 · 1.9–3.7 로 붙은 두 장면
const pair = (a, b) => [{id: 'a', in: 0.3, out: 2.9, mode: 'panel', ...a}, {id: 'b', in: 2.9, out: 5.9, mode: 'panel', ...b}];
const kw = {template: 'keyword', props: {text: '하나', times: [0.4]}};
test('막힘: 붙은 두 장면의 배치·모션이 같음 (다양성 정책)', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: pair(kw, {template: 'keyword', props: {text: '셋', times: [4.6]}})});
  must(r.code !== 0 && /정책\(다양성\) 장면 a→b/.test(r.out), '통과해 버림');
});
test('막힘: 붙은 두 장면의 주인공 오브젝트가 같음', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: pair({template: 'list', props: {object: 'bulb', items: [{text: 'x', at: 0.4}]}}, {mode: 'cutaway', ...hero('b', 2.9, 5.9)})});
  must(r.code !== 0 && /주인공 "bulb"/.test(r.out), '통과해 버림');
});
test('막힘: morph 안에서 같은 모양이 연속 (pill → pill)', () => {
  const r = check({theme: {palette: 'darktech'}, scenes: [{id: 'm', in: 2.9, out: 5.9, mode: 'panel', template: 'morph', props: {states: [{t: 3.0, kind: 'pill', text: 'a'}, {t: 4.6, kind: 'pill', text: 'b'}]}}]});
  must(r.code !== 0 && /pill → pill/.test(r.out), '통과해 버림');
});
test('통과: 배치만 같고 모션·주인공이 다른 두 장면 (strict 취향이면 막힘)', () => {
  const plan = {theme: {palette: 'darktech'}, scenes: pair(kw, {template: 'hero', props: {object: 'bulb', title: '셋', objectAt: 4.6}})};
  const r = check(plan);
  must(r.code === 0, r.out.trim().split('\n').filter((l) => l.startsWith('❌')).join(' | '));
  fs.writeFileSync(path.join(T, 'taste.json'), JSON.stringify({broll: {variety: 'strict'}}));
  const s = check(plan);
  fs.rmSync(path.join(T, 'taste.json'));
  must(s.code !== 0 && /0개까지/.test(s.out), 'strict 인데 통과해 버림');
  // 우선순위: 프로젝트 취향 > 내 취향(me.json) > 기본 취향
  fs.writeFileSync(ME, JSON.stringify({broll: {variety: 'strict'}}));
  const m = check(plan);
  fs.writeFileSync(path.join(T, 'taste.json'), JSON.stringify({broll: {variety: 'normal'}}));
  const p = check(plan);
  fs.rmSync(path.join(T, 'taste.json'));
  fs.rmSync(ME, {force: true});
  must(m.code !== 0, '내 취향(me.json) strict 가 안 먹음');
  must(p.code === 0, '프로젝트 취향이 내 취향을 못 덮음');
});

// ── 5. 렌더 한 프레임 (브라우저 필요)
if (!quick)
  test('스틸 렌더 (npm run still)', () => {
    check({theme: {palette: 'darktech'}, scenes: [hero('a', 4.5, 5.9)]});
    const r = sh(process.execPath, ['scripts/still.mjs', '.selftest', '5.2']);
    must(r.code === 0 && fs.existsSync(path.join(T, 'out', 'still.png')), r.out.trim().split('\n').pop());
  });
if (!quick)
  test('스토리보드 (npm run storyboard): 장면마다 한 칸 + 지문 표, 다양성 위반이면 표만 쓰고 멈춤, 끝에 늦게 나오는 요소 ⚠️', () => {
    check({theme: {palette: 'darktech'}, scenes: pair(kw, {template: 'hero', props: {object: 'bulb', title: '셋', objectAt: 4.6}})});
    const sb = () => sh(process.execPath, ['scripts/storyboard.mjs', '.selftest']);
    const r = sb();
    const sheet = path.join(T, 'out', 'storyboard.png');
    must(r.code === 0 && fs.existsSync(sheet), r.out.trim().split('\n').pop());
    const w = Number(sh('ffprobe', ['-v', 'error', '-show_entries', 'stream=width', '-of', 'csv=p=0', sheet]).out.trim());
    must(w > 800, `시트 폭 ${w}px — 두 칸이 아님`);
    must(/\| a \|.*\| b \|.*배치/s.test(fs.readFileSync(path.join(T, 'storyboard.md'), 'utf8')), 'storyboard.md 에 장면 a·b 와 같은 축(배치)이 없음');
    // 예전: avatar-v01 장면 06 "번지죠" 가 무음을 줄인 장면 끝 0.5초 전에야 나와 거의 안 보였다
    check({theme: {palette: 'darktech'}, scenes: pair(kw, {template: 'keyword', props: {text: '셋', times: [5.7]}})});
    const x = sb();
    const md = fs.readFileSync(path.join(T, 'storyboard.md'), 'utf8');
    must(x.code !== 0 && /정책\(다양성\)/.test(md), '다양성 위반인데 시트를 만들어 버림');
    must(/⚠️ 장면 b: 마지막 요소/.test(md), '장면 끝에 나오는 요소를 알리지 않음');
  });

fs.rmSync(T, {recursive: true, force: true});
fs.rmSync('public/_live', {recursive: true, force: true});
fs.rmSync(ME, {force: true});
for (const n of ['after', 'before']) fs.rmSync(path.join('projects', '_refs', `selftest-ref-${n}`), {recursive: true, force: true});

for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : `\n     ${r.msg}`}`);
const bad = results.filter((r) => !r.ok).length;
console.log(bad ? `\n❌ ${bad}/${results.length} 실패` : `\n✅ ${results.length}개 통과`);
process.exit(bad ? 1 : 0);
