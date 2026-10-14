#!/usr/bin/env node
// 유튜브 설명란 챕터(타임스탬프) — plan.json 의 chapter 장면에서 뽑는다
//   npm run chapters -- <이름> [--intro "들어가며"]
// → 화면 출력 + projects/<이름>/chapters.txt
//   시각 = chapter 장면 in (원본 시간) → 편집 시간 (scripts/timeline.mjs). 초 단위는 내림 (장 카드보다 늦게 시작하지 않게).
//   유튜브 규칙: 첫 줄 00:00, 챕터 3개 이상, 각 10초 이상 — 어기면 ⚠️ (유튜브가 챕터를 안 보여 준다)
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadCuts, mapTime} from './timeline.mjs';

const clean = (s) => String(s ?? '').replace(/[*+]/g, '').replace(/\s+/g, ' ').trim();

export const stamp = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** plan + cuts → {lines: ['00:00 들어가며', '01:02 01 미리 받은 돈', …], warn: [...]} */
export const chapterList = (plan, cuts, {intro = '들어가며', duration} = {}) => {
  const toEdit = (t) => (mapTime(cuts, t, 'start') ?? {t}).t;
  const ch = (plan.scenes ?? [])
    .filter((s) => s.template === 'chapter')
    .map((s) => ({t: Math.floor(toEdit(s.in)), title: [clean(s.props?.num), clean(s.props?.title)].filter(Boolean).join(' ')}))
    .sort((a, b) => a.t - b.t);
  if (!ch.length || ch[0].t > 0) ch.unshift({t: 0, title: intro});
  const end = duration ?? cuts?.duration ?? plan.duration;
  const warn = [];
  if (ch.length < 3) warn.push(`챕터가 ${ch.length}개 — 유튜브는 3개 이상이어야 챕터를 보여 줍니다`);
  ch.forEach((c, i) => {
    const next = ch[i + 1]?.t ?? end;
    if (next != null && next - c.t < 10) warn.push(`"${c.title}" 가 ${next - c.t}초 — 유튜브 챕터는 10초 이상이어야 합니다`);
  });
  return {lines: ch.map((c) => `${stamp(c.t)} ${c.title}`), warn};
};

/**
 * 챕터 길 지도 (온돌 롱폼 참고 — 장 카드마다 같은 길에 "지금 어디쯤" 이 이어진다): chapter 가 3개 이상이면
 * 각 chapter props 에 road(모든 장 이름) + roadIndex(지금 장) 를 넣는다. 이름 = props.label → num → 순번. road 를 직접 준 장면은 그대로.
 * → 경고 목록 (8자 넘는 이름). render.mjs 가 부른다
 */
export const addRoad = (scenes) => {
  const ch = scenes.filter((s) => s.template === 'chapter').sort((a, b) => a.in - b.in);
  if (ch.length < 3) return [];
  const road = ch.map((s, i) => clean(s.props?.label ?? s.props?.num ?? i + 1));
  ch.forEach((s, i) => s.props?.road === undefined && (s.props = {...s.props, road, roadIndex: i}));
  return road.flatMap((r, i) => ([...r].length > 8 ? [`장면 ${ch[i].id}: 길 지도 이름 "${r}" 가 8자를 넘습니다 — props.label 을 짧게`] : []));
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const slug = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--intro');
  if (!slug) {
    console.error('사용법: npm run chapters -- <이름> [--intro "들어가며"]');
    process.exit(1);
  }
  const dir = path.join('projects', slug);
  const plan = JSON.parse(fs.readFileSync(path.join(dir, 'plan.json'), 'utf8'));
  const video = fs.existsSync(path.join(dir, 'video.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'video.json'), 'utf8')) : null;
  const cuts = loadCuts(dir);
  const intro = args.includes('--intro') ? args[args.indexOf('--intro') + 1] : undefined;
  const {lines, warn} = chapterList(plan, cuts, {intro, duration: cuts?.duration ?? plan.duration ?? video?.duration});
  fs.writeFileSync(path.join(dir, 'chapters.txt'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  warn.forEach((m) => console.log('⚠️  ' + m));
  console.log(`\n저장: ${path.join(dir, 'chapters.txt')} (설명란에 그대로 붙여 넣기)`);
}
