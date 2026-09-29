#!/usr/bin/env node
// plan.json 을 쓸 때 단어 시각을 찾는다 (손으로 계산하지 않게)
//   npm run words -- <이름>            자막 큐마다 한 줄 + 단어별 시작 시각
//   npm run words -- <이름> 번지죠 git  그 글자가 든 단어만
// 원본 시간(plan.json 에 쓰는 값) · 편집 시간(결과 영상) · 렌더 프레임을 같이 보여 준다.
import fs from 'node:fs';
import path from 'node:path';
import {loadCuts, mapTime, toFrame} from './timeline.mjs';

const [name, ...terms] = process.argv.slice(2);
if (!name) {
  console.error('사용법: npm run words -- <이름> [찾을 글자…]');
  process.exit(1);
}
const dir = fs.existsSync(name) ? name : path.join('projects', name);
const wp = path.join(dir, 'words.json');
if (!fs.existsSync(wp)) {
  console.error(`${wp} 가 없습니다 → 먼저 transcribe.py 와 align.py`);
  process.exit(1);
}
const words = JSON.parse(fs.readFileSync(wp, 'utf8'));
const cuts = loadCuts(dir);
const f = (x) => x.toFixed(2).padStart(6);
const edit = (x) => {
  const m = mapTime(cuts, x, 'start');
  return m ? `${f(m.t)}  #${String(toFrame(m.t)).padStart(4)}` : '   (잘림)    ';
};

console.log(`원본 시간 = plan.json 에 쓰는 값${cuts ? ' · 편집 시간/프레임 = 결과 영상 기준' : ' (편집본 없음: 편집 시간 = 원본)'}\n`);
if (terms.length) {
  console.log('  원본    편집   프레임  큐  단어');
  for (const w of words)
    if (terms.some((t) => w.text.includes(t))) console.log(`${f(w.start)}  ${edit(w.start)}  ${String(w.cue).padStart(2)}  ${w.text}  (끝 ${w.end.toFixed(2)})`);
} else {
  const byCue = new Map();
  for (const w of words) byCue.set(w.cue, [...(byCue.get(w.cue) ?? []), w]);
  for (const [cue, ws] of byCue) {
    console.log(`[${String(cue).padStart(2)}] ${f(ws[0].start)} – ${ws.at(-1).end.toFixed(2)}  (편집 ${edit(ws[0].start).trim()})`);
    console.log('     ' + ws.map((w) => `${w.text}@${w.start.toFixed(2)}`).join('  '));
  }
}
