#!/usr/bin/env node
// 렌더 전에 장면마다 대표 프레임 한 장 + 장면 지문 표 → 연속으로 비슷한 장면, 대사와 안 맞는 그림을 먼저 잡는다
//   npm run storyboard -- <이름>
// → projects/<이름>/out/storyboard.png (보는 순서 = 편집 시간 순, 왼쪽 위부터) · projects/<이름>/storyboard.md (지문 표)
//   대표 프레임 = 퇴장 직전(편집 시간 out − 0.4초): 요소가 다 나온 순간. 검사(render --check)가 막히면 표만 쓰고 멈춘다.
//   마지막 요소가 장면 끝 0.6초 안쪽에 나오면 (퇴장 0.35초를 빼면 0.25초도 못 봄) ⚠️ (무음을 줄이면 장면 끝이 당겨져 거의 안 보인다)
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {remotion} from './platform.mjs';
import {resolveStyle} from './style.mjs';
import {COMP_FPS, lastBeat, loadCuts, mapTime, toFrame} from './timeline.mjs';
import {AXES, fingerprint, sharedAxes} from './variety.mjs';

const slug = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!slug) {
  console.error('사용법: npm run storyboard -- <이름>');
  process.exit(1);
}
const dir = path.join('projects', slug);
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const plan = read('plan.json');
const captions = fs.existsSync(path.join(dir, 'captions.json')) ? read('captions.json') : (plan.captions ?? []);
if (!plan.scenes?.length) {
  console.error('plan.json 에 장면이 없습니다');
  process.exit(1);
}
const style = resolveStyle(slug, plan);
const rule = style.policy.variety ?? {};
const strict = style.taste.broll?.variety === 'strict';
const cuts = loadCuts(dir);
const toEdit = (t, side = 'start') => (mapTime(cuts, t, side) ?? {t}).t;
// 보는 순서(편집 시간)로 — 훅을 앞으로 옮겼으면 그 장면이 맨 앞. render 의 다양성 검사도 이 순서
const scenes = [...plan.scenes].sort((a, b) => toEdit(a.in) - toEdit(b.in));

// 검사: .props.json 을 최신으로 만들고, 정책(다양성 포함) 위반이면 여기서 멈춘다
const chk = spawnSync(process.execPath, ['scripts/render.mjs', slug, '--check'], {encoding: 'utf8'});
const failed = chk.status !== 0;
const layout = plan.layout ?? (fs.existsSync(path.join(dir, 'video.json')) ? read('video.json').layout : null) ?? 'vertical';
const cols = Math.min(scenes.length, layout === 'side' ? 3 : 5);

const rows = scenes.map((s, i) => {
  const fp = fingerprint(s, rule.motion);
  const p = scenes[i - 1];
  const near = p && toEdit(s.in) - toEdit(p.out, 'end') <= (rule.windowSec ?? 5);
  const same = near ? sharedAxes(fingerprint(p, rule.motion), fp) : [];
  const said = captions.filter((c) => (c.start + c.end) / 2 >= s.in && (c.start + c.end) / 2 <= s.out).map((c) => c.text).join(' ');
  const end = toEdit(s.out, 'end');
  const lb = lastBeat(s);
  const late = lb != null && end - toEdit(lb) < 0.6 ? `장면 ${s.id}: 마지막 요소(원본 ${lb}s)가 장면 끝 ${(end - toEdit(lb)).toFixed(1)}초 전에 나와 거의 안 보입니다 → out 을 늘리거나 그 요소를 앞당기세요` : null;
  return {s, fp, same, said, late, cell: `${Math.floor(i / cols) + 1}행 ${(i % cols) + 1}열`, t: Math.max(toEdit(s.in) + 0.3, end - 0.4)};
});
const cell = (v) => String(v ?? '—').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [
  `# 스토리보드 — ${slug}`,
  '',
  failed ? '검사(render --check)에서 막혀 프레임을 뽑지 않았습니다. 아래 ❌ 를 고치고 다시 실행하세요.' : `시트: \`out/storyboard.png\` (보는 순서대로 왼쪽 위부터 ${cols}열, 대표 프레임 = 요소가 다 나온 순간)`,
  `앞 장면과 같은 축 허용: ${strict ? 0 : (rule.maxSharedAxes ?? 1)}개 (정책 variety${strict ? ', 취향 broll.variety strict' : ''}). 주인공이 같으면 그것만으로 막힘.`,
  '',
  `| # | 칸 | 편집 시간 | 원본 시간 | 대사 | ${Object.values(AXES).join(' | ')} | 앞 장면과 같은 축 |`,
  `|---|---|---|---|---|${Object.keys(AXES).map(() => '---|').join('')}---|`,
  ...rows.map((r) => `| ${r.s.id} | ${r.cell} | ${toEdit(r.s.in).toFixed(1)} | ${r.s.in.toFixed(2)}–${r.s.out.toFixed(2)} | ${cell(r.said)} | ${Object.keys(AXES).map((k) => cell(r.fp[k])).join(' | ')} | ${r.same.map((k) => AXES[k]).join('·') || '—'} |`),
  ...(rows.some((r) => r.late) ? ['', ...rows.filter((r) => r.late).map((r) => `- ⚠️ ${r.late}`)] : []),
  ...(failed ? ['', '## 검사', '```', (chk.stdout + chk.stderr).trim(), '```'] : []),
  '',
];
fs.writeFileSync(path.join(dir, 'storyboard.md'), md.join('\n'));
for (const r of rows) console.log(`  [${r.cell}] ${r.s.id} ${r.s.in.toFixed(2)}–${r.s.out.toFixed(2)}s ${Object.keys(AXES).map((k) => r.fp[k] ?? '—').join(' · ')}${r.same.length ? `  (앞과 같음: ${r.same.map((k) => AXES[k]).join('·')})` : ''}`);
rows.forEach((r) => r.late && console.log(`⚠️  ${r.late}`));
if (failed) {
  process.stdout.write(chk.stdout + chk.stderr);
  console.log(`표: ${path.join(dir, 'storyboard.md')} — ❌ 를 고친 뒤 다시 실행하세요`);
  process.exit(1);
}

const out = path.join(dir, 'out');
fs.mkdirSync(out, {recursive: true});
rows.forEach((r, i) => {
  const frame = toFrame(r.t, COMP_FPS);
  const x = remotion(['still', 'Short', path.join(out, `.sb_${String(i).padStart(3, '0')}.png`), `--frame=${frame}`, `--props=${path.join(dir, '.props.json')}`, '--scale=0.4', '--log=error'], {encoding: 'utf8'});
  if (x.status !== 0) {
    process.stdout.write(x.stdout + x.stderr);
    process.exit(1);
  }
});
const sheet = path.join(out, 'storyboard.png');
spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', '1', '-i', path.join(out, '.sb_%03d.png'), '-vf', `tile=${cols}x${Math.ceil(rows.length / cols)}:padding=6:color=white`, '-frames:v', '1', sheet], {stdio: 'inherit'});
rows.forEach((_, i) => fs.rmSync(path.join(out, `.sb_${String(i).padStart(3, '0')}.png`), {force: true}));
console.log(`시트: ${sheet}\n표: ${path.join(dir, 'storyboard.md')}`);
