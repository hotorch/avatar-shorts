#!/usr/bin/env node
// 내 취향 — 이 PC 에만 (style/me.json, git 제외). 레퍼런스 영상과 내가 고친 것에서 배운다.
//   npm run me                                   내 취향 카드
//   npm run me -- --set captions.scale=1.2 --why "자막 더 크게 (두 번)" [--by reference]   직접 정하기 (by: user 기본)
//   npm run me -- --unset captions.scale         직접 정한 것 지우기
//   npm run me -- --remove <레퍼런스 이름>        레퍼런스 하나 빼고 다시 계산
// 우선순위: 정책 > plan > projects/<이름>/taste.json > style/me.json > style/taste.json  (scripts/style.mjs)
// 값 = 레퍼런스 숫자에서 계산(learn) 위에 --set 으로 정한 것. 계산은 레퍼런스가 늘 때마다 처음부터 다시 한다(중앙값).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const mePath = () => process.env.AVATAR_SHORTS_ME ?? path.join(ROOT, 'style/me.json');
export const readMe = () => (fs.existsSync(mePath()) ? JSON.parse(fs.readFileSync(mePath(), 'utf8')) : {});

const DOC = '내 취향 — 이 PC 에만 (git 제외). npm run me 로 보기. 레퍼런스 영상(npm run reference)과 내가 고친 것(npm run me -- --set)에서 배운다. 우선순위: 정책 > plan > 프로젝트 taste.json > 이 파일 > style/taste.json';
const LABEL = {'broll.density': 'B-roll 양', 'edit.silence': '무음', 'edit.maxLength': '최대 길이(초)', 'look.palette': '팔레트', 'look.surface': '면', 'captions.scale': '자막 크기', 'edit.punchIn': '펀치인', 'edit.structure': '구조', 'broll.framing': '배치', 'broll.variety': '다양성', 'sound.sfxVolume': '효과음', ask: '질문'};
const median = (xs) => {
  const s = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/** 레퍼런스 숫자 → 취향 값과 이유. 기준은 style/README.md 의 취향 표에 맞춘다 */
export const learn = (refs = []) => {
  // 영상 길이(edit.maxLength)는 배우지 않는다: 짧은 레퍼런스를 따라 내 말이 잘려 나간다
  const m = (k) => median(refs.map((r) => r.metrics?.[k]));
  const out = {};
  const set = (k, v, why) => (out[k] = {value: v, why});
  if (!refs.length) return out;
  const per = m('changesPerMin');
  // B-roll 하나 = 등장·퇴장 화면 전환 2번 → low 분당 2~4개(전환 8회 미만) · medium 4~7개(14회 미만) · high
  if (per != null) set('broll.density', per < 8 ? 'low' : per < 14 ? 'medium' : 'high', `화면 전환 분당 ${per.toFixed(1)}회`);
  const audio = refs.filter((r) => r.metrics?.audio);
  if (audio.length) {
    const p = median(audio.map((r) => r.metrics.pauseMedian ?? 0)); // 쉼이 하나도 없으면 0 (배경음악이 깔렸을 수도)
    set('edit.silence', p < 0.22 ? 'tight' : p < 0.4 ? 'natural' : 'off', p ? `말 사이 쉼 ${p.toFixed(2)}초` : '말 사이 쉼이 거의 없음');
  }
  const light = median(refs.map((r) => r.metrics?.tones?.lightness));
  if (light != null) {
    const warm = median(refs.map((r) => (r.metrics?.tones?.hues ? [0, 1, 11].reduce((a, k) => a + r.metrics.tones.hues[k], 0) : null)));
    set('look.palette', light < 0.35 ? 'darktech' : warm >= 0.5 ? 'academic' : 'editorial', light < 0.35 ? `화면 밝기 ${light.toFixed(2)} (어두움)` : `밝은 화면, ${warm >= 0.5 ? '따뜻한' : '차가운'} 색 ${Math.round((warm >= 0.5 ? warm : 1 - warm) * 100)}%`);
  }
  return out;
};

/** me.json 의 $refs·$set 으로 취향 값을 다시 계산해 저장 */
export const saveMe = (me) => {
  const learned = learn(me.$refs);
  const all = {...learned, ...me.$set};
  const out = {$doc: DOC, $refs: me.$refs ?? [], $set: me.$set ?? {}};
  for (const [k, {value}] of Object.entries(all)) {
    const ks = k.split('.');
    let o = out;
    ks.slice(0, -1).forEach((x) => (o = o[x] ??= {}));
    o[ks.at(-1)] = value;
  }
  fs.mkdirSync(path.dirname(mePath()), {recursive: true});
  fs.writeFileSync(mePath(), JSON.stringify(out, null, 1) + '\n');
  return all;
};

export const card = (me) => {
  const refs = me.$refs ?? [];
  const learned = learn(refs);
  const rows = {...learned, ...(me.$set ?? {})};
  if (!Object.keys(rows).length)
    return ['아직 배운 내 취향이 없어요.', '💡 좋아하는 쇼츠 영상 파일을 주시면 화면 전환 리듬·쉼·색을 재서 다음 영상부터 맞춰요. ("이 영상처럼 만들고 싶어")'].join('\n');
  const lines = [`내 취향 (${path.relative(ROOT, mePath()) || mePath()} · 이 PC 에만)`, `레퍼런스 ${refs.length}개${refs.length ? ': ' + refs.map((r) => r.file).join(', ') : ''}`];
  for (const [k, r] of Object.entries(rows)) {
    const by = me.$set?.[k] ? (me.$set[k].by === 'reference' ? ' (레퍼런스 시트를 보고)' : ' (내가 고침)') : '';
    lines.push(`  - ${LABEL[k] ?? k}: ${r.value}  ← ${r.why}${by}`);
  }
  if (refs.length < 2) lines.push(`💡 레퍼런스가 ${refs.length ? '1개라 그 영상 하나의 버릇일 수 있어요' : '없어요'}. 좋아하는 쇼츠를 하나 더 주시면 더 정확해져요.`);
  return lines.join('\n');
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
  const me = readMe();
  if (opt('--set')) {
    const [k, raw] = opt('--set').split('=');
    const keys = new Set();
    const walk = (o, pre) => Object.entries(o).forEach(([kk, v]) => (kk.startsWith('$') ? null : v && typeof v === 'object' && !Array.isArray(v) ? walk(v, pre + kk + '.') : keys.add(pre + kk)));
    walk(JSON.parse(fs.readFileSync(path.join(ROOT, 'style/taste.json'), 'utf8')), '');
    if (!keys.has(k) || raw == null) {
      console.error(`❌ 취향 키가 아닙니다: ${k} (${[...keys].join(', ')}). 형식: --set 키=값`);
      process.exit(1);
    }
    let value = raw;
    try {
      value = JSON.parse(raw);
    } catch {}
    me.$set = {...me.$set, [k]: {value, why: opt('--why') ?? '직접 정함', by: opt('--by') ?? 'user', date: new Date().toISOString().slice(0, 10)}};
  }
  if (opt('--unset') && me.$set) delete me.$set[opt('--unset')];
  if (opt('--remove')) me.$refs = (me.$refs ?? []).filter((r) => r.name !== opt('--remove'));
  if (opt('--set') || opt('--unset') || opt('--remove')) saveMe(me);
  console.log(card(readMe()));
}
