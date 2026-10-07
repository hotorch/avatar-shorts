#!/usr/bin/env node
// 좋아하는 영상(레퍼런스)을 재서 내 취향(style/me.json)에 반영한다
//   npm run reference -- <영상> [이름]
// → projects/_refs/<이름>/reference.json (숫자) · sheet.png (화면 전환 사이마다 한 장) → style/me.json 다시 계산 → 내 취향 카드
// 영상은 읽기만 한다. 같은 이름으로 다시 재면 그 레퍼런스를 바꾼다.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {card, readMe, saveMe} from './me.mjs';

const [srcArg, nameArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!srcArg) {
  console.error('사용법: npm run reference -- <영상> [이름]');
  process.exit(1);
}
const src = srcArg.replace(/^~(?=[\\/])/, os.homedir());
if (!fs.existsSync(src)) {
  console.error(`영상을 찾을 수 없어요: ${srcArg} — 전체 경로를 주세요`);
  process.exit(1);
}
// macOS 는 한글 파일 이름을 자모로 풀어(NFD) 저장한다 → 합쳐서(NFC) 이름 짓기
const name = (nameArg || path.basename(src, path.extname(src))).normalize('NFC').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '') || 'ref';
const out = path.join('projects', '_refs', name);
const r = spawnSync(process.execPath, ['scripts/py.mjs', 'reference', src, out], {stdio: 'inherit'});
if (r.status !== 0) process.exit(r.status ?? 1);

const metrics = JSON.parse(fs.readFileSync(path.join(out, 'reference.json'), 'utf8'));
const me = readMe();
me.$refs = [...(me.$refs ?? []).filter((x) => x.name !== name), {name, file: path.basename(src).normalize('NFC'), date: new Date().toISOString().slice(0, 10), metrics}];
saveMe(me);
console.log(`\n시트: ${path.join(out, 'sheet.png')} — 직접 보고 자막 크기·면·배치를 판단해 npm run me -- --set … --by reference\n`);
console.log(card(readMe()));
