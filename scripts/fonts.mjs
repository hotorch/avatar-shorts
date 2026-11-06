#!/usr/bin/env node
// 폰트 조합 — 고르고, 섞고, 내 폰트를 넣는다. 정답인 폰트는 없으니 같은 문장으로 나란히 보고 정한다.
//   npm run fonts                                    조합 목록 (쓸 수 있는지 · 어울리는 곳 · 주의점)
//   npm run fonts -- sheet [이름] [--pairs a,b,c] [--out 어딘가.png]   같은 문장을 조합마다 폰 크기로 비교 (이름을 주면 그 영상의 말로)
//   npm run fonts -- add <파일> [--as 이름] [--label "보일 이름"] [--kind gothic]   내 폰트 넣기 (이 PC 에만, git 제외)
//   npm run fonts -- remove <이름>
// 고른 뒤: npm run me -- --set type.pair=report   또는 칸만 npm run me -- --set type.emph=hahmlet
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {remotion} from './platform.mjs';
import {fontLibrary, fontReady, localFontsPath, readLocalFonts, resolveStyle, resolveType} from './style.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'style/policy.json'), 'utf8')).fonts;
const KINDS = ['gothic', 'wide', 'heavy', 'round', 'serif', 'hand', 'script', 'display'];
const PRETENDARD_ADVANCE = 0.864; // 한글 평균 폭 (font_info 로 잰 값)
const TARGET_CAP = 0.72; // 영문 대문자 높이 (Instrument Serif · Pretendard 쪽)

/** 작아 보이는 폰트만 키운다. 넓은 폰트는 fitSize 가 한글 1em 으로 잡아서 그대로 둔다 */
export const sizeFor = (m) => {
  const raw = m.hangul ? (m.advance && m.advance < 0.8 ? PRETENDARD_ADVANCE / m.advance : 1) : m.cap ? TARGET_CAP / m.cap : 1;
  const s = Math.min(1.3, Math.max(1, raw));
  return s > 1.02 ? +s.toFixed(2) : undefined;
};

/** 재 본 값 → 알릴 말. 깨지는 것만 ❌, 나머지는 영상에서 확인할 일 */
export const fontChecks = (m) => {
  const bad = [];
  const note = [];
  if (!m.hangul && !m.latin) bad.push('한글도 영문도 없는 폰트입니다');
  if (m.hangul && m.hangul < 2350) note.push(`한글이 ${m.hangul}자뿐입니다 (자주 쓰는 글자 2350자보다 적음). 없는 글자는 Pretendard 로 나옵니다`);
  if (!m.space) note.push('띄어쓰기 글자가 없습니다. 렌더에서는 다음 글꼴의 띄어쓰기를 쓰지만 스틸로 간격을 확인하세요');
  if (!m.digits) note.push('숫자가 없습니다. 숫자는 다른 글꼴로 나옵니다');
  return {bad, note};
};

const add = (args) => {
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const file = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  if (!file || !fs.existsSync(file)) {
    console.error(`❌ 폰트 파일을 못 찾았습니다: ${file ?? '(경로 없음)'}\n사용법: npm run fonts -- add <파일> [--as 이름] [--label "보일 이름"] [--kind ${KINDS.join('|')}]`);
    process.exit(1);
  }
  const ext = path.extname(file).toLowerCase();
  if (!['.ttf', '.otf', '.woff', '.woff2'].includes(ext)) {
    console.error('❌ ttf · otf · woff · woff2 만 넣을 수 있습니다');
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/py.mjs'), 'font_info', path.resolve(file)], {encoding: 'utf8'});
  if (r.status !== 0) {
    console.error(r.stderr.trim());
    process.exit(1);
  }
  const m = JSON.parse(r.stdout);
  const {bad, note} = fontChecks(m);
  if (bad.length) {
    console.error(`❌ ${bad.join(', ')}`);
    process.exit(1);
  }
  const pf = policy();
  const stem = path.basename(file, ext).normalize('NFC');
  const id = opt('--as') ?? (stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `font-${Date.now()}`);
  const known = pf.library[id];
  if (known && !known.local) {
    console.error(`❌ "${id}" 는 저장소에 이미 있는 폰트입니다. --as 로 다른 이름을 주세요`);
    process.exit(1);
  }
  const kind = opt('--kind') ?? known?.kind ?? 'gothic';
  if (!KINDS.includes(kind)) {
    console.error(`❌ --kind 는 ${KINDS.join(' · ')} 중 하나입니다`);
    process.exit(1);
  }
  const dest = path.join(path.dirname(localFontsPath()), `${id}${ext}`);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.copyFileSync(file, dest);
  const local = readLocalFonts();
  const size = known?.size ?? sizeFor(m);
  local[id] = {
    label: opt('--label') ?? known?.label ?? stem,
    family: known?.family ?? `My ${id}`,
    kind,
    script: m.hangul ? 'hangul' : 'latin',
    weight: known?.weight ?? (Number(m.weight.split(' ').pop()) || 400),
    ...(size ? {size} : {}),
    faces: [{file: `fonts/local/${id}${ext}`, weight: m.weight}],
  };
  fs.writeFileSync(localFontsPath(), JSON.stringify(local, null, 1));
  console.log(`✅ ${local[id].label} (${id}) 를 넣었습니다: 한글 ${m.hangul}자 · ${local[id].script === 'hangul' ? '강조·본문' : '영문'} 칸에 쓸 수 있음${size ? ` · 크기 ${size}배로 맞춤` : ''}`);
  note.forEach((n) => console.log(`⚠️  ${n}`));
  console.log('ℹ️  이 PC 에만 있고 git 에 안 올라갑니다. 영상에 써도 되는 폰트인지는 배포처 라이선스를 한 번 확인하세요.');
  console.log(`다음: npm run fonts -- sheet 로 비교 → npm run me -- --set type.${local[id].script === 'hangul' ? 'emph' : 'latin'}=${id}`);
};

const remove = (id) => {
  const local = readLocalFonts();
  if (!local[id]) {
    console.error(`❌ 내가 넣은 폰트 중에 "${id}" 는 없습니다 (${Object.keys(local).join(', ') || '없음'})`);
    process.exit(1);
  }
  for (const f of local[id].faces) fs.rmSync(path.join(path.dirname(localFontsPath()), path.basename(f.file)), {force: true});
  delete local[id];
  fs.writeFileSync(localFontsPath(), JSON.stringify(local, null, 1));
  console.log(`지웠습니다: ${id}`);
};

const list = () => {
  const pf = policy();
  const lib = fontLibrary(pf);
  console.log('폰트 조합 (정답은 없습니다. 영상 주제로 고르고, 칸은 섞어도 됩니다)\n');
  for (const [id, p] of Object.entries(pf.pairs)) {
    const missing = [p.emph, p.body, p.latin].filter((k) => !fontReady(lib[k]));
    console.log(`${missing.length ? '⬇️ ' : '✅'} ${id} — ${p.label}: ${lib[p.emph].label} · ${lib[p.body].label} · ${lib[p.latin].label}`);
    console.log(`     어울림: ${p.fit}`);
    console.log(`     주의: ${p.caution}`);
    missing.forEach((k) => console.log(`     받기: ${lib[k].link} → npm run fonts -- add <파일> --as ${k}`));
  }
  const mine = Object.entries(readLocalFonts()).filter(([k]) => !pf.library[k]);
  if (mine.length) console.log(`\n내가 넣은 폰트: ${mine.map(([k, f]) => `${k}(${f.label})`).join(', ')}`);
  console.log('\n칸별 폰트 (type.emph · type.body = 한글, type.latin = 영문):');
  for (const script of ['hangul', 'latin']) console.log(`  ${script === 'hangul' ? '한글' : '영문'}: ${Object.entries(lib).filter(([, f]) => f.script === script && fontReady(f)).map(([k]) => k).join(' ')}`);
};

const HAS_LATIN = /[A-Za-z0-9]/;
/** 시트에 쓸 문장: 그 영상의 실제 말에서 고른다 (훅 = 큰 자막, 자막 = 영어·숫자가 섞인 줄) */
export const sheetText = (captions = []) => {
  const short = captions.filter((c) => [...c.text].length <= 18);
  return {
    hook: short.find((c) => c.style === 'big')?.text ?? short[0]?.text ?? 'AI 도구 3개면 충분해요',
    caption: short.find((c) => HAS_LATIN.test(c.text))?.text ?? short[1]?.text ?? '영상 하나로 Shorts 만들기',
    title: short.filter((c) => HAS_LATIN.test(c.text))[1]?.text ?? '2026년 90% 달라진 AI 도구',
  };
};

const sheet = (args) => {
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const slug = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
  const pf = policy();
  const ids = opt('--pairs')?.split(',') ?? Object.keys(pf.pairs);
  const unknown = ids.filter((k) => !pf.pairs[k]);
  if (unknown.length) {
    console.error(`❌ 없는 조합: ${unknown.join(', ')} (${Object.keys(pf.pairs).join(', ')})`);
    process.exit(1);
  }
  const lib = fontLibrary(pf);
  const skipped = [];
  const pairs = ids.flatMap((id) => {
    const p = pf.pairs[id];
    if (![p.emph, p.body, p.latin].every((k) => fontReady(lib[k]))) {
      skipped.push(p.label);
      return [];
    }
    const t = id === pf.defaultPair ? null : resolveType({pair: id}, pf);
    return [{id, label: p.label, names: [p.emph, p.body, p.latin].map((k) => lib[k].label), stacks: t?.stacks, load: t?.load ?? [], emphWeight: t?.emph.weight, bodyWeight: t?.body.weight ?? 700, caption: t ? t.body.family : 'SUIT'}];
  });
  if (!pairs.length) {
    console.error('❌ 보여 줄 조합이 없습니다');
    process.exit(1);
  }
  const dir = slug ? path.join(ROOT, 'projects', slug) : path.join(ROOT, 'projects', '_fonts');
  if (slug && !fs.existsSync(dir)) {
    console.error(`❌ 프로젝트가 없습니다: ${slug}`);
    process.exit(1);
  }
  const read = (f, fb) => (fs.existsSync(path.join(dir, f)) ? JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) : fb);
  const theme = resolveStyle(slug, read('plan.json', {})).theme;
  const props = path.join(dir, '.font-pairs.json');
  const out = opt('--out') ?? path.join(dir, 'out', 'font-pairs.png');
  fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
  fs.writeFileSync(props, JSON.stringify({pairs, text: sheetText(read('captions.json', [])), theme}));
  const r = remotion(['still', 'TypePairs', out, `--props=${props}`, '--log=error'], {encoding: 'utf8'});
  if (r.status !== 0) {
    process.stdout.write(r.stdout + r.stderr);
    process.exit(1);
  }
  if (skipped.length) console.log(`⬇️  파일이 없어 뺀 조합: ${skipped.join(', ')} (npm run fonts 로 받는 곳 보기)`);
  console.log(`폰트 비교: ${out}\n칸 하나가 폰 화면 크기입니다. 위는 밝은 바탕, 아래는 어두운 바탕.`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'add') add(rest);
  else if (cmd === 'remove') remove(rest[0]);
  else if (cmd === 'sheet') sheet(rest);
  else list();
}
